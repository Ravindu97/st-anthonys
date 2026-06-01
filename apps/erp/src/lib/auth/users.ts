import { getPool } from '@/lib/db';
import type { Role } from './permissions';

export type AppUser = {
  id: string;
  email: string;
  role: Role;
  is_active: boolean;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(
  email: string
): Promise<(AppUser & { password_hash: string }) | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    password_hash: string;
    role: Role;
    is_active: boolean;
  }>(
    `SELECT id, email, password_hash, role::text AS role, is_active
     FROM app_users WHERE email = $1`,
    [normalizeEmail(email)]
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    role: Role;
    is_active: boolean;
  }>(
    `SELECT id, email, role::text AS role, is_active
     FROM app_users WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
  };
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  role: Role;
}): Promise<AppUser> {
  const pool = getPool();
  const email = normalizeEmail(input.email);
  const { rows } = await pool.query<{
    id: string;
    email: string;
    role: Role;
    is_active: boolean;
  }>(
    `INSERT INTO app_users (email, password_hash, role)
     VALUES ($1, $2, $3::app_role)
     RETURNING id, email, role::text AS role, is_active`,
    [email, input.passwordHash, input.role]
  );
  return rows[0];
}
