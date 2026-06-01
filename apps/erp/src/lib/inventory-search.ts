import { getPool } from './db';

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
};

export type InventoryItemRow = {
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

function parseSort(sort?: string): { column: string; direction: 'ASC' | 'DESC' } {
  const defaultSort = { column: 'v.value', direction: 'DESC' as const };
  if (!sort) return defaultSort;
  const [key, dir] = sort.split('_');
  const direction = dir === 'asc' ? 'ASC' : 'DESC';
  const map: Record<string, string> = {
    value: 'v.value',
    qty: 'v.quantity',
    name: 'v.item_name',
    sku: 'v.primary_sku',
    group: 'v.stock_group_name',
  };
  const column = map[key ?? 'value'] ?? 'v.value';
  return { column, direction };
}

function buildStatusClause(status: StockStatus, paramIndex: number): string {
  if (status === 'out_of_stock') {
    return `AND COALESCE(v.quantity, 0) <= 0`;
  }
  if (status === 'low_stock') {
    return `AND COALESCE(v.quantity, 0) > 0 AND COALESCE(v.quantity, 0) < 10`;
  }
  if (status === 'in_stock') {
    return `AND COALESCE(v.quantity, 0) >= 10`;
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
    sql += buildStatusClause(params.status, idx);
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
      MAX(l.imported_at) AS imported_at
    FROM latest l
    JOIN inventory_balances ib ON ib.snapshot_id = l.snapshot_id
    GROUP BY l.code, l.name, l.location_name, l.imported_at
    ORDER BY total_value DESC
  `);
  return rows as {
    code: string;
    name: string;
    location_name: string;
    slug: string;
    sku_count: number;
    total_value: string;
    imported_at: Date;
  }[];
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
      COUNT(*) FILTER (
        WHERE COALESCE(v.quantity, 0) > 0 AND COALESCE(v.quantity, 0) < 10
      )::int AS low_stock
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
  const { column, direction } = parseSort(params.sort);

  const { sql: filterSql, values: filterValues } = buildFilterClause(params, 2);

  const queryValues = [categoryCode, ...filterValues, pageSize, offset];

  const { rows } = await pool.query(
    `
    ${LATEST_SNAPSHOT_CTE}
    SELECT
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
    ORDER BY ${column} ${direction} NULLS LAST, v.item_name ASC
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
  const { column, direction } = parseSort(params.sort);
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
    ORDER BY ${column} ${direction} NULLS LAST, v.item_name ASC
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

export function stockStatusLabel(qty: number): string {
  if (qty <= 0) return 'Out of stock';
  if (qty < 10) return 'Low stock';
  return 'In stock';
}
