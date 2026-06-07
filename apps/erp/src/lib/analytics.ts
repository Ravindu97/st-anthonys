import type {
  AnalyticsDashboard,
  CategoryMixRow,
  ChannelRevenue,
  CustomerGapRow,
  DeadStockRow,
  ExecutiveKpis,
  MarginRow,
  OperationalAlerts,
  SalesTrendPoint,
  TopCustomerRow,
  VelocityRow,
} from './analytics-shared';
import { getPool } from './db';
import { getInventoryHubSummary } from './inventory-search';

export type {
  AnalyticsDashboard,
  AnalyticsPeriod,
  CategoryMixRow,
  ChannelRevenue,
  CustomerGapRow,
  DeadStockRow,
  ExecutiveKpis,
  MarginRow,
  OperationalAlerts,
  SalesTrendPoint,
  TopCustomerRow,
  VelocityRow,
} from './analytics-shared';

export { healthStatus, revenueChangeLabel } from './analytics-shared';

async function getRevenueWindow(days: number, offsetDays = 0) {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH period_window AS (
       SELECT
         now() - ($1 || ' days')::interval AS start_at,
         now() - ($2 || ' days')::interval AS end_at
     ),
     pos_rev AS (
       SELECT COALESCE(SUM(pt.total_amount), 0) AS revenue, COUNT(*)::int AS cnt
       FROM pos_transactions pt, period_window w
       WHERE pt.created_at >= w.start_at AND pt.created_at < w.end_at
     ),
     doc_rev AS (
       SELECT COALESCE(SUM(sd.total_amount), 0) AS revenue, COUNT(*)::int AS cnt
       FROM sales_documents sd, period_window w
       WHERE sd.doc_kind = 'order'
         AND sd.status NOT IN ('draft', 'cancelled')
         AND sd.created_at >= w.start_at
         AND sd.created_at < w.end_at
     )
     SELECT
       (SELECT revenue FROM pos_rev) + (SELECT revenue FROM doc_rev) AS total_revenue,
       (SELECT revenue FROM pos_rev) AS pos_revenue,
       (SELECT revenue FROM doc_rev) AS doc_revenue,
       (SELECT cnt FROM pos_rev) + (SELECT cnt FROM doc_rev) AS order_count`,
    [days + offsetDays, offsetDays]
  );
  return {
    total_revenue: Number(rows[0]?.total_revenue ?? 0),
    pos_revenue: Number(rows[0]?.pos_revenue ?? 0),
    doc_revenue: Number(rows[0]?.doc_revenue ?? 0),
    order_count: Number(rows[0]?.order_count ?? 0),
  };
}

export async function getExecutiveKpis(): Promise<ExecutiveKpis> {
  const pool = getPool();
  const [current, prior, hub, dead, belowMin, inactive] = await Promise.all([
    getRevenueWindow(30, 0),
    getRevenueWindow(30, 30),
    getInventoryHubSummary(),
    pool.query(
      `SELECT COUNT(*)::int AS cnt, COALESCE(SUM(value), 0) AS total_value FROM v_dead_stock`
    ),
    pool.query(
       `WITH latest AS (
         SELECT DISTINCT ON (inv.location_id)
           inv.id AS snapshot_id,
           inv.location_id,
           loc.stock_category_id,
           loc.location_type
         FROM inventory_snapshots inv
         JOIN locations loc ON loc.id = inv.location_id
         WHERE loc.location_type = 'main'
         ORDER BY inv.location_id, inv.created_at DESC
       ),
       balances AS (
         SELECT ib.stock_item_id, ib.quantity, si.category_id, l.location_type, l.location_id
         FROM inventory_balances ib
         JOIN latest l ON l.snapshot_id = ib.snapshot_id
         JOIN stock_items si ON si.id = ib.stock_item_id
       )
       SELECT COUNT(*)::int AS cnt
       FROM balances b
       LEFT JOIN reorder_rules rr
         ON rr.stock_item_id = b.stock_item_id
         AND rr.location_id = b.location_id
         AND rr.is_active
       LEFT JOIN reorder_category_defaults rcd
         ON rcd.category_id = b.category_id AND rcd.location_type = b.location_type
       WHERE COALESCE(rr.min_qty, rcd.default_min_qty) IS NOT NULL
         AND b.quantity < COALESCE(rr.min_qty, rcd.default_min_qty)`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM (
         SELECT c.id
         FROM customers c
         LEFT JOIN LATERAL (
           SELECT MAX(at) AS last_at FROM (
             SELECT sd.created_at AS at
             FROM sales_documents sd
             WHERE sd.customer_id = c.id
               AND sd.doc_kind = 'order'
               AND sd.status NOT IN ('draft', 'cancelled')
             UNION ALL
             SELECT pt.created_at AS at
             FROM pos_transactions pt
             WHERE pt.customer_id = c.id
           ) acts
         ) activity ON true
         WHERE c.is_active = true
           AND (activity.last_at IS NULL OR activity.last_at < now() - interval '90 days')
       ) gaps`
    ),
  ]);

  const revenueChange =
    prior.total_revenue > 0
      ? ((current.total_revenue - prior.total_revenue) / prior.total_revenue) * 100
      : null;

  return {
    revenue_30d: current.total_revenue,
    revenue_prior_30d: prior.total_revenue,
    revenue_change_pct: revenueChange,
    order_count_30d: current.order_count,
    avg_order_value_30d:
      current.order_count > 0 ? current.total_revenue / current.order_count : 0,
    inventory_value: hub.total_value,
    at_risk_value: hub.at_risk_value,
    at_risk_pct: hub.at_risk_pct,
    dead_stock_value: Number(dead.rows[0]?.total_value ?? 0),
    dead_stock_lines: Number(dead.rows[0]?.cnt ?? 0),
    below_min_count: Number(belowMin.rows[0]?.cnt ?? 0),
    inactive_customers_90d: Number(inactive.rows[0]?.cnt ?? 0),
    pos_share_pct:
      current.total_revenue > 0
        ? Math.round((current.pos_revenue / current.total_revenue) * 100)
        : 0,
  };
}

