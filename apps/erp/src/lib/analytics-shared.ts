/** Client-safe analytics types (no database imports). */

export type AnalyticsPeriod = 7 | 30 | 90;

export type ExecutiveKpis = {
  revenue_30d: number;
  revenue_prior_30d: number;
  revenue_change_pct: number | null;
  order_count_30d: number;
  avg_order_value_30d: number;
  inventory_value: number;
  at_risk_value: number;
  at_risk_pct: number;
  dead_stock_value: number;
  dead_stock_lines: number;
  below_min_count: number;
  inactive_customers_90d: number;
  pos_share_pct: number;
};

export type SalesTrendPoint = {
  day: string;
  counter_revenue: number;
  order_revenue: number;
  total_revenue: number;
};

export type ChannelRevenue = {
  channel: string;
  revenue: number;
  order_count: number;
  share_pct: number;
};

export type TopCustomerRow = {
  customer_id: string;
  code: string;
  name: string;
  revenue: number;
  order_count: number;
  last_order_at: Date | null;
};

export type CategoryMixRow = {
  category_code: string;
  category_name: string;
  sku_count: number;
  total_value: number;
  share_pct: number;
  low_stock: number;
  out_of_stock: number;
};

export type MarginRow = {
  stock_item_id: string;
  item_name: string;
  category_name: string;
  primary_sku: string | null;
  vendor_slug: string;
  cost_rate: string | null;
  avg_sell_rate: string | null;
  margin_pct: string | null;
  sale_line_count: number;
  value: string | null;
};

export type DeadStockRow = {
  stock_item_id: string;
  primary_sku: string | null;
  item_name: string;
  vendor_slug: string;
  location_name: string;
  category_name: string;
  quantity: string;
  value: string | null;
  days_since_movement: number;
};

export type VelocityRow = {
  stock_item_id: string;
  primary_sku: string | null;
  item_name: string;
  vendor_slug: string;
  category_name: string;
  movement_count: number;
  total_qty_moved: string;
};

export type CustomerGapRow = {
  id: string;
  code: string;
  name: string;
  last_order_at: Date | null;
  days_since_order: number | null;
  lifetime_revenue: number;
};

export type OperationalAlerts = {
  draft_reorder_suggestions: number;
  approved_reorder_suggestions: number;
  open_purchase_orders: number;
  awaiting_receipt_pos: number;
};

export type AnalyticsDashboard = {
  kpis: ExecutiveKpis;
  salesTrend: SalesTrendPoint[];
  channelMix: ChannelRevenue[];
  topCustomers: TopCustomerRow[];
  categoryMix: CategoryMixRow[];
  topMargins: MarginRow[];
  deadStock: DeadStockRow[];
  fastMovers: VelocityRow[];
  customerGaps: CustomerGapRow[];
  alerts: OperationalAlerts;
};

export function revenueChangeLabel(pct: number | null): string {
  if (pct == null) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}% vs prior 30d`;
}

export function healthStatus(
  value: number,
  warn: number,
  danger: number
): 'good' | 'warn' | 'danger' {
  if (value >= danger) return 'danger';
  if (value >= warn) return 'warn';
  return 'good';
}
