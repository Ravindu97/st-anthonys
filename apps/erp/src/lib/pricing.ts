import { getPool } from './db';
import { netPrice as calcNetPrice } from './pricing-shared';

export type PriceListSummary = {
  id: string;
  price_level_id: string;
  price_level_name: string;
  scope_type: string;
  category_name: string | null;
  group_name: string | null;
  applicable_from: string;
  item_count: number;
  is_current: boolean;
};

export type PriceListDetail = PriceListSummary & {
  scope_category_id: string | null;
  scope_group_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PriceListItemRow = {
  stock_item_id: string;
  item_name: string;
  primary_sku: string | null;
  from_qty: string;
  less_than_qty: string | null;
  rate: string;
  discount_pct: string;
};

export async function listPriceLists(
  companyId?: string,
  opts?: { page?: number; pageSize?: number; levelName?: string }
) {
  const pool = getPool();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  let where = 'WHERE 1=1';

  if (companyId) {
    values.push(companyId);
    where += ` AND pl.company_id = $${values.length}::uuid`;
  }
  if (opts?.levelName?.trim()) {
    values.push(opts.levelName.trim());
    where += ` AND pvl.name = $${values.length}`;
  }

  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `WITH current_lists AS (
       SELECT pl.id,
         ROW_NUMBER() OVER (
           PARTITION BY pl.price_level_id,
             COALESCE(pl.scope_category_id::text, pl.scope_group_id::text, pl.scope_type::text)
           ORDER BY pl.applicable_from DESC
         ) AS rn
       FROM price_lists pl
     )
     SELECT
       pl.id,
       pl.price_level_id,
       pvl.name AS price_level_name,
       pl.scope_type,
       cat.name AS category_name,
       sg.name AS group_name,
       pl.applicable_from,
       COUNT(pli.id)::int AS item_count,
       (cl.rn = 1) AS is_current,
       COUNT(*) OVER()::int AS total_count
     FROM price_lists pl
     JOIN price_levels pvl ON pvl.id = pl.price_level_id
     LEFT JOIN stock_categories cat ON cat.id = pl.scope_category_id
     LEFT JOIN stock_groups sg ON sg.id = pl.scope_group_id
     LEFT JOIN price_list_items pli ON pli.price_list_id = pl.id
     LEFT JOIN current_lists cl ON cl.id = pl.id
     ${where}
     GROUP BY pl.id, pl.price_level_id, pvl.name, pl.scope_type, cat.name, sg.name,
              pl.applicable_from, cl.rn
     ORDER BY pl.applicable_from DESC, pvl.name
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...row }) => row) as PriceListSummary[];
  return { items, totalCount, page, pageSize };
}

export async function getPriceList(id: string): Promise<PriceListDetail | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH current_lists AS (
       SELECT pl.id,
         ROW_NUMBER() OVER (
           PARTITION BY pl.price_level_id,
             COALESCE(pl.scope_category_id::text, pl.scope_group_id::text, pl.scope_type::text)
           ORDER BY pl.applicable_from DESC
         ) AS rn
       FROM price_lists pl
     )
     SELECT
       pl.id,
       pl.price_level_id,
       pvl.name AS price_level_name,
       pl.scope_type,
       pl.scope_category_id,
       pl.scope_group_id,
       cat.name AS category_name,
       sg.name AS group_name,
       pl.applicable_from,
       pl.created_at,
       pl.updated_at,
       COUNT(pli.id)::int AS item_count,
       (cl.rn = 1) AS is_current
     FROM price_lists pl
     JOIN price_levels pvl ON pvl.id = pl.price_level_id
     LEFT JOIN stock_categories cat ON cat.id = pl.scope_category_id
     LEFT JOIN stock_groups sg ON sg.id = pl.scope_group_id
     LEFT JOIN price_list_items pli ON pli.price_list_id = pl.id
     LEFT JOIN current_lists cl ON cl.id = pl.id
     WHERE pl.id = $1::uuid
     GROUP BY pl.id, pl.price_level_id, pvl.name, pl.scope_type, pl.scope_category_id,
              pl.scope_group_id, cat.name, sg.name, pl.applicable_from, pl.created_at,
              pl.updated_at, cl.rn`,
    [id]
  );
  return (rows[0] as PriceListDetail) ?? null;
}

