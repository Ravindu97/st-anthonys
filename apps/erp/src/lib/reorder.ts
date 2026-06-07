import { getPool } from './db';
import { DEFAULT_REORDER_MIN } from './reorder-sql';

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
  category_name?: string;
  vendor_slug?: string;
};

export type PurchaseSuggestion = {
  id: string;
  stock_item_id: string;
  location_id: string;
  current_qty: string;
  min_qty: string;
  suggested_qty: string;
  user_adjusted_qty: string | null;
  status: string;
  notes: string | null;
  dismissed_note: string | null;
  rate_at_scan: string | null;
  estimated_value: string | null;
  snapshot_imported_at: Date | null;
  created_at: Date;
  item_name: string;
  primary_sku: string | null;
  location_name: string;
  category_name: string;
  category_code: string;
  vendor_slug: string;
};

export type ReorderWorkbenchLine = {
  stock_item_id: string;
  location_id: string;
  primary_sku: string | null;
  item_name: string;
  category_code: string;
  category_name: string;
  vendor_slug: string;
  location_name: string;
  current_qty: number;
  min_qty: number | null;
  reorder_qty: number | null;
  gap_qty: number;
  suggested_qty: number;
  rate: number | null;
  estimated_value: number;
  has_rule: boolean;
  has_category_default: boolean;
  needs_rule: boolean;
  suggestion_id: string | null;
  suggestion_status: string | null;
  snapshot_imported_at: Date | null;
  reorder_rule_id: string | null;
};

export type ReorderWorkbenchSummary = {
  items_below_min: number;
  estimated_value_at_risk: number;
  draft_count: number;
  approved_count: number;
  needs_rule_count: number;
  last_scan_at: Date | null;
  oldest_snapshot_days: number | null;
};

const MAIN_LOCATION_FILTER = `loc.location_type = 'main'`;

/** Effective min/reorder from item rule or category default */
const EFFECTIVE_MIN_SQL = `COALESCE(rr.min_qty, rcd.default_min_qty)`;
const EFFECTIVE_REORDER_SQL = `COALESCE(rr.reorder_qty, rcd.default_reorder_qty)`;

export async function listReorderRules(opts?: {
  stockItemId?: string;
  locationId?: string;
  categoryCode?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const pool = getPool();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
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
  if (opts?.categoryCode) {
    values.push(opts.categoryCode);
    where += ` AND cat.code = $${values.length}`;
  }
  if (opts?.q?.trim()) {
    values.push(`%${opts.q.trim()}%`);
    where += ` AND (si.name ILIKE $${values.length} OR a.alias ILIKE $${values.length} OR cat.name ILIKE $${values.length})`;
  }
  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT
       rr.*,
       si.name AS item_name,
       loc.name AS location_name,
       cat.name AS category_name,
       LOWER(cat.code) AS vendor_slug,
       a.alias AS primary_sku,
       COUNT(*) OVER()::int AS total_count
     FROM reorder_rules rr
     JOIN stock_items si ON si.id = rr.stock_item_id
     JOIN stock_categories cat ON cat.id = si.category_id
     JOIN locations loc ON loc.id = rr.location_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases
       WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     ${where}
     ORDER BY cat.name, si.name, loc.name
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...item }) => item) as ReorderRule[];
  return { items, totalCount, page, pageSize };
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

export async function listCategoryDefaults() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT rcd.*, cat.code AS category_code, cat.name AS category_name
     FROM reorder_category_defaults rcd
     JOIN stock_categories cat ON cat.id = rcd.category_id
     ORDER BY cat.name`
  );
  return rows;
}

export async function upsertCategoryDefault(input: {
  categoryId: string;
  locationType?: string;
  defaultMinQty: number;
  defaultReorderQty: number;
}) {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO reorder_category_defaults (
       category_id, location_type, default_min_qty, default_reorder_qty
     ) VALUES ($1, $2::location_type, $3, $4)
     ON CONFLICT (category_id, location_type) DO UPDATE SET
       default_min_qty = EXCLUDED.default_min_qty,
       default_reorder_qty = EXCLUDED.default_reorder_qty,
       updated_at = now()
     RETURNING *`,
    [
      input.categoryId,
      input.locationType ?? 'main',
      input.defaultMinQty,
      input.defaultReorderQty,
    ]
  );
  return rows[0];
}

