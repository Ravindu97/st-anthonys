import { formatLkr } from '@/lib/format';
import { alertsUrl } from '@/lib/inventory-url';
import type { OperationsKpis } from '@/lib/dashboard-shared';
import { DashboardKpiCard } from './DashboardKpiCard';

export function OperationsKpiStrip({ kpis }: { kpis: OperationsKpis }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardKpiCard
        label="Revenue (7 days)"
        value={formatLkr(kpis.revenue_7d)}
        sub={`${kpis.order_count_7d} orders`}
        href="/orders"
      />
      <DashboardKpiCard
        label="Orders (7 days)"
        value={String(kpis.order_count_7d)}
        sub="POS + office orders"
        href="/orders"
      />
      <DashboardKpiCard
        label="Total stock value"
        value={formatLkr(kpis.total_stock_value)}
        sub="Latest Tally snapshots"
        href="/inventory"
      />
      <DashboardKpiCard
        label="At-risk value"
        value={formatLkr(kpis.at_risk_value)}
        sub={`${kpis.at_risk_pct}% of portfolio`}
        href={alertsUrl()}
        tone={kpis.at_risk_pct >= 15 ? 'warn' : 'default'}
      />
      <DashboardKpiCard
        label="Need reorder"
        value={String(kpis.need_reorder_count)}
        sub={formatLkr(kpis.need_reorder_value) + ' at risk'}
        href="/inventory/reorder?tab=action"
        tone={kpis.need_reorder_count > 0 ? 'danger' : 'default'}
      />
      <DashboardKpiCard
        label="Dead stock"
        value={formatLkr(kpis.dead_stock_value)}
        sub="60+ days no movement"
        href="/inventory/alerts"
        tone={kpis.dead_stock_value > 0 ? 'warn' : 'default'}
      />
      <DashboardKpiCard
        label="Open purchase orders"
        value={String(kpis.open_purchase_orders)}
        sub="Not yet fully received"
        href="/purchasing"
      />
      <DashboardKpiCard
        label="Inactive customers"
        value={String(kpis.inactive_customers_90d)}
        sub="No order in 90 days"
        href="/customers"
        tone={kpis.inactive_customers_90d > 0 ? 'warn' : 'default'}
      />
    </section>
  );
}
