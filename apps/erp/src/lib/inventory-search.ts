import { getPool } from './db';
import {
  AT_RISK_LINE_SQL,
  IB_AT_RISK_FILTER,
  IB_LOW_STOCK_FILTER,
  IB_REORDER_MIN_SQL,
  LOW_STOCK_LINE_SQL,
  REORDER_MIN_QTY_SQL,
} from './reorder-sql';

export type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
export type InventoryView = 'table' | 'grouped';
export type SortKey = 'value' | 'qty' | 'name' | 'sku' | 'group';

export type InventorySearchParams = {
  q?: string;
  group?: string;
  status?: StockStatus;
  sort?: string;
  page?: number;
  pageSize?: number;
  dataIssues?: 'variance';
};

const LINE_VALUE_SQL = `COALESCE(v.value, v.quantity * v.rate, 0)`;

export type InventoryItemRow = {
  stock_item_id: string;
  stock_group_name: string;
  primary_sku: string | null;
  item_name: string;
  quantity: string | number | null;
  unit_code: string;
  rate: string | number | null;
  value: string | number | null;
};

const LATEST_SNAPSHOT_CTE = `
  WITH snap AS (
    SELECT inv.id AS snapshot_id,
           inv.period_starts_on,
           inv.period_ends_on,
           inv.created_at AS imported_at,
           loc.id AS location_id,
           loc.name AS location_name,
           loc.tally_name AS location_tally_name,
           cat.code AS category_code,
           cat.name AS category_name
    FROM inventory_snapshots inv
    JOIN locations loc ON loc.id = inv.location_id
    JOIN stock_categories cat ON cat.id = loc.stock_category_id
    WHERE cat.code = $1
    ORDER BY inv.created_at DESC
    LIMIT 1
  )
`;

/** Natural order for Tally unit codes like 133-1072, 133-100, MF000-20 */
function skuNaturalOrderSql(direction: 'ASC' | 'DESC'): string {
  const d = direction;
  const missingNum = d === 'ASC' ? '9223372036854775807' : '-1';
  return [
    `COALESCE((regexp_match(COALESCE(v.primary_sku, ''), '^([0-9]+)'))[1]::bigint, ${missingNum}) ${d}`,
    `COALESCE((regexp_match(COALESCE(v.primary_sku, ''), '-([0-9]+)'))[1]::bigint, ${missingNum}) ${d}`,
    `COALESCE(v.primary_sku, '') ${d} NULLS LAST`,
  ].join(', ');
}

function buildOrderBy(sort?: string): string {
  const tieBreak = 'v.item_name ASC';
  if (!sort) return `v.value DESC NULLS LAST, ${tieBreak}`;

  const lastUnderscore = sort.lastIndexOf('_');
  const key = lastUnderscore > 0 ? sort.slice(0, lastUnderscore) : sort;
  const dirToken = lastUnderscore > 0 ? sort.slice(lastUnderscore + 1) : 'desc';
  const direction = dirToken === 'asc' ? 'ASC' : 'DESC';

  if (key === 'sku' || key === 'unit') {
    return `${skuNaturalOrderSql(direction)}, ${tieBreak}`;
  }

  const map: Record<string, string> = {
    value: 'v.value',
    qty: 'v.quantity',
    name: 'v.item_name',
    group: 'v.stock_group_name',
  };
  const column = map[key] ?? 'v.value';
  return `${column} ${direction} NULLS LAST, ${tieBreak}`;
}

function buildStatusClause(status: StockStatus): string {
  if (status === 'out_of_stock') {
    return ` AND COALESCE(v.quantity, 0) <= 0`;
  }
  if (status === 'low_stock') {
    return ` AND ${LOW_STOCK_LINE_SQL}`;
  }
  if (status === 'in_stock') {
    return ` AND COALESCE(v.quantity, 0) >= (${REORDER_MIN_QTY_SQL})`;
  }
  return '';
}

