/** Client-safe operations dashboard types (no database imports). */

import type { ChannelRevenue, SalesTrendPoint, TopCustomerRow } from './analytics-shared';
import type { OperationalAlerts } from './analytics-shared';

export type VendorRiskRow = {
  slug: string;
  name: string;
  at_risk_value: number;
  low_stock: number;
  out_of_stock: number;
  risk_pct: number;
};

export type SalesQueueSummary = {
  open_to_fulfill: number;
};

export type OperationsAttention = {
  low_stock: number;
  out_of_stock: number;
  below_min_count: number;
  variance_count: number;
  new_outs_count: number;
  draft_reorder_suggestions: number;
  awaiting_receipt_pos: number;
  open_sales_to_fulfill: number;
};

export type OperationsKpis = {
  revenue_7d: number;
  order_count_7d: number;
  total_stock_value: number;
  at_risk_value: number;
  at_risk_pct: number;
  need_reorder_count: number;
  need_reorder_value: number;
  dead_stock_value: number;
  open_purchase_orders: number;
  inactive_customers_90d: number;
};

export type OperationsDashboard = {
  attention: OperationsAttention;
  kpis: OperationsKpis;
  salesTrend: SalesTrendPoint[];
  channelMix: ChannelRevenue[];
  topCustomers: TopCustomerRow[];
  topVendorRisks: VendorRiskRow[];
  alerts: OperationalAlerts;
};