export async function getSalesTrend(days = 14): Promise<SalesTrendPoint[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH days AS (
       SELECT generate_series(
         (CURRENT_DATE - ($1 - 1)),
         CURRENT_DATE,
         '1 day'::interval
       )::date AS day
     ),
     pos AS (
       SELECT DATE(pt.created_at) AS day, SUM(pt.total_amount) AS revenue
       FROM pos_transactions pt
       WHERE pt.created_at >= CURRENT_DATE - ($1 - 1)
       GROUP BY 1
     ),
     docs AS (
       SELECT DATE(sd.created_at) AS day, SUM(sd.total_amount) AS revenue
       FROM sales_documents sd
       WHERE sd.doc_kind = 'order'
         AND sd.status NOT IN ('draft', 'cancelled')
         AND sd.created_at >= CURRENT_DATE - ($1 - 1)
       GROUP BY 1
     )
     SELECT
       d.day::text,
       COALESCE(p.revenue, 0) AS counter_revenue,
       COALESCE(doc.revenue, 0) AS order_revenue,
       COALESCE(p.revenue, 0) + COALESCE(doc.revenue, 0) AS total_revenue
     FROM days d
     LEFT JOIN pos p ON p.day = d.day
     LEFT JOIN docs doc ON doc.day = d.day
     ORDER BY d.day`,
    [days]
  );
  return rows.map((r) => ({
    day: r.day as string,
    counter_revenue: Number(r.counter_revenue),
    order_revenue: Number(r.order_revenue),
    total_revenue: Number(r.total_revenue),
  }));
}

export async function getChannelRevenue(days = 30): Promise<ChannelRevenue[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH channels AS (
       SELECT 'Counter (POS)'::text AS channel, SUM(pt.total_amount) AS revenue, COUNT(*)::int AS order_count
       FROM pos_transactions pt
       WHERE pt.created_at >= now() - ($1 || ' days')::interval
       UNION ALL
       SELECT
         CASE sd.fulfillment_type
           WHEN 'pickup' THEN 'Pickup'
           WHEN 'delivery' THEN 'Delivery'
           ELSE 'Other orders'
         END,
         SUM(sd.total_amount),
         COUNT(*)::int
       FROM sales_documents sd
       WHERE sd.doc_kind = 'order'
         AND sd.status NOT IN ('draft', 'cancelled')
         AND sd.fulfillment_type != 'counter'
         AND sd.created_at >= now() - ($1 || ' days')::interval
       GROUP BY 1
     ),
     total AS (SELECT COALESCE(SUM(revenue), 0) AS t FROM channels)
     SELECT c.channel, c.revenue, c.order_count,
       CASE WHEN t.t > 0 THEN ROUND((c.revenue / t.t) * 100)::int ELSE 0 END AS share_pct
     FROM channels c, total t
     WHERE c.revenue > 0
     ORDER BY c.revenue DESC`,
    [days]
  );
  return rows.map((r) => ({
    channel: r.channel as string,
    revenue: Number(r.revenue),
    order_count: Number(r.order_count),
    share_pct: Number(r.share_pct),
  }));
}