function buildFilterClause(
  params: InventorySearchParams,
  startIndex: number
): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  let idx = startIndex;
  let sql = '';

  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    sql += ` AND (
      v.primary_sku ILIKE $${idx}
      OR v.item_name ILIKE $${idx}
      OR v.stock_group_name ILIKE $${idx}
    )`;
    values.push(term);
    idx++;
  }

  if (params.group) {
    sql += ` AND v.stock_group_name = $${idx}`;
    values.push(params.group);
    idx++;
  }

  if (params.status && params.status !== 'all') {
    sql += buildStatusClause(params.status);
  }

  if (params.dataIssues === 'variance') {
    sql += ` AND v.value_variance = true`;
  }

  return { sql, values };
}

export async function resolveVendorCode(slug: string): Promise<{
  code: string;
  name: string;
} | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT code, name FROM stock_categories WHERE LOWER(code) = LOWER($1)`,
    [slug.replace(/-/g, '_')]
  );
  if (rows.length === 0) {
    const { rows: byName } = await pool.query(
      `SELECT code, name FROM stock_categories
       WHERE LOWER(REPLACE(name, ' ', '_')) = LOWER($1)
          OR LOWER(name) = LOWER($1)`,
      [slug.replace(/_/g, ' ')]
    );
    if (byName.length === 0) return null;
    return { code: byName[0].code, name: byName[0].name };
  }
  return { code: rows[0].code, name: rows[0].name };
}

export async function vendorHasSnapshot(categoryCode: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    SELECT 1
    FROM inventory_snapshots inv
    JOIN locations loc ON loc.id = inv.location_id
    JOIN stock_categories cat ON cat.id = loc.stock_category_id
    WHERE cat.code = $1
    LIMIT 1
    `,
    [categoryCode]
  );
  return rows.length > 0;
}

export async function getVendorSnapshotMeta(categoryCode: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    ${LATEST_SNAPSHOT_CTE}
    SELECT
      s.snapshot_id,
      s.location_name,
      s.location_tally_name,
      s.category_name,
      s.period_starts_on,
      s.period_ends_on,
      s.imported_at
    FROM snap s
    `,
    [categoryCode]
  );
  return rows[0] ?? null;
}

export async function getActiveVendors() {
  const pool = getPool();
  const { rows } = await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (inv.location_id)
        inv.id AS snapshot_id,
        inv.location_id,
        inv.created_at AS imported_at,
        loc.tally_name AS location_name,
        cat.code,
        cat.name
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      JOIN stock_categories cat ON cat.id = loc.stock_category_id
      ORDER BY inv.location_id, inv.created_at DESC
    )
    SELECT
      l.code,
      l.name,
      l.location_name,
      LOWER(l.code) AS slug,
      COUNT(ib.id)::int AS sku_count,
      COALESCE(SUM(ib.value), 0) AS total_value,
      COUNT(*) FILTER (WHERE ${IB_LOW_STOCK_FILTER})::int AS low_stock,
      COUNT(*) FILTER (WHERE COALESCE(ib.quantity, 0) <= 0)::int AS out_of_stock,
      COUNT(*) FILTER (
        WHERE COALESCE(ib.quantity, 0) >= ${IB_REORDER_MIN_SQL}
      )::int AS in_stock,
      COALESCE(SUM(
        COALESCE(ib.value, ib.quantity * ib.rate, 0)
      ) FILTER (WHERE ${IB_AT_RISK_FILTER}), 0) AS at_risk_value,
      MAX(l.imported_at) AS imported_at
    FROM latest l
    JOIN inventory_balances ib ON ib.snapshot_id = l.snapshot_id
    LEFT JOIN reorder_rules rr
      ON rr.stock_item_id = ib.stock_item_id
      AND rr.location_id = l.location_id
      AND rr.is_active = true
    GROUP BY l.code, l.name, l.location_name, l.imported_at
    ORDER BY total_value DESC
  `);
  return rows.map((r) => ({
    ...r,
    risk_pct:
      Number(r.total_value) > 0
        ? Math.round((Number(r.at_risk_value) / Number(r.total_value)) * 100)
        : 0,
  })) as {
    code: string;
    name: string;
    location_name: string;
    slug: string;
    sku_count: number;
    total_value: string;
    low_stock: number;
    out_of_stock: number;
    in_stock: number;
    at_risk_value: string;
    risk_pct: number;
    imported_at: Date;
  }[];
}

