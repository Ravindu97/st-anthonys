import Link from 'next/link';
import {
  getInventoryHubSummary,
  searchCrossVendorAlerts,
} from '@/lib/inventory-search';
import { MetricCardCount, MetricCardMoney } from '@/components/MetricCard';
import { MetricCardCountLink, MetricCardMoneyLink } from '@/components/inventory/MetricCardLink';
import { DashboardAlertsPanel } from '@/components/inventory/DashboardAlertsPanel';
import { alertsUrl } from '@/lib/inventory-url';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let summary: Awaited<ReturnType<typeof getInventoryHubSummary>> | null = null;
  let newOutsCount = 0;
  let error: string | null = null;

  try {
    const [hub, newOuts] = await Promise.all([
      getInventoryHubSummary(),
      searchCrossVendorAlerts({ tab: 'new_outs', page: 1, pageSize: 1 }),
    ]);
    summary = hub;
    newOutsCount = newOuts.totalCount;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Database unavailable';
  }

  const topRiskVendor = summary?.vendors
    ? [...summary.vendors].sort(
        (a, b) => Number(b.at_risk_value) - Number(a.at_risk_value)
      )[0]
    : undefined;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
          Operations Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Live inventory from Tally Location Summary imports
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-brand-gold-100 bg-brand-gold-50 px-4 py-3 text-sm text-brand-gold-700">
          {error}. Run{' '}
          <code className="font-mono text-xs">npm run db:setup</code> and imports
          from the project root.
        </div>
      )}

      {summary && (
        <>
          <DashboardAlertsPanel
            lowStock={summary.low_stock}
            outOfStock={summary.out_of_stock}
            atRiskValue={summary.at_risk_value}
            atRiskPct={summary.at_risk_pct}
            varianceCount={summary.variance_count}
            newOutsCount={newOutsCount}
            topVendor={
              topRiskVendor
                ? {
                    slug: topRiskVendor.slug,
                    name: topRiskVendor.name,
                    at_risk_value: Number(topRiskVendor.at_risk_value),
                    low_stock: topRiskVendor.low_stock,
                    out_of_stock: topRiskVendor.out_of_stock,
                  }
                : undefined
            }
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCardMoney
              label="Total stock value"
              amount={summary.total_value}
              sub={`${summary.vendor_count} active vendors`}
            />
            <MetricCardMoneyLink
              href={alertsUrl()}
              label="At-risk value"
              amount={summary.at_risk_value}
              sub={`${summary.at_risk_pct}% of portfolio`}
            />
            <MetricCardCount
              label="SKU lines"
              count={summary.sku_count}
              sub="Across all vendors"
            />
            <MetricCardCountLink
              href={alertsUrl('low')}
              label="Low stock SKUs"
              count={summary.low_stock}
              accent="gold"
              sub="Under 10 units"
            />
            <MetricCardCountLink
              href={alertsUrl('out')}
              label="Out of stock"
              count={summary.out_of_stock}
              accent="gold"
            />
          </div>

          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Inventory hub
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Vendors, insights, and alert center
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/inventory"
                className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600"
              >
                View vendors
              </Link>
              <Link
                href="/inventory/alerts"
                className="rounded-lg border border-brand-blue-200 px-4 py-2 text-sm font-medium text-brand-blue-700 hover:bg-brand-blue-50"
              >
                Alert center
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