export async function listPriceListItems(
  priceListId: string,
  opts?: { q?: string; page?: number; pageSize?: number }
) {
  const pool = getPool();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [priceListId];
  let where = 'WHERE pli.price_list_id = $1::uuid';

  if (opts?.q?.trim()) {
    values.push(`%${opts.q.trim()}%`);
    const i = values.length;
    where += ` AND (si.name ILIKE $${i} OR a.alias ILIKE $${i})`;
  }

  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT
       pli.stock_item_id,
       si.name AS item_name,
       a.alias AS primary_sku,
       plt.from_qty,
       plt.less_than_qty,
       plt.rate,
       plt.discount_pct,
       COUNT(*) OVER()::int AS total_count
     FROM price_list_items pli
     JOIN stock_items si ON si.id = pli.stock_item_id
     JOIN price_list_tiers plt ON plt.price_list_item_id = pli.id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases
       WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     ${where}
     ORDER BY si.name, plt.from_qty
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...row }) => row) as PriceListItemRow[];
  return { items, totalCount, page, pageSize };
}

/** @deprecated Use listPriceListItems for paginated views */
export async function getPriceListItems(priceListId: string) {
  const { items } = await listPriceListItems(priceListId, { pageSize: 10000 });
  return items;
}

export async function resolveItemPrice(
  stockItemId: string,
  priceLevelId: string,
  quantity: number
): Promise<number | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT plt.rate, plt.discount_pct
     FROM price_list_items pli
     JOIN price_lists pl ON pl.id = pli.price_list_id
     JOIN price_list_tiers plt ON plt.price_list_item_id = pli.id
     WHERE pli.stock_item_id = $1
       AND pl.price_level_id = $2
       AND plt.from_qty <= $3
       AND (plt.less_than_qty IS NULL OR plt.less_than_qty > $3)
     ORDER BY pl.applicable_from DESC, plt.from_qty DESC
     LIMIT 1`,
    [stockItemId, priceLevelId, quantity]
  );
  if (rows.length === 0) return null;
  return calcNetPrice(rows[0].rate, rows[0].discount_pct);
}

export async function upsertPriceListItem(input: {
  priceListId: string;
  stockItemId: string;
  fromQty: number;
  lessThanQty?: number | null;
  rate: number;
  discountPct?: number;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: items } = await client.query(
      `INSERT INTO price_list_items (price_list_id, stock_item_id)
       VALUES ($1, $2)
       ON CONFLICT (price_list_id, stock_item_id) DO UPDATE SET price_list_id = EXCLUDED.price_list_id
       RETURNING id`,
      [input.priceListId, input.stockItemId]
    );
    const itemId = items[0].id;
    await client.query(
      `DELETE FROM price_list_tiers WHERE price_list_item_id = $1 AND from_qty = $2`,
      [itemId, input.fromQty]
    );
    await client.query(
      `INSERT INTO price_list_tiers (price_list_item_id, from_qty, less_than_qty, rate, discount_pct)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        itemId,
        input.fromQty,
        input.lessThanQty ?? null,
        input.rate,
        input.discountPct ?? 0,
      ]
    );
    await client.query(
      `UPDATE price_lists SET updated_at = now() WHERE id = $1`,
      [input.priceListId]
    );
    await client.query('COMMIT');
    return { ok: true as const };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function searchStockItems(opts: {
  q: string;
  categoryId?: string;
  limit?: number;
}) {
  const pool = getPool();
  const limit = Math.min(20, opts.limit ?? 8);
  const values: unknown[] = [`%${opts.q.trim()}%`];
  let where = `WHERE (si.name ILIKE $1 OR sia.alias ILIKE $1)`;
  if (opts.categoryId) {
    values.push(opts.categoryId);
    where += ` AND si.category_id = $${values.length}::uuid`;
  }
  values.push(limit);

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (si.id)
       si.id AS stock_item_id,
       si.name AS item_name,
       sia.alias AS primary_sku
     FROM stock_items si
     JOIN stock_item_aliases sia ON sia.item_id = si.id
     ${where}
     ORDER BY si.id, sia.is_primary DESC
     LIMIT $${values.length}`,
    values
  );
  return rows as { stock_item_id: string; item_name: string; primary_sku: string }[];
}

export async function listPriceLevels(companyId?: string) {
  const pool = getPool();
  const filter = companyId ? 'WHERE company_id = $1' : '';
  const params = companyId ? [companyId] : [];
  const { rows } = await pool.query(
    `SELECT id, name FROM price_levels ${filter} ORDER BY name`,
    params
  );
  return rows as { id: string; name: string }[];
}