export async function getInventoryHubSummary() {
  const vendors = await getActiveVendors();
  const total_value = vendors.reduce((s, v) => s + Number(v.total_value), 0);
  const at_risk_value = vendors.reduce((s, v) => s + Number(v.at_risk_value), 0);
  return {
    vendor_count: vendors.length,
    sku_count: vendors.reduce((s, v) => s + Number(v.sku_count), 0),
    total_value,
    low_stock: vendors.reduce((s, v) => s + Number(v.low_stock), 0),
    out_of_stock: vendors.reduce((s, v) => s + Number(v.out_of_stock), 0),
    in_stock: vendors.reduce((s, v) => s + Number(v.in_stock), 0),
    at_risk_value,
    at_risk_pct: total_value > 0 ? Math.round((at_risk_value / total_value) * 100) : 0,
    variance_count: await getVarianceCount(),
    vendors,
  };
}

export async function getVendorKpis(
  categoryCode: string,
  params: Pick<InventorySearchParams, 'q' | 'group' | 'status'> = {}
) {
  const pool = getPool();
  const { sql: filterSql, values: filterValues } = buildFilterClause(
    params,
    2
  );

  const { rows } = await pool.query(
    `
    ${LATEST_SNAPSHOT_CTE}
    SELECT
      COUNT(*)::int AS sku_count,
      COALESCE(SUM(v.value), 0) AS total_value,
      COUNT(*) FILTER (WHERE COALESCE(v.quantity, 0) <= 0)::int AS out_of_stock,
      COUNT(*) FILTER (WHERE ${LOW_STOCK_LINE_SQL})::int AS low_stock
    FROM v_location_summary v
    JOIN snap s ON s.snapshot_id = v.snapshot_id
    WHERE 1=1 ${filterSql}
    `,
    [categoryCode, ...filterValues]
  );
  return rows[0] as {
    sku_count: number;
    total_value: string;
    out_of_stock: number;
    low_stock: number;
  };
}

export async function searchInventoryItems(
  categoryCode: string,
  params: InventorySearchParams
) {
  const pool = getPool();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, params.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const orderBy = buildOrderBy(params.sort);

  const { sql: filterSql, values: filterValues } = buildFilterClause(params, 2);

  const queryValues = [categoryCode, ...filterValues, pageSize, offset];

  const { rows } = await pool.query(
    `
    ${LATEST_SNAPSHOT_CTE}
    SELECT
      v.stock_item_id,
      v.stock_group_name,
      v.primary_sku,
      v.item_name,
      v.quantity,
      v.unit_code,
      v.rate,
      v.value,
      COUNT(*) OVER()::int AS total_count
    FROM v_location_summary v
    JOIN snap s ON s.snapshot_id = v.snapshot_id
    WHERE 1=1 ${filterSql}
    ORDER BY ${orderBy}
    LIMIT $${queryValues.length - 1} OFFSET $${queryValues.length}
    `,
    queryValues
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...item }) => item) as InventoryItemRow[];

  return { items, totalCount, page, pageSize };
}

export async function exportInventoryItems(
  categoryCode: string,
  params: Omit<InventorySearchParams, 'page' | 'pageSize'>
) {
  const pool = getPool();
  const orderBy = buildOrderBy(params.sort);
  const { sql: filterSql, values: filterValues } = buildFilterClause(params, 2);

  const { rows } = await pool.query(
    `
    ${LATEST_SNAPSHOT_CTE}
    SELECT
      v.primary_sku,
      v.item_name,
      v.stock_group_name,
      v.quantity,
      v.unit_code,
      v.rate,
      v.value
    FROM v_location_summary v
    JOIN snap s ON s.snapshot_id = v.snapshot_id
    WHERE 1=1 ${filterSql}
    ORDER BY ${orderBy}
    LIMIT 50000
    `,
    [categoryCode, ...filterValues]
  );

  return rows;
}

