import { getPool } from './db';

export async function getMarginAnalytics(limit = 50) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM v_margin_by_sku
     WHERE sale_line_count > 0 OR quantity > 0
     ORDER BY margin_pct DESC NULLS LAST, value DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getDeadStock(limit = 50) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       ds.*,
       si.name AS item_name,
       a.alias AS primary_sku,
       loc.name AS location_name,
       cat.name AS category_name
     FROM v_dead_stock ds
     JOIN stock_items si ON si.id = ds.stock_item_id
     JOIN locations loc ON loc.id = ds.location_id
     JOIN stock_categories cat ON cat.id = si.category_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     ORDER BY ds.value DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getVelocityAnalytics(limit = 50) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       sv.*,
       si.name AS item_name,
       a.alias AS primary_sku,
       loc.name AS location_name,
       cat.name AS category_name
     FROM v_stock_velocity sv
     JOIN stock_items si ON si.id = sv.stock_item_id
     JOIN locations loc ON loc.id = sv.location_id
     JOIN stock_categories cat ON cat.id = si.category_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     ORDER BY sv.total_qty_moved DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getCustomerOrderGaps(days = 90) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.code,
       c.name,
       MAX(sd.created_at) AS last_order_at,
       EXTRACT(DAY FROM now() - MAX(sd.created_at))::int AS days_since_order
     FROM customers c
     LEFT JOIN sales_documents sd
       ON sd.customer_id = c.id
       AND sd.doc_kind = 'order'
       AND sd.status NOT IN ('draft', 'cancelled')
     WHERE c.is_active = true
     GROUP BY c.id, c.code, c.name
     HAVING MAX(sd.created_at) IS NULL
        OR MAX(sd.created_at) < now() - ($1 || ' days')::interval
     ORDER BY days_since_order DESC NULLS FIRST
     LIMIT 50`,
    [days]
  );
  return rows;
}

export async function listDeliverySchedules(opts?: { status?: string }) {
  const pool = getPool();
  const values: unknown[] = [];
  let where = '';
  if (opts?.status) {
    values.push(opts.status);
    where = `WHERE ds.status = $1::delivery_status`;
  }
  const { rows } = await pool.query(
    `SELECT
       ds.*,
       sd.doc_number,
       c.name AS customer_name
     FROM delivery_schedules ds
     JOIN sales_documents sd ON sd.id = ds.sales_document_id
     LEFT JOIN customers c ON c.id = sd.customer_id
     ${where}
     ORDER BY ds.scheduled_date ASC`,
    values
  );
  return rows;
}

export async function createDeliverySchedule(input: {
  companyId: string;
  salesDocumentId: string;
  scheduledDate: string;
  driverName?: string;
  vehicleRef?: string;
  notes?: string;
}) {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO delivery_schedules (
       company_id, sales_document_id, scheduled_date, driver_name, vehicle_ref, notes
     ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      input.companyId,
      input.salesDocumentId,
      input.scheduledDate,
      input.driverName ?? null,
      input.vehicleRef ?? null,
      input.notes ?? null,
    ]
  );
  return rows[0];
}

export async function getAnalyticsSummary() {
  const pool = getPool();
  const [margin, dead, velocity, gaps] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS cnt FROM v_margin_by_sku WHERE margin_pct IS NOT NULL`),
    pool.query(`SELECT COUNT(*)::int AS cnt, COALESCE(SUM(value), 0) AS total_value FROM v_dead_stock`),
    pool.query(`SELECT COUNT(*)::int AS cnt FROM v_stock_velocity`),
    pool.query(
      `SELECT COUNT(*)::int AS cnt FROM customers c
       LEFT JOIN sales_documents sd ON sd.customer_id = c.id AND sd.doc_kind = 'order'
       WHERE c.is_active = true
       GROUP BY c.id
       HAVING MAX(sd.created_at) IS NULL OR MAX(sd.created_at) < now() - interval '90 days'`
    ),
  ]);
  return {
    skus_with_margin: Number(margin.rows[0]?.cnt ?? 0),
    dead_stock_count: Number(dead.rows[0]?.cnt ?? 0),
    dead_stock_value: Number(dead.rows[0]?.total_value ?? 0),
    active_velocity_items: Number(velocity.rows[0]?.cnt ?? 0),
    inactive_customers: gaps.rows.length,
  };
}
