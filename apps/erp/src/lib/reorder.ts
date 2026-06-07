import { getPool } from './db';
import { LOW_STOCK_LINE_SQL } from './reorder-sql';

export type ReorderRule = {
  id: string;
  stock_item_id: string;
  location_id: string;
  min_qty: string;
  reorder_qty: string;
  lead_time_days: number;
  is_active: boolean;
  item_name?: string;
  location_name?: string;
  primary_sku?: string;
};

export type PurchaseSuggestion = {
  id: string;
  stock_item_id: string;
  location_id: string;
  current_qty: string;
  min_qty: string;
  suggested_qty: string;
  status: string;
  notes: string | null;
  created_at: Date;
  item_name: string;
  primary_sku: string | null;
  location_name: string;
  category_name: string;
  vendor_slug: string;
};

export async function listReorderRules(opts?: {
  stockItemId?: string;
  locationId?: string;
}) {
  const pool = getPool();
  const values: unknown[] = [];
  let where = 'WHERE rr.is_active = true';
  if (opts?.stockItemId) {
    values.push(opts.stockItemId);
    where += ` AND rr.stock_item_id = $${values.length}`;
  }
  if (opts?.locationId) {
    values.push(opts.locationId);
    where += ` AND rr.location_id = $${values.length}`;
  }

  const { rows } = await pool.query(
    `SELECT
       rr.*,
       si.name AS item_name,
       loc.name AS location_name,
       a.alias AS primary_sku
     FROM reorder_rules rr
     JOIN stock_items si ON si.id = rr.stock_item_id
     JOIN locations loc ON loc.id = rr.location_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases
       WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     ${where}
     ORDER BY si.name, loc.name`,
    values
  );
  return rows as ReorderRule[];
}

export async function upsertReorderRule(input: {
  stockItemId: string;
  locationId: string;
  minQty: number;
  reorderQty: number;
  leadTimeDays?: number;
}) {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO reorder_rules (
       stock_item_id, location_id, min_qty, reorder_qty, lead_time_days
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (stock_item_id, location_id) DO UPDATE SET
       min_qty = EXCLUDED.min_qty,
       reorder_qty = EXCLUDED.reorder_qty,
       lead_time_days = EXCLUDED.lead_time_days,
       is_active = true,
       updated_at = now()
     RETURNING *`,
    [
      input.stockItemId,
      input.locationId,
      input.minQty,
      input.reorderQty,
      input.leadTimeDays ?? 0,
    ]
  );
  return rows[0] as ReorderRule;
}

/** Scan latest balances and create draft purchase suggestions for items below reorder level. */
export async function syncPurchaseSuggestions(companyId?: string) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const companyFilter = companyId ? 'AND c.id = $1' : '';
    const params = companyId ? [companyId] : [];

    const { rows: belowReorder } = await client.query(
      `
      WITH latest AS (
        SELECT DISTINCT ON (inv.location_id)
          inv.id AS snapshot_id,
          inv.location_id,
          loc.company_id
        FROM inventory_snapshots inv
        JOIN locations loc ON loc.id = inv.location_id
        JOIN companies c ON c.id = loc.company_id
        WHERE 1=1 ${companyFilter}
        ORDER BY inv.location_id, inv.created_at DESC
      ),
      balances AS (
        SELECT
          l.company_id,
          l.location_id,
          ib.stock_item_id,
          COALESCE(ib.quantity, 0) AS current_qty,
          COALESCE(rr.min_qty, 10) AS min_qty,
          COALESCE(rr.reorder_qty, 10) AS reorder_qty,
          rr.id AS reorder_rule_id
        FROM latest l
        JOIN inventory_balances ib ON ib.snapshot_id = l.snapshot_id
        LEFT JOIN reorder_rules rr
          ON rr.stock_item_id = ib.stock_item_id
          AND rr.location_id = l.location_id
          AND rr.is_active = true
        WHERE COALESCE(ib.quantity, 0) < COALESCE(rr.min_qty, 10)
      )
      SELECT * FROM balances
      `,
      params
    );

    let created = 0;
    for (const row of belowReorder) {
      const suggestedQty = Math.max(
        Number(row.reorder_qty) - Number(row.current_qty),
        Number(row.reorder_qty)
      );
      const { rows: existing } = await client.query(
        `SELECT id FROM purchase_suggestions
         WHERE stock_item_id = $1 AND location_id = $2
           AND status IN ('draft', 'approved')
         LIMIT 1`,
        [row.stock_item_id, row.location_id]
      );
      if (existing.length > 0) continue;

      await client.query(
        `INSERT INTO purchase_suggestions (
           company_id, stock_item_id, location_id, reorder_rule_id,
           current_qty, min_qty, suggested_qty, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')`,
        [
          row.company_id,
          row.stock_item_id,
          row.location_id,
          row.reorder_rule_id,
          row.current_qty,
          row.min_qty,
          suggestedQty,
        ]
      );
      created++;
    }

    await client.query('COMMIT');
    return { created, scanned: belowReorder.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listPurchaseSuggestions(opts?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const pool = getPool();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  let statusFilter = '';
  if (opts?.status) {
    values.push(opts.status);
    statusFilter = ` AND ps.status = $${values.length}::purchase_suggestion_status`;
  }
  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT
       ps.*,
       si.name AS item_name,
       a.alias AS primary_sku,
       loc.name AS location_name,
       cat.name AS category_name,
       LOWER(cat.code) AS vendor_slug,
       COUNT(*) OVER()::int AS total_count
     FROM purchase_suggestions ps
     JOIN stock_items si ON si.id = ps.stock_item_id
     JOIN locations loc ON loc.id = ps.location_id
     JOIN stock_categories cat ON cat.id = si.category_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases
       WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     WHERE 1=1 ${statusFilter}
     ORDER BY ps.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...item }) => item) as PurchaseSuggestion[];
  return { items, totalCount, page, pageSize };
}

export async function updatePurchaseSuggestionStatus(
  id: string,
  status: 'approved' | 'cancelled' | 'converted',
  userId?: string
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE purchase_suggestions SET
       status = $2::purchase_suggestion_status,
       updated_at = now(),
       approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
       approved_by = CASE WHEN $2 = 'approved' THEN $3::uuid ELSE approved_by END
     WHERE id = $1
     RETURNING *`,
    [id, status, userId ?? null]
  );
  return rows[0] ?? null;
}

export async function getReorderAlertCount(): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    WITH latest AS (
      SELECT DISTINCT ON (inv.location_id) inv.id AS snapshot_id
      FROM inventory_snapshots inv
      ORDER BY inv.location_id, inv.created_at DESC
    )
    SELECT COUNT(*)::int AS cnt
    FROM v_location_summary v
    JOIN latest l ON l.snapshot_id = v.snapshot_id
    WHERE ${LOW_STOCK_LINE_SQL}
    `
  );
  return Number(rows[0]?.cnt ?? 0);
}
