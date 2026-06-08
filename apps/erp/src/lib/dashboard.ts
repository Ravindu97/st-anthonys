import {
  getChannelRevenue,
  getExecutiveKpis,
  getOperationalAlerts,
  getRevenueWindow,
  getSalesTrend,
  getTopCustomers,
} from './analytics';
import type { OperationsDashboard } from './dashboard-shared';
import { getInventoryHubSummary, searchCrossVendorAlerts } from './inventory-search';
import { getReorderWorkbenchSummary } from './reorder';
import { getSalesQueueSummary } from './sales';

export type {
  OperationsAttention,
  OperationsDashboard,
  OperationsKpis,
  SalesQueueSummary,
  VendorRiskRow,
} from './dashboard-shared';

export async function getOperationsDashboard(): Promise<OperationsDashboard> {
  const [
    hub,
    newOuts,
    reorder,
    executive,
    alerts,
    salesQueue,
    salesTrend,
    channelMix,
    topCustomers,
    revenue7d,
  ] = await Promise.all([
    getInventoryHubSummary(),
    searchCrossVendorAlerts({ tab: 'new_outs', page: 1, pageSize: 1 }),
    getReorderWorkbenchSummary(),
    getExecutiveKpis(),
    getOperationalAlerts(),
    getSalesQueueSummary(),
    getSalesTrend(7),
    getChannelRevenue(7),
    getTopCustomers(5, 7),
    getRevenueWindow(7, 0),
  ]);

  const topVendorRisks = [...hub.vendors]
    .sort((a, b) => Number(b.at_risk_value) - Number(a.at_risk_value))
    .slice(0, 3)
    .map((v) => ({
      slug: v.slug,
      name: v.name,
      at_risk_value: Number(v.at_risk_value),
      low_stock: Number(v.low_stock),
      out_of_stock: Number(v.out_of_stock),
      risk_pct: v.risk_pct,
    }));

  return {
    attention: {
      low_stock: hub.low_stock,
      out_of_stock: hub.out_of_stock,
      below_min_count: executive.below_min_count,
      variance_count: hub.variance_count,
      new_outs_count: newOuts.totalCount,
      draft_reorder_suggestions: alerts.draft_reorder_suggestions,
      awaiting_receipt_pos: alerts.awaiting_receipt_pos,
      open_sales_to_fulfill: salesQueue.open_to_fulfill,
    },
    kpis: {
      revenue_7d: revenue7d.total_revenue,
      order_count_7d: revenue7d.order_count,
      total_stock_value: hub.total_value,
      at_risk_value: hub.at_risk_value,
      at_risk_pct: hub.at_risk_pct,
      need_reorder_count: reorder.items_below_min,
      need_reorder_value: reorder.estimated_value_at_risk,
      dead_stock_value: executive.dead_stock_value,
      open_purchase_orders: alerts.open_purchase_orders,
      inactive_customers_90d: executive.inactive_customers_90d,
    },
    salesTrend,
    channelMix,
    topCustomers,
    topVendorRisks,
    alerts,
  };
}
