import { getPool } from './db';

let cachedCompanyId: string | null = null;

export async function getDefaultCompanyId(): Promise<string> {
  if (cachedCompanyId) return cachedCompanyId;
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id FROM companies WHERE is_active = true ORDER BY created_at LIMIT 1`
  );
  if (rows.length === 0) throw new Error('No company configured');
  cachedCompanyId = rows[0].id as string;
  return cachedCompanyId;
}
