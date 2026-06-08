import { formatLkr } from '@/lib/format';
import { revenueChangeLabel, type ExecutiveKpis } from '@/lib/analytics-shared';
import { DashboardKpiCard } from '@/components/dashboard/DashboardKpiCard';

export function AnalyticsKpiStrip({ kpis }: { kpis: ExecutiveKpis }) {
  const change = revenueChangeLabel(kpis.revenue_change_pct);
  const changeTone =
    kpis.revenue_change_pct != null && kpis.revenue_change_pct < 0 ? 'warn' : 'default';

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardKpiCard
        label="Revenue (30 days)"
        value={formatLkr(kpis.revenue_30d)}
        sub={`${kpis.order_count_30d} orders · ${change}`}
        href="/orders"
        tone={changeTone}
      />
      <DashboardKpiCard
        label="Avg order value"
        value={formatLkr(kpis.avg_order_value_30d)}
        sub={`${kpis.pos_share_pct}% counter (POS)`}
      />
      <DashboardKpiCard
        label="Inventory on hand"
        value={formatLkr(kpis.inventory_value)}
        sub={`${kpis.at_risk_pct}% at-risk value`}
        href="/inventory"
        tone={kpis.at_risk_pct >= 25 ? 'warn' : 'default'}
      />
      <DashboardKpiCard
        label="Dead stock"
        value={formatLkr(kpis.dead_stock_value)}
        sub={`${kpis.dead_stock_lines} lines · 60+ days idle`}
        tone={kpis.dead_stock_value > 0 ? 'warn' : 'default'}
      />
      <DashboardKpiCard
        label="Below minimum"
        value={String(kpis.below_min_count)}
        sub="SKUs needing replenishment"
        href="/inventory/reorder"
        tone={kpis.below_min_count > 0 ? 'danger' : 'default'}
      />
      <DashboardKpiCard
        label="Inactive customers"
        value={String(kpis.inactive_customers_90d)}
        sub="No order in 90 days"
        href="/customers"
        tone={kpis.inactive_customers_90d > 0 ? 'warn' : 'default'}
      />
      <DashboardKpiCard
        label="Prior period revenue"
        value={formatLkr(kpis.revenue_prior_30d)}
        sub="Previous 30 days (comparison)"
      />
      <DashboardKpiCard
        label="Service health"
        value={`${100 - kpis.at_risk_pct}%`}
        sub="In-stock value share (approx.)"
      />
    </section>
  );
}
