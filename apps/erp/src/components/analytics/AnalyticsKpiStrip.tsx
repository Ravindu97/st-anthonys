import Link from 'next/link';
import { formatLkr } from '@/lib/format';
import { revenueChangeLabel, type ExecutiveKpis } from '@/lib/analytics-shared';

function KpiCard({
  label,
  value,
  sub,
  href,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  tone?: 'default' | 'warn' | 'danger';
}) {
  const border =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50/40'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50/40'
        : 'border-slate-200 bg-white';

  const inner = (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${border}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition hover:opacity-90">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function AnalyticsKpiStrip({ kpis }: { kpis: ExecutiveKpis }) {
  const change = revenueChangeLabel(kpis.revenue_change_pct);
  const changeTone =
    kpis.revenue_change_pct != null && kpis.revenue_change_pct < 0 ? 'warn' : 'default';

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Revenue (30 days)"
        value={formatLkr(kpis.revenue_30d)}
        sub={`${kpis.order_count_30d} orders · ${change}`}
        href="/orders"
        tone={changeTone}
      />
      <KpiCard
        label="Avg order value"
        value={formatLkr(kpis.avg_order_value_30d)}
        sub={`${kpis.pos_share_pct}% counter (POS)`}
      />
      <KpiCard
        label="Inventory on hand"
        value={formatLkr(kpis.inventory_value)}
        sub={`${kpis.at_risk_pct}% at-risk value`}
        href="/inventory"
        tone={kpis.at_risk_pct >= 25 ? 'warn' : 'default'}
      />
      <KpiCard
        label="Dead stock"
        value={formatLkr(kpis.dead_stock_value)}
        sub={`${kpis.dead_stock_lines} lines · 60+ days idle`}
        tone={kpis.dead_stock_value > 0 ? 'warn' : 'default'}
      />
      <KpiCard
        label="Below minimum"
        value={String(kpis.below_min_count)}
        sub="SKUs needing replenishment"
        href="/inventory/reorder"
        tone={kpis.below_min_count > 0 ? 'danger' : 'default'}
      />
      <KpiCard
        label="Inactive customers"
        value={String(kpis.inactive_customers_90d)}
        sub="No order in 90 days"
        href="/customers"
        tone={kpis.inactive_customers_90d > 0 ? 'warn' : 'default'}
      />
      <KpiCard
        label="Prior period revenue"
        value={formatLkr(kpis.revenue_prior_30d)}
        sub="Previous 30 days (comparison)"
      />
      <KpiCard
        label="Service health"
        value={`${100 - kpis.at_risk_pct}%`}
        sub="In-stock value share (approx.)"
      />
    </section>
  );
}