export async function getTopCustomers(limit = 10, days = 30): Promise<TopCustomerRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH activity AS (
       SELECT customer_id, SUM(amount) AS revenue, COUNT(*)::int AS order_count, MAX(at) AS last_order_at
       FROM (
         SELECT pt.customer_id, pt.total_amount AS amount, pt.created_at AS at
         FROM pos_transactions pt
         WHERE pt.customer_id IS NOT NULL
           AND pt.created_at >= now() - ($2 || ' days')::interval
         UNION ALL
         SELECT sd.customer_id, sd.total_amount, sd.created_at
         FROM sales_documents sd
         WHERE sd.customer_id IS NOT NULL
           AND sd.doc_kind = 'order'
           AND sd.status NOT IN ('draft', 'cancelled')
           AND sd.created_at >= now() - ($2 || ' days')::interval
       ) combined
       GROUP BY customer_id
     )
     SELECT c.id AS customer_id, c.code, c.name, a.revenue, a.order_count, a.last_order_at
     FROM activity a
     JOIN customers c ON c.id = a.customer_id
     ORDER BY a.revenue DESC
     LIMIT $1`,
    [limit, days]
  );
  return rows.map((r) => ({
    customer_id: r.customer_id as string,
    code: r.code as string,
    name: r.name as string,
    revenue: Number(r.revenue),
    order_count: Number(r.order_count),
    last_order_at: r.last_order_at as Date | null,
  }));
}

export async function getCategoryMix(): Promise<CategoryMixRow[]> {
  const hub = await getInventoryHubSummary();
  const total = hub.total_value || 1;
  return hub.vendors.map((v) => ({
    category_code: v.code,
    category_name: v.name,
    sku_count: Number(v.sku_count),
    total_value: Number(v.total_value),
    share_pct: Math.round((Number(v.total_value) / total) * 100),
    low_stock: Number(v.low_stock),
    out_of_stock: Number(v.out_of_stock),
  }));
}

export async function getMarginAnalytics(limit = 15): Promise<MarginRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       m.stock_item_id,
       m.item_name,
       m.category_name,
       a.alias AS primary_sku,
       LOWER(cat.code) AS vendor_slug,
       m.cost_rate,
       m.avg_sell_rate,
       m.margin_pct,
       m.sale_line_count,
       m.value
     FROM v_margin_by_sku m
     JOIN stock_items si ON si.id = m.stock_item_id
     JOIN stock_categories cat ON cat.id = si.category_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     WHERE m.sale_line_count > 0 AND m.margin_pct IS NOT NULL
     ORDER BY m.margin_pct DESC, m.value DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return rows as MarginRow[];
}

export async function getDeadStock(limit = 15): Promise<DeadStockRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       ds.stock_item_id,
       a.alias AS primary_sku,
       si.name AS item_name,
       LOWER(cat.code) AS vendor_slug,
       loc.name AS location_name,
       cat.name AS category_name,
       ds.quantity,
       ds.value,
       ds.days_since_movement
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
  return rows as DeadStockRow[];
}

export async function getVelocityAnalytics(limit = 15): Promise<VelocityRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       sv.stock_item_id,
       a.alias AS primary_sku,
       si.name AS item_name,
       LOWER(cat.code) AS vendor_slug,
       cat.name AS category_name,
       sv.movement_count,
       sv.total_qty_moved
     FROM v_stock_velocity sv
     JOIN stock_items si ON si.id = sv.stock_item_id
     JOIN stock_categories cat ON cat.id = si.category_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     ORDER BY sv.total_qty_moved DESC
     LIMIT $1`,
    [limit]
  );
  return rows as VelocityRow[];
}