export async function getGroupRollupsForVendor(categoryCode: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    ${LATEST_SNAPSHOT_CTE}
    SELECT
      g.group_name,
      g.total_quantity,
      g.total_value,
      g.item_count
    FROM v_group_balances g
    JOIN snap s ON s.snapshot_id = g.snapshot_id
    ORDER BY g.total_value DESC NULLS LAST
    `,
    [categoryCode]
  );
  return rows as {
    group_name: string;
    total_quantity: string;
    total_value: string;
    item_count: number;
  }[];
}

export function stockStatusLabel(qty: number, minQty = 10): string {
  if (qty <= 0) return 'Out of stock';
  if (qty < minQty) return 'Low stock';
  return 'In stock';
}

export async function getVarianceCount(categoryCode?: string) {
  const pool = getPool();
  if (categoryCode) {
    const { rows } = await pool.query(
      `
      ${LATEST_SNAPSHOT_CTE}
      SELECT COUNT(*)::int AS count
      FROM v_location_summary v
      JOIN snap s ON s.snapshot_id = v.snapshot_id
      WHERE v.value_variance = true
      `,
      [categoryCode]
    );
    return Number(rows[0]?.count ?? 0);
  }
  const { rows } = await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (inv.location_id)
        inv.id AS snapshot_id
      FROM inventory_snapshots inv
      ORDER BY inv.location_id, inv.created_at DESC
    )
    SELECT COUNT(*)::int AS count
    FROM v_location_summary v
    JOIN latest l ON l.snapshot_id = v.snapshot_id
    WHERE v.value_variance = true
  `);
  return Number(rows[0]?.count ?? 0);
}

export async function getPortfolioGroupMix(limit = 8) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    WITH latest AS (
      SELECT DISTINCT ON (inv.location_id)
        inv.id AS snapshot_id,
        cat.name AS vendor_name
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      JOIN stock_categories cat ON cat.id = loc.stock_category_id
      ORDER BY inv.location_id, inv.created_at DESC
    )
    SELECT
      g.group_name,
      SUM(g.total_value)::numeric AS total_value,
      SUM(g.item_count)::int AS item_count
    FROM v_group_balances g
    JOIN latest l ON l.snapshot_id = g.snapshot_id
    GROUP BY g.group_name
    ORDER BY total_value DESC NULLS LAST
    LIMIT $1
    `,
    [limit]
  );
  const total = rows.reduce((s, r) => s + Number(r.total_value), 0);
  return rows.map((r) => ({
    group_name: r.group_name as string,
    total_value: r.total_value as string,
    item_count: r.item_count as number,
    share_pct: total > 0 ? Math.round((Number(r.total_value) / total) * 100) : 0,
  }));
}

export async function getParetoStats(categoryCode: string, limit = 20) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    ${LATEST_SNAPSHOT_CTE},
    ranked AS (
      SELECT
        v.primary_sku,
        v.item_name,
        ${LINE_VALUE_SQL} AS line_value,
        SUM(${LINE_VALUE_SQL}) OVER () AS portfolio_value,
        SUM(${LINE_VALUE_SQL}) OVER (
          ORDER BY ${LINE_VALUE_SQL} DESC NULLS LAST
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_value
      FROM v_location_summary v
      JOIN snap s ON s.snapshot_id = v.snapshot_id
    )
    SELECT
      COUNT(*)::int AS total_skus,
      COALESCE(MAX(portfolio_value), 0) AS total_value,
      COALESCE(
        (
          SELECT ROUND((running_value / NULLIF(portfolio_value, 0)) * 100)
          FROM ranked
          ORDER BY line_value DESC NULLS LAST
          OFFSET $2 LIMIT 1
        ),
        0
      )::int AS top_share_pct
    FROM ranked
    `,
    [categoryCode, Math.max(0, limit - 1)]
  );
  const r = rows[0];
  return {
    limit,
    total_skus: Number(r?.total_skus ?? 0),
    total_value: Number(r?.total_value ?? 0),
    top_share_pct: Number(r?.top_share_pct ?? 0),
  };
}

