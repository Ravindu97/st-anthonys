import { getPool } from './db';

export type PriceListSummary = {
  id: string;
  price_level_name: string;
  scope_type: string;
  category_name: string | null;
  group_name: string | null;
  applicable_from: string;
  item_count: number;
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

export async function listPriceLists(companyId?: string) {
  const pool = getPool();
  const filter = companyId ? 'WHERE pl.company_id = $1' : '';
  const params = companyId ? [companyId] : [];

  const { rows } = await pool.query(
    `SELECT
       pl.id,
       pvl.name AS price_level_name,
       pl.scope_type,
       cat.name AS category_name,
       sg.name AS group_name,
       pl.applicable_from,
       COUNT(pli.id)::int AS item_count
     FROM price_lists pl
     JOIN price_levels pvl ON pvl.id = pl.price_level_id
     LEFT JOIN stock_categories cat ON cat.id = pl.scope_category_id
     LEFT JOIN stock_groups sg ON sg.id = pl.scope_group_id
     LEFT JOIN price_list_items pli ON pli.price_list_id = pl.id
     ${filter}
     GROUP BY pl.id, pvl.name, pl.scope_type, cat.name, sg.name, pl.applicable_from
     ORDER BY pl.applicable_from DESC, pvl.name`,
    params
  );
  return rows as PriceListSummary[];
}

export async function getPriceListItems(priceListId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       pli.stock_item_id,
       si.name AS item_name,
       a.alias AS primary_sku,
       plt.from_qty,
       plt.less_than_qty,
       plt.rate,
       plt.discount_pct
     FROM price_list_items pli
     JOIN stock_items si ON si.id = pli.stock_item_id
     JOIN price_list_tiers plt ON plt.price_list_item_id = pli.id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases
       WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     WHERE pli.price_list_id = $1
     ORDER BY si.name, plt.from_qty`,
    [priceListId]
  );
  return rows as PriceListItemRow[];
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
  const rate = Number(rows[0].rate);
  const discount = Number(rows[0].discount_pct ?? 0);
  return rate * (1 - discount / 100);
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
    await client.query('COMMIT');
    return { ok: true as const };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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