function computeSuggestedQty(currentQty: number, reorderQty: number): number {
  const gap = Math.max(0, reorderQty - currentQty);
  return gap > 0 ? gap : reorderQty;
}

/** Core CTE for latest main-location balances with effective thresholds */
function workbenchBalancesCte(companyFilter: string, paramOffset: number) {
  return `
    WITH latest AS (
      SELECT DISTINCT ON (inv.location_id)
        inv.id AS snapshot_id,
        inv.location_id,
        inv.created_at AS snapshot_imported_at,
        loc.company_id,
        loc.name AS location_name,
        loc.location_type,
        cat.id AS category_id,
        cat.code AS category_code,
        cat.name AS category_name,
        LOWER(cat.code) AS vendor_slug
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      JOIN stock_categories cat ON cat.id = loc.stock_category_id
      JOIN companies c ON c.id = loc.company_id
      WHERE ${MAIN_LOCATION_FILTER} ${companyFilter}
      ORDER BY inv.location_id, inv.created_at DESC
    ),
    balances AS (
      SELECT
        l.company_id,
        l.location_id,
        l.location_name,
        l.snapshot_imported_at,
        l.category_id,
        l.category_code,
        l.category_name,
        l.vendor_slug,
        ib.stock_item_id,
        COALESCE(ib.quantity, 0) AS current_qty,
        ib.rate,
        rr.id AS reorder_rule_id,
        rr.min_qty AS rule_min_qty,
        rr.reorder_qty AS rule_reorder_qty,
        rcd.default_min_qty,
        rcd.default_reorder_qty,
        ${EFFECTIVE_MIN_SQL} AS effective_min_qty,
        ${EFFECTIVE_REORDER_SQL} AS effective_reorder_qty,
        (rr.id IS NOT NULL) AS has_rule,
        (rcd.id IS NOT NULL) AS has_category_default,
        (rr.id IS NULL AND rcd.id IS NULL) AS needs_rule
      FROM latest l
      JOIN inventory_balances ib ON ib.snapshot_id = l.snapshot_id
      LEFT JOIN reorder_rules rr
        ON rr.stock_item_id = ib.stock_item_id
        AND rr.location_id = l.location_id
        AND rr.is_active = true
      LEFT JOIN reorder_category_defaults rcd
        ON rcd.category_id = l.category_id
        AND rcd.location_type = l.location_type
    )
  `;
}