export async function getGroupHealth(categoryCode: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    ${LATEST_SNAPSHOT_CTE}
    SELECT
      v.stock_group_name AS group_name,
      COUNT(*)::int AS sku_count,
      COALESCE(SUM(${LINE_VALUE_SQL}), 0) AS total_value,
      COUNT(*) FILTER (WHERE COALESCE(v.quantity, 0) <= 0)::int AS out_of_stock,
      COUNT(*) FILTER (WHERE ${LOW_STOCK_LINE_SQL})::int AS low_stock,
      COALESCE(SUM(${LINE_VALUE_SQL}) FILTER (WHERE ${AT_RISK_LINE_SQL}), 0) AS at_risk_value
    FROM v_location_summary v
    JOIN snap s ON s.snapshot_id = v.snapshot_id
    GROUP BY v.stock_group_name
    ORDER BY at_risk_value DESC NULLS LAST, total_value DESC NULLS LAST
    `,
    [categoryCode]
  );
  return rows as {
    group_name: string;
    sku_count: number;
    total_value: string;
    out_of_stock: number;
    low_stock: number;
    at_risk_value: string;
  }[];
}

export async function getPriorityWatchlist(categoryCode: string, limit = 15) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    ${LATEST_SNAPSHOT_CTE}
    SELECT
      v.stock_item_id,
      v.primary_sku,
      v.item_name,
      v.stock_group_name,
      v.quantity,
      v.unit_code,
      ${LINE_VALUE_SQL} AS line_value,
      CASE
        WHEN COALESCE(v.quantity, 0) <= 0 THEN 'out_of_stock'
        ELSE 'low_stock'
      END AS alert_status
    FROM v_location_summary v
    JOIN snap s ON s.snapshot_id = v.snapshot_id
    WHERE ${AT_RISK_LINE_SQL}
    ORDER BY line_value DESC NULLS LAST, v.item_name ASC
    LIMIT $2
    `,
    [categoryCode, limit]
  );
  return rows as {
    stock_item_id: string;
    primary_sku: string | null;
    item_name: string;
    stock_group_name: string;
    quantity: string | number | null;
    unit_code: string;
    line_value: string;
    alert_status: 'low_stock' | 'out_of_stock';
  }[];
}

export type CrossVendorAlertRow = {
  vendor_code: string;
  vendor_name: string;
  vendor_slug: string;
  stock_item_id: string;
  primary_sku: string | null;
  item_name: string;
  stock_group_name: string;
  quantity: string | number | null;
  unit_code: string;
  line_value: string;
  alert_status: 'low_stock' | 'out_of_stock' | 'variance';
};

export type UnitStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export type InventoryUnitDetail = {
  stock_item_id: string;
  balance_id: string;
  primary_sku: string | null;
  item_name: string;
  tally_name: string | null;
  stock_group_name: string;
  category_name: string;
  unit_code: string;
  quantity: string | number | null;
  rate: string | number | null;
  value: string | number | null;
  computed_value: string | number | null;
  value_variance: boolean;
  line_value: string;
  stock_status: UnitStockStatus;
  has_variance_alert: boolean;
  vendor_code: string;
  vendor_name: string;
  vendor_slug: string;
  location_name: string;
  period_starts_on: Date | string;
  period_ends_on: Date | string;
  imported_at: Date | string;
  previous_quantity: number | null;
  location_id: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isStockItemUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function searchCrossVendorAlerts(params: {
  tab: 'low' | 'out' | 'variance' | 'new_outs' | 'all';
  page?: number;
  pageSize?: number;
}) {
  const pool = getPool();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, params.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  if (params.tab === 'new_outs') {
    return searchNewOutsSincePreviousImport(page, pageSize, offset);
  }

  let statusFilter = '';
  if (params.tab === 'low') {
    statusFilter = ` AND ${LOW_STOCK_LINE_SQL}`;
  } else if (params.tab === 'out') {
    statusFilter = ` AND COALESCE(v.quantity, 0) <= 0`;
  } else if (params.tab === 'variance') {
    statusFilter = ` AND v.value_variance = true`;
  } else if (params.tab === 'all') {
    statusFilter = ` AND (${AT_RISK_LINE_SQL} OR v.value_variance = true)`;
  }

  const { rows } = await pool.query(
    `
    WITH latest AS (
      SELECT DISTINCT ON (inv.location_id)
        inv.id AS snapshot_id,
        cat.code AS vendor_code,
        cat.name AS vendor_name,
        LOWER(cat.code) AS vendor_slug
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      JOIN stock_categories cat ON cat.id = loc.stock_category_id
      ORDER BY inv.location_id, inv.created_at DESC
    )
    SELECT
      l.vendor_code,
      l.vendor_name,
      l.vendor_slug,
      v.stock_item_id,
      v.primary_sku,
      v.item_name,
      v.stock_group_name,
      v.quantity,
      v.unit_code,
      ${LINE_VALUE_SQL} AS line_value,
      CASE
        WHEN v.value_variance THEN 'variance'
        WHEN COALESCE(v.quantity, 0) <= 0 THEN 'out_of_stock'
        ELSE 'low_stock'
      END AS alert_status,
      COUNT(*) OVER()::int AS total_count
    FROM v_location_summary v
    JOIN latest l ON l.snapshot_id = v.snapshot_id
    WHERE 1=1 ${statusFilter}
    ORDER BY line_value DESC NULLS LAST, l.vendor_name, v.item_name
    LIMIT $1 OFFSET $2
    `,
    [pageSize, offset]
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...item }) => item) as CrossVendorAlertRow[];
  return { items, totalCount, page, pageSize };
}