export async function getCustomerOrderGaps(days = 90, limit = 15): Promise<CustomerGapRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH activity AS (
       SELECT
         c.id,
         c.code,
         c.name,
         acts.last_at AS last_order_at,
         EXTRACT(DAY FROM now() - acts.last_at)::int AS days_since_order,
         COALESCE(rev.lifetime_revenue, 0) AS lifetime_revenue
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT MAX(at) AS last_at FROM (
           SELECT sd.created_at AS at
           FROM sales_documents sd
           WHERE sd.customer_id = c.id
             AND sd.doc_kind = 'order'
             AND sd.status NOT IN ('draft', 'cancelled')
           UNION ALL
           SELECT pt.created_at AS at
           FROM pos_transactions pt
           WHERE pt.customer_id = c.id
         ) all_acts
       ) acts ON true
       LEFT JOIN LATERAL (
         SELECT SUM(amount) AS lifetime_revenue FROM (
           SELECT sd.total_amount AS amount
           FROM sales_documents sd
           WHERE sd.customer_id = c.id AND sd.doc_kind = 'order'
             AND sd.status NOT IN ('draft', 'cancelled')
           UNION ALL
           SELECT pt.total_amount FROM pos_transactions pt WHERE pt.customer_id = c.id
         ) rev
       ) rev ON true
       WHERE c.is_active = true
         AND (acts.last_at IS NULL OR acts.last_at < now() - ($1 || ' days')::interval)
     )
     SELECT * FROM activity
     ORDER BY days_since_order DESC NULLS FIRST, lifetime_revenue DESC
     LIMIT $2`,
    [days, limit]
  );
  return rows.map((r) => ({
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    last_order_at: r.last_order_at as Date | null,
    days_since_order: r.days_since_order != null ? Number(r.days_since_order) : null,
    lifetime_revenue: Number(r.lifetime_revenue),
  }));
}

export async function getOperationalAlerts(): Promise<OperationalAlerts> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM purchase_suggestions WHERE status = 'draft') AS draft_reorder_suggestions,
       (SELECT COUNT(*)::int FROM purchase_suggestions WHERE status = 'approved') AS approved_reorder_suggestions,
       (SELECT COUNT(*)::int FROM purchase_orders WHERE status NOT IN ('received', 'cancelled')) AS open_purchase_orders,
       (SELECT COUNT(*)::int FROM purchase_orders WHERE status IN ('submitted', 'partial')) AS awaiting_receipt_pos`
  );
  const r = rows[0];
  return {
    draft_reorder_suggestions: Number(r?.draft_reorder_suggestions ?? 0),
    approved_reorder_suggestions: Number(r?.approved_reorder_suggestions ?? 0),
    open_purchase_orders: Number(r?.open_purchase_orders ?? 0),
    awaiting_receipt_pos: Number(r?.awaiting_receipt_pos ?? 0),
  };
}

export async function getAnalyticsDashboard(): Promise<AnalyticsDashboard> {
  const [
    kpis,
    salesTrend,
    channelMix,
    topCustomers,
    categoryMix,
    topMargins,
    deadStock,
    fastMovers,
    customerGaps,
    alerts,
  ] = await Promise.all([
    getExecutiveKpis(),
    getSalesTrend(14),
    getChannelRevenue(30),
    getTopCustomers(10, 30),
    getCategoryMix(),
    getMarginAnalytics(12),
    getDeadStock(12),
    getVelocityAnalytics(12),
    getCustomerOrderGaps(90, 12),
    getOperationalAlerts(),
  ]);

  return {
    kpis,
    salesTrend,
    channelMix,
    topCustomers,
    categoryMix,
    topMargins,
    deadStock,
    fastMovers,
    customerGaps,
    alerts,
  };
}

/** @deprecated Use getExecutiveKpis */
export async function getAnalyticsSummary() {
  const kpis = await getExecutiveKpis();
  return {
    skus_with_margin: 0,
    dead_stock_count: kpis.dead_stock_lines,
    dead_stock_value: kpis.dead_stock_value,
    active_velocity_items: 0,
    inactive_customers: kpis.inactive_customers_90d,
  };
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
