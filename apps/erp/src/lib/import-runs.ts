import { getPool } from './db';

export type ImportRunSummary = {
  id: string;
  source: string;
  file_name: string | null;
  file_hash: string | null;
  status: string;
  imported_at: Date;
  row_counts: Record<string, unknown> | null;
  error_summary: string | null;
};

export async function listImportRuns(limit = 20): Promise<ImportRunSummary[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, source, file_name, file_hash, status, imported_at, row_counts, error_summary
     FROM import_runs
     ORDER BY imported_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows as ImportRunSummary[];
}

export async function getImportRun(id: string): Promise<ImportRunSummary | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, source, file_name, file_hash, status, imported_at, row_counts, error_summary
     FROM import_runs WHERE id = $1`,
    [id]
  );
  return (rows[0] as ImportRunSummary) ?? null;
}

export async function getLatestImportRunForCategory(
  categoryCode: string
): Promise<ImportRunSummary | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    SELECT ir.id, ir.source, ir.file_name, ir.file_hash, ir.status, ir.imported_at,
           ir.row_counts, ir.error_summary
    FROM import_runs ir
    JOIN inventory_snapshots inv ON inv.import_run_id = ir.id
    JOIN locations loc ON loc.id = inv.location_id
    JOIN stock_categories cat ON cat.id = loc.stock_category_id
    WHERE cat.code = $1
    ORDER BY ir.imported_at DESC
    LIMIT 1
    `,
    [categoryCode]
  );
  return (rows[0] as ImportRunSummary) ?? null;
}