async function searchNewOutsSincePreviousImport(
  page: number,
  pageSize: number,
  offset: number
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    WITH ranked_snaps AS (
      SELECT
        inv.id AS snapshot_id,
        inv.location_id,
        cat.code AS vendor_code,
        cat.name AS vendor_name,
        LOWER(cat.code) AS vendor_slug,
        ROW_NUMBER() OVER (
          PARTITION BY inv.location_id ORDER BY inv.created_at DESC
        ) AS rn
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      JOIN stock_categories cat ON cat.id = loc.stock_category_id
    ),
    latest AS (SELECT * FROM ranked_snaps WHERE rn = 1),
    previous AS (SELECT * FROM ranked_snaps WHERE rn = 2),
    cur AS (
      SELECT
        l.vendor_code,
        l.vendor_name,
        l.vendor_slug,
        ib.stock_item_id,
        ib.quantity AS cur_qty,
        ib.value,
        ib.rate
      FROM latest l
      JOIN inventory_balances ib ON ib.snapshot_id = l.snapshot_id
    ),
    prev AS (
      SELECT
        p.vendor_code,
        ib.stock_item_id,
        ib.quantity AS prev_qty
      FROM previous p
      JOIN inventory_balances ib ON ib.snapshot_id = p.snapshot_id
    ),
    new_outs AS (
      SELECT c.*
      FROM cur c
      JOIN prev p ON p.vendor_code = c.vendor_code AND p.stock_item_id = c.stock_item_id
      WHERE COALESCE(p.prev_qty, 0) > 0 AND COALESCE(c.cur_qty, 0) <= 0
    )
    SELECT
      n.vendor_code,
      n.vendor_name,
      n.vendor_slug,
      n.stock_item_id,
      a.alias AS primary_sku,
      si.name AS item_name,
      sg.name AS stock_group_name,
      n.cur_qty AS quantity,
      u.code AS unit_code,
      COALESCE(n.value, n.cur_qty * n.rate, 0) AS line_value,
      'out_of_stock'::text AS alert_status,
      COUNT(*) OVER()::int AS total_count
    FROM new_outs n
    JOIN stock_items si ON si.id = n.stock_item_id
    JOIN stock_groups sg ON sg.id = si.group_id
    JOIN units u ON u.id = si.base_unit_id
    LEFT JOIN LATERAL (
      SELECT alias FROM stock_item_aliases
      WHERE item_id = si.id AND is_primary = true LIMIT 1
    ) a ON true
    ORDER BY line_value DESC NULLS LAST, n.vendor_name, si.name
    LIMIT $1 OFFSET $2
    `,
    [pageSize, offset]
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...item }) => ({
    ...item,
    alert_status: 'out_of_stock' as const,
  })) as CrossVendorAlertRow[];
  return { items, totalCount, page, pageSize };
}

export async function getSnapshotDiffSummary(categoryCode: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    WITH ranked AS (
      SELECT
        inv.id AS snapshot_id,
        inv.created_at,
        ROW_NUMBER() OVER (ORDER BY inv.created_at DESC) AS rn
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      JOIN stock_categories cat ON cat.id = loc.stock_category_id
      WHERE cat.code = $1
    ),
    latest AS (SELECT snapshot_id, created_at FROM ranked WHERE rn = 1),
    previous AS (SELECT snapshot_id, created_at FROM ranked WHERE rn = 2),
    cur AS (
      SELECT ib.stock_item_id, ib.quantity AS qty, ib.value
      FROM inventory_balances ib
      JOIN latest l ON l.snapshot_id = ib.snapshot_id
    ),
    prev AS (
      SELECT ib.stock_item_id, ib.quantity AS qty
      FROM inventory_balances ib
      JOIN previous p ON p.snapshot_id = ib.snapshot_id
    )
    SELECT
      (SELECT created_at FROM latest) AS latest_at,
      (SELECT created_at FROM previous) AS previous_at,
      (
        SELECT COUNT(*)::int FROM cur c
        JOIN prev p ON p.stock_item_id = c.stock_item_id
        WHERE COALESCE(p.qty, 0) > 0 AND COALESCE(c.qty, 0) <= 0
      ) AS new_out_count,
      (
        SELECT COUNT(*)::int FROM cur c
        JOIN prev p ON p.stock_item_id = c.stock_item_id
        WHERE COALESCE(p.qty, 0) <= 0 AND COALESCE(c.qty, 0) > 0
      ) AS restocked_count,
      (
        SELECT COALESCE(SUM(c.value), 0) FROM cur c
      ) - (
        SELECT COALESCE(SUM(ib.value), 0) FROM inventory_balances ib
        JOIN previous p ON p.snapshot_id = ib.snapshot_id
      ) AS value_change
    `,
    [categoryCode]
  );
  const r = rows[0];
  if (!r?.previous_at) {
    return { hasPrevious: false as const };
  }
  return {
    hasPrevious: true as const,
    latest_at: r.latest_at as Date,
    previous_at: r.previous_at as Date,
    new_out_count: Number(r.new_out_count),
    restocked_count: Number(r.restocked_count),
    value_change: Number(r.value_change),
  };
}