export async function getReorderWorkbench(opts?: {
  companyId?: string;
  tab?: 'action' | 'approved' | 'needs_rule' | 'history';
  vendorCode?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const pool = getPool();
  const tab = opts?.tab ?? 'action';
  const values: unknown[] = [];
  let companyFilter = '';
  if (opts?.companyId) {
    values.push(opts.companyId);
    companyFilter = `AND c.id = $${values.length}`;
  }

  let vendorFilter = '';
  if (opts?.vendorCode) {
    values.push(opts.vendorCode);
    vendorFilter = ` AND b.category_code = $${values.length}`;
  }

  let searchFilter = '';
  if (opts?.q?.trim()) {
    values.push(`%${opts.q.trim()}%`);
    searchFilter = ` AND (si.name ILIKE $${values.length} OR a.alias ILIKE $${values.length} OR b.category_name ILIKE $${values.length})`;
  }

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  values.push(pageSize, offset);

  let tabFilter = '';
  let psJoin = '';
  if (tab === 'action') {
    psJoin = `LEFT JOIN purchase_suggestions ps
      ON ps.stock_item_id = b.stock_item_id AND ps.location_id = b.location_id
      AND ps.status = 'draft'`;
    tabFilter = `
      AND b.effective_min_qty IS NOT NULL
      AND b.current_qty < b.effective_min_qty
      AND NOT b.needs_rule
    `;
  } else if (tab === 'approved') {
    psJoin = `JOIN purchase_suggestions ps
      ON ps.stock_item_id = b.stock_item_id AND ps.location_id = b.location_id
      AND ps.status = 'approved'`;
  } else if (tab === 'needs_rule') {
    psJoin = `LEFT JOIN purchase_suggestions ps ON false`;
    tabFilter = `
      AND b.needs_rule = true
      AND b.current_qty < ${DEFAULT_REORDER_MIN}
    `;
  } else if (tab === 'history') {
    psJoin = `JOIN purchase_suggestions ps
      ON ps.stock_item_id = b.stock_item_id AND ps.location_id = b.location_id
      AND ps.status IN ('converted', 'cancelled')`;
  }

  const cte = workbenchBalancesCte(companyFilter, values.length);

  const { rows } = await pool.query(
    `
    ${cte}
    SELECT
      b.stock_item_id,
      b.location_id,
      a.alias AS primary_sku,
      si.name AS item_name,
      b.category_code,
      b.category_name,
      b.vendor_slug,
      b.location_name,
      b.current_qty,
      b.effective_min_qty AS min_qty,
      b.effective_reorder_qty AS reorder_qty,
      b.rate,
      b.has_rule,
      b.has_category_default,
      b.needs_rule,
      ps.id AS suggestion_id,
      ps.status AS suggestion_status,
      b.snapshot_imported_at,
      b.reorder_rule_id,
      ps.suggested_qty,
      ps.user_adjusted_qty,
      ps.estimated_value,
      COUNT(*) OVER()::int AS total_count
    FROM balances b
    JOIN stock_items si ON si.id = b.stock_item_id
    LEFT JOIN LATERAL (
      SELECT alias FROM stock_item_aliases
      WHERE item_id = si.id AND is_primary = true LIMIT 1
    ) a ON true
    ${psJoin}
    WHERE 1=1 ${tabFilter} ${vendorFilter} ${searchFilter}
    ORDER BY
      b.category_name,
      COALESCE(ps.estimated_value, b.effective_reorder_qty * COALESCE(b.rate, 0)) DESC NULLS LAST,
      si.name
    LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

  const lines: ReorderWorkbenchLine[] = rows.map((r) => {
    const currentQty = Number(r.current_qty);
    const reorderQty = r.reorder_qty != null ? Number(r.reorder_qty) : null;
    const minQty = r.min_qty != null ? Number(r.min_qty) : null;
    const suggestedQty =
      r.user_adjusted_qty != null
        ? Number(r.user_adjusted_qty)
        : r.suggested_qty != null
          ? Number(r.suggested_qty)
          : reorderQty != null
            ? computeSuggestedQty(currentQty, reorderQty)
            : 0;
    const rate = r.rate != null ? Number(r.rate) : null;
    const estimatedValue =
      r.estimated_value != null
        ? Number(r.estimated_value)
        : suggestedQty * (rate ?? 0);

    return {
      stock_item_id: r.stock_item_id,
      location_id: r.location_id,
      primary_sku: r.primary_sku,
      item_name: r.item_name,
      category_code: r.category_code,
      category_name: r.category_name,
      vendor_slug: r.vendor_slug,
      location_name: r.location_name,
      current_qty: currentQty,
      min_qty: minQty,
      reorder_qty: reorderQty,
      gap_qty: minQty != null ? Math.max(0, minQty - currentQty) : 0,
      suggested_qty: suggestedQty,
      rate,
      estimated_value: estimatedValue,
      has_rule: r.has_rule,
      has_category_default: r.has_category_default,
      needs_rule: r.needs_rule,
      suggestion_id: r.suggestion_id,
      suggestion_status: r.suggestion_status,
      snapshot_imported_at: r.snapshot_imported_at,
      reorder_rule_id: r.reorder_rule_id,
    };
  });

  const summary = await getReorderWorkbenchSummary(opts?.companyId);
  return { lines, summary, tab, totalCount, page, pageSize };
}

export async function getReorderWorkbenchSummary(companyId?: string): Promise<ReorderWorkbenchSummary> {
  const pool = getPool();
  const values: unknown[] = [];
  let companyFilter = '';
  if (companyId) {
    values.push(companyId);
    companyFilter = `AND c.id = $${values.length}`;
  }

  const cte = workbenchBalancesCte(companyFilter, values.length);

  const { rows } = await pool.query(
    `
    ${cte},
    below AS (
      SELECT b.*,
        COALESCE(ps.user_adjusted_qty, b.effective_reorder_qty) * COALESCE(b.rate, 0) AS line_value
      FROM balances b
      LEFT JOIN purchase_suggestions ps
        ON ps.stock_item_id = b.stock_item_id AND ps.location_id = b.location_id
        AND ps.status IN ('draft', 'approved')
      WHERE b.effective_min_qty IS NOT NULL AND b.current_qty < b.effective_min_qty
    )
    SELECT
      (SELECT COUNT(*)::int FROM below) AS items_below_min,
      (SELECT COALESCE(SUM(line_value), 0) FROM below) AS estimated_value_at_risk,
      (SELECT COUNT(*)::int FROM purchase_suggestions ps2
       JOIN companies c2 ON c2.id = ps2.company_id
       WHERE ps2.status = 'draft' ${companyId ? `AND ps2.company_id = $1` : ''}) AS draft_count,
      (SELECT COUNT(*)::int FROM purchase_suggestions ps3
       WHERE ps3.status = 'approved' ${companyId ? `AND ps3.company_id = $1` : ''}) AS approved_count,
      (SELECT COUNT(*)::int FROM balances b2 WHERE b2.needs_rule AND b2.current_qty < ${DEFAULT_REORDER_MIN}) AS needs_rule_count,
      (SELECT MAX(scanned_at) FROM reorder_scan_runs ${companyId ? `WHERE company_id = $1` : ''}) AS last_scan_at,
      (SELECT MAX(EXTRACT(DAY FROM now() - snapshot_imported_at))::int FROM latest) AS oldest_snapshot_days
    `,
    values
  );

  const r = rows[0] ?? {};
  return {
    items_below_min: Number(r.items_below_min ?? 0),
    estimated_value_at_risk: Number(r.estimated_value_at_risk ?? 0),
    draft_count: Number(r.draft_count ?? 0),
    approved_count: Number(r.approved_count ?? 0),
    needs_rule_count: Number(r.needs_rule_count ?? 0),
    last_scan_at: r.last_scan_at ?? null,
    oldest_snapshot_days: r.oldest_snapshot_days != null ? Number(r.oldest_snapshot_days) : null,
  };
}

export async function getReorderCountsByVendor(companyId?: string) {
  const pool = getPool();
  const values: unknown[] = [];
  let companyFilter = '';
  if (companyId) {
    values.push(companyId);
    companyFilter = `AND c.id = $${values.length}`;
  }

  const cte = workbenchBalancesCte(companyFilter, values.length);

  const { rows } = await pool.query(
    `
    ${cte}
    SELECT
      b.category_code,
      b.category_name,
      b.vendor_slug,
      COUNT(*)::int AS below_min_count
    FROM balances b
    WHERE b.effective_min_qty IS NOT NULL
      AND b.current_qty < b.effective_min_qty
    GROUP BY b.category_code, b.category_name, b.vendor_slug
    ORDER BY below_min_count DESC
    `,
    values
  );
  return rows as {
    category_code: string;
    category_name: string;
    vendor_slug: string;
    below_min_count: number;
  }[];
}

/** Scan main-location balances; create/update/cancel draft suggestions. */
export async function syncPurchaseSuggestions(companyId?: string) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const companyFilter = companyId ? 'AND c.id = $1' : '';
    const params = companyId ? [companyId] : [];

    const cte = workbenchBalancesCte(companyFilter, params.length);

    const { rows: belowReorder } = await client.query(
      `
      ${cte}
      SELECT
        b.company_id,
        b.location_id,
        b.stock_item_id,
        b.current_qty,
        b.effective_min_qty AS min_qty,
        b.effective_reorder_qty AS reorder_qty,
        b.reorder_rule_id,
        b.rate,
        b.snapshot_imported_at,
        b.has_rule,
        b.has_category_default
      FROM balances b
      WHERE b.effective_min_qty IS NOT NULL
        AND b.current_qty < b.effective_min_qty
        AND (b.has_rule OR b.has_category_default)
      `,
      params
    );

    let created = 0;
    let updated = 0;
    let cancelled = 0;

    for (const row of belowReorder) {
      const currentQty = Number(row.current_qty);
      const minQty = Number(row.min_qty);
      const reorderQty = Number(row.reorder_qty);
      const suggestedQty = computeSuggestedQty(currentQty, reorderQty);
      const rate = row.rate != null ? Number(row.rate) : null;
      const estimatedValue = suggestedQty * (rate ?? 0);

      const { rows: existing } = await client.query(
        `SELECT id, status, current_qty FROM purchase_suggestions
         WHERE stock_item_id = $1 AND location_id = $2
           AND status IN ('draft', 'approved')
         LIMIT 1`,
        [row.stock_item_id, row.location_id]
      );

      if (existing.length > 0) {
        if (existing[0].status === 'draft') {
          await client.query(
            `UPDATE purchase_suggestions SET
               current_qty = $2, min_qty = $3, suggested_qty = $4,
               rate_at_scan = $5, estimated_value = $6,
               snapshot_imported_at = $7, updated_at = now()
             WHERE id = $1`,
            [
              existing[0].id,
              currentQty,
              minQty,
              suggestedQty,
              rate,
              estimatedValue,
              row.snapshot_imported_at,
            ]
          );
          updated++;
        }
        continue;
      }

      await client.query(
        `INSERT INTO purchase_suggestions (
           company_id, stock_item_id, location_id, reorder_rule_id,
           current_qty, min_qty, suggested_qty, status,
           rate_at_scan, estimated_value, snapshot_imported_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10)`,
        [
          row.company_id,
          row.stock_item_id,
          row.location_id,
          row.reorder_rule_id,
          currentQty,
          minQty,
          suggestedQty,
          rate,
          estimatedValue,
          row.snapshot_imported_at,
        ]
      );
      created++;
    }

    // Cancel draft suggestions where stock recovered
    const { rows: recovered } = await client.query(
      `
      ${cte}
      SELECT ps.id
      FROM purchase_suggestions ps
      JOIN balances b
        ON b.stock_item_id = ps.stock_item_id AND b.location_id = ps.location_id
      WHERE ps.status = 'draft'
        ${companyId ? 'AND ps.company_id = $1' : ''}
        AND b.effective_min_qty IS NOT NULL
        AND b.current_qty >= b.effective_min_qty
      `,
      params
    );

    for (const r of recovered) {
      await client.query(
        `UPDATE purchase_suggestions SET status = 'cancelled', dismissed_note = 'Stock recovered above min', updated_at = now()
         WHERE id = $1`,
        [r.id]
      );
      cancelled++;
    }

    if (companyId) {
      await client.query(
        `INSERT INTO reorder_scan_runs (
           company_id, items_below_min, suggestions_created, suggestions_updated, suggestions_cancelled
         ) VALUES ($1, $2, $3, $4, $5)`,
        [companyId, belowReorder.length, created, updated, cancelled]
      );
    }

    await client.query('COMMIT');
    return { created, updated, cancelled, scanned: belowReorder.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function createSuggestionForItem(input: {
  companyId: string;
  stockItemId: string;
  locationId: string;
}) {
  const pool = getPool();

  const { rows: bal } = await pool.query(
    `
    WITH latest AS (
      SELECT inv.id AS snapshot_id, inv.created_at AS snapshot_imported_at
      FROM inventory_snapshots inv
      WHERE inv.location_id = $2
      ORDER BY inv.created_at DESC LIMIT 1
    )
    SELECT ib.quantity, ib.rate, l.snapshot_imported_at, loc.company_id
    FROM inventory_balances ib
    JOIN latest l ON l.snapshot_id = ib.snapshot_id
    JOIN locations loc ON loc.id = $2
    WHERE ib.stock_item_id = $1
    `,
    [input.stockItemId, input.locationId]
  );
  if (bal.length === 0) return { ok: false as const, error: 'No balance found' };

  const { rows: rule } = await pool.query(
    `SELECT
       COALESCE(rr.id, NULL) AS id,
       COALESCE(rr.min_qty, rcd.default_min_qty) AS min_qty,
       COALESCE(rr.reorder_qty, rcd.default_reorder_qty) AS reorder_qty
     FROM stock_items si
     JOIN locations loc ON loc.id = $2
     LEFT JOIN reorder_rules rr
       ON rr.stock_item_id = si.id AND rr.location_id = loc.id AND rr.is_active
     LEFT JOIN reorder_category_defaults rcd
       ON rcd.category_id = si.category_id AND rcd.location_type = loc.location_type
     WHERE si.id = $1
       AND (rr.id IS NOT NULL OR rcd.id IS NOT NULL)`,
    [input.stockItemId, input.locationId]
  );
  if (rule.length === 0) {
    return { ok: false as const, error: 'No reorder rule or category default — set a min qty first' };
  }

  const currentQty = Number(bal[0].quantity ?? 0);
  const minQty = Number(rule[0].min_qty);
  const reorderQty = Number(rule[0].reorder_qty);
  const suggestedQty = computeSuggestedQty(currentQty, reorderQty);
  const rate = bal[0].rate != null ? Number(bal[0].rate) : null;

  const { rows: existing } = await pool.query(
    `SELECT id FROM purchase_suggestions
     WHERE stock_item_id = $1 AND location_id = $2 AND status IN ('draft', 'approved')`,
    [input.stockItemId, input.locationId]
  );
  if (existing.length > 0) {
    return { ok: true as const, id: existing[0].id, existing: true };
  }

  const { rows } = await pool.query(
    `INSERT INTO purchase_suggestions (
       company_id, stock_item_id, location_id, reorder_rule_id,
       current_qty, min_qty, suggested_qty, status,
       rate_at_scan, estimated_value, snapshot_imported_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10)
     RETURNING id`,
    [
      input.companyId,
      input.stockItemId,
      input.locationId,
      rule[0].id,
      currentQty,
      minQty,
      suggestedQty,
      rate,
      suggestedQty * (rate ?? 0),
      bal[0].snapshot_imported_at,
    ]
  );
  return { ok: true as const, id: rows[0].id };
}

export async function listPurchaseSuggestions(opts?: {
  status?: string;
  page?: number;
  pageSize?: number;
  vendorCode?: string;
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
  if (opts?.vendorCode) {
    values.push(opts.vendorCode);
    statusFilter += ` AND cat.code = $${values.length}`;
  }
  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT
       ps.*,
       si.name AS item_name,
       a.alias AS primary_sku,
       loc.name AS location_name,
       cat.name AS category_name,
       cat.code AS category_code,
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
     ORDER BY ps.estimated_value DESC NULLS LAST, ps.created_at DESC
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
  userId?: string,
  dismissedNote?: string
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE purchase_suggestions SET
       status = $2::purchase_suggestion_status,
       updated_at = now(),
       dismissed_note = COALESCE($4, dismissed_note),
       approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
       approved_by = CASE WHEN $2 = 'approved' THEN $3::uuid ELSE approved_by END
     WHERE id = $1
     RETURNING *`,
    [id, status, userId ?? null, dismissedNote ?? null]
  );
  return rows[0] ?? null;
}

export async function updateSuggestionQty(id: string, qty: number) {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE purchase_suggestions SET
       user_adjusted_qty = $2,
       suggested_qty = $2,
       estimated_value = $2 * COALESCE(rate_at_scan, 0),
       updated_at = now()
     WHERE id = $1 AND status IN ('draft', 'approved')
     RETURNING *`,
    [id, qty]
  );
  return rows[0] ?? null;
}

export async function bulkUpdateSuggestionStatus(
  ids: string[],
  status: 'approved' | 'cancelled',
  userId?: string
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE purchase_suggestions SET
       status = $2::purchase_suggestion_status,
       updated_at = now(),
       approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
       approved_by = CASE WHEN $2 = 'approved' THEN $3::uuid ELSE approved_by END
     WHERE id = ANY($1::uuid[]) AND status = 'draft'
     RETURNING id`,
    [ids, status, userId ?? null]
  );
  return rows.length;
}

export async function getReorderAlertCount(): Promise<number> {
  const summary = await getReorderWorkbenchSummary();
  return summary.items_below_min;
}

export async function getLocationIdForItemCategory(
  stockItemId: string
): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT loc.id
     FROM stock_items si
     JOIN locations loc ON loc.stock_category_id = si.category_id
     WHERE si.id = $1 AND loc.location_type = 'main'
     LIMIT 1`,
    [stockItemId]
  );
  return rows[0]?.id ?? null;
}
