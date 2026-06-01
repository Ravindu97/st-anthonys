import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getPool } from '@/lib/db';
import { findUserById, type AppUser } from './users';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTtlSeconds,
  signSessionPayload,
  verifySessionToken,
  getSessionCookieFromRequest,
  type SessionPayload,
} from './session-token';

export {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTtlSeconds,
  verifySessionToken,
  getSessionCookieFromRequest,
  getSessionPayloadFromRequest,
  type SessionPayload,
} from './session-token';

export type AuthUser = AppUser & { sessionId: string };

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function sessionExists(sid: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now() AND u.is_active = true`,
    [sid]
  );
  return rows.length > 0;
}

export async function createSession(user: AppUser): Promise<{
  token: string;
  maxAge: number;
}> {
  const pool = getPool();
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const maxAge = sessionTtlSeconds();
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO app_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [user.id, tokenHash, expiresAt]
  );
  const sid = rows[0].id;
  const exp = Math.floor(expiresAt.getTime() / 1000);
  const jwt = await signSessionPayload(
    { sub: user.id, role: user.role, sid },
    exp
  );
  return { token: jwt, maxAge };
}

export async function destroySession(sid: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM app_sessions WHERE id = $1', [sid]);
}

export async function getSessionFromRequest(
  request: Request,
  options?: { requireDb?: boolean }
): Promise<AuthUser | null> {
  const token = getSessionCookieFromRequest(request);
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  if (options?.requireDb) {
    const exists = await sessionExists(payload.sid);
    if (!exists) return null;
  }

  const user = await findUserById(payload.sub);
  if (!user || !user.is_active) return null;
  if (user.role !== payload.role) return null;

  return { ...user, sessionId: payload.sid };
}

export async function getSessionFromCookies(
  options?: { requireDb?: boolean }
): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  if (options?.requireDb) {
    const exists = await sessionExists(payload.sid);
    if (!exists) return null;
  }

  const user = await findUserById(payload.sub);
  if (!user || !user.is_active) return null;
  if (user.role !== payload.role) return null;

  return { ...user, sessionId: payload.sid };
}