export async function getInventoryUnitDetail(
  categoryCode: string,
  unitKey: string
): Promise<InventoryUnitDetail | null> {
  const pool = getPool();
  const decoded = decodeURIComponent(unitKey);
  const byId = isStockItemUuid(decoded);

  const { rows } = await pool.query(
    `
    ${LATEST_SNAPSHOT_CTE},
    ranked AS (
      SELECT
        inv.id AS snapshot_id,
        ROW_NUMBER() OVER (ORDER BY inv.created_at DESC) AS rn
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      JOIN stock_categories cat ON cat.id = loc.stock_category_id
      WHERE cat.code = $1
    ),
    previous_snap AS (SELECT snapshot_id FROM ranked WHERE rn = 2),
    prev_qty AS (
      SELECT ib.stock_item_id, ib.quantity AS previous_quantity
      FROM inventory_balances ib
      JOIN previous_snap ps ON ps.snapshot_id = ib.snapshot_id
    )
    SELECT
      v.stock_item_id,
      v.balance_id,
      v.primary_sku,
      v.item_name,
      v.tally_name,
      v.stock_group_name,
      v.category_name,
      v.unit_code,
      v.quantity,
      v.rate,
      v.value,
      v.computed_value,
      v.value_variance,
      ${LINE_VALUE_SQL} AS line_value,
      CASE
        WHEN COALESCE(v.quantity, 0) <= 0 THEN 'out_of_stock'
        WHEN ${LOW_STOCK_LINE_SQL} THEN 'low_stock'
        ELSE 'in_stock'
      END AS stock_status,
      v.value_variance AS has_variance_alert,
      s.category_code AS vendor_code,
      s.category_name AS vendor_name,
      LOWER(s.category_code) AS vendor_slug,
      s.location_name,
      s.location_id,
      s.period_starts_on,
      s.period_ends_on,
      s.imported_at,
      pq.previous_quantity
    FROM v_location_summary v
    JOIN snap s ON s.snapshot_id = v.snapshot_id
    LEFT JOIN prev_qty pq ON pq.stock_item_id = v.stock_item_id
    WHERE ${byId ? 'v.stock_item_id = $2::uuid' : 'v.primary_sku = $2'}
    LIMIT 1
    `,
    byId ? [categoryCode, decoded] : [categoryCode, decoded]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    ...row,
    previous_quantity:
      row.previous_quantity != null ? Number(row.previous_quantity) : null,
  } as InventoryUnitDetail;
}
