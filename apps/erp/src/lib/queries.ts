import { getPool } from './db';

export async function getDashboardKpis() {
  const pool = getPool();
  const { rows } = await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (inv.location_id)
        inv.id AS snapshot_id,
        inv.location_id,
        loc.name AS location_name,
        cat.name AS category_name,
        cat.code AS category_code
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      LEFT JOIN stock_categories cat ON cat.id = loc.stock_category_id
      ORDER BY inv.location_id, inv.created_at DESC
    )
    SELECT
      l.category_name,
      l.category_code,
      l.location_name,
      COUNT(ib.id) AS sku_count,
      COALESCE(SUM(ib.quantity), 0) AS total_qty,
      COALESCE(SUM(ib.value), 0) AS total_value
    FROM latest l
    JOIN inventory_balances ib ON ib.snapshot_id = l.snapshot_id
    GROUP BY l.category_name, l.category_code, l.location_name
    ORDER BY total_value DESC
  `);
  return rows;
}

export async function getInventoryByCategory(categoryCode: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    WITH snap AS (
      SELECT inv.id AS snapshot_id, loc.name AS location_name
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      JOIN stock_categories cat ON cat.id = loc.stock_category_id
      WHERE cat.code = $1
      ORDER BY inv.created_at DESC
      LIMIT 1
    )
    SELECT
      v.stock_group_name,
      v.primary_sku,
      v.item_name,
      v.quantity,
      v.unit_code,
      v.rate,
      v.value
    FROM v_location_summary v
    JOIN snap s ON s.snapshot_id = v.snapshot_id
    ORDER BY v.stock_group_name, v.item_name
    LIMIT 2000
    `,
    [categoryCode]
  );
  return rows;
}

export async function getGroupRollups(categoryCode: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    WITH snap AS (
      SELECT inv.id AS snapshot_id
      FROM inventory_snapshots inv
      JOIN locations loc ON loc.id = inv.location_id
      JOIN stock_categories cat ON cat.id = loc.stock_category_id
      WHERE cat.code = $1
      ORDER BY inv.created_at DESC
      LIMIT 1
    )
    SELECT g.group_name, g.total_quantity, g.total_value, g.item_count
    FROM v_group_balances g
    JOIN snap s ON s.snapshot_id = g.snapshot_id
    ORDER BY g.total_value DESC
    `,
    [categoryCode]
  );
  return rows;
}

export async function getCategoriesWithStock() {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT DISTINCT cat.code, cat.name
    FROM stock_categories cat
    JOIN stock_items si ON si.category_id = cat.id
    ORDER BY cat.name
  `);
  return rows;
}
