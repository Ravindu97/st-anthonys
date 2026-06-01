import {
  getInventoryHubSummary,
  getPortfolioGroupMix,
} from '@/lib/inventory-search';
import { MetricCardCount, MetricCardMoney } from '@/components/MetricCard';
import { MetricCardCountLink, MetricCardMoneyLink } from '@/components/inventory/MetricCardLink';
import { VendorHubClient } from '@/components/inventory/VendorHubClient';
import { AlertStrip } from '@/components/inventory/AlertStrip';
import { PortfolioGroupMix } from '@/components/inventory/PortfolioGroupMix';
import { alertsUrl } from '@/lib/inventory-url';

export const dynamic = 'force-dynamic';

function latestImportDate(vendors: { imported_at: string | Date }[]) {
  if (vendors.length === 0) return null;
  const latest = vendors.reduce(
    (max, v) => Math.max(max, new Date(v.imported_at).getTime()),
    0
  );
  return new Date(latest).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function staleDays(imported_at: Date | string) {
  const days = Math.floor(
    (Date.now() - new Date(imported_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  return days;
}

export default async function InventoryHubPage() {
  let summary: Awaited<ReturnType<typeof getInventoryHubSummary>> | null = null;
  let groupMix: Awaited<ReturnType<typeof getPortfolioGroupMix>> = [];
  let error: string | null = null;

  try {
    [summary, groupMix] = await Promise.all([
      getInventoryHubSummary(),
      getPortfolioGroupMix(8),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load inventory';
  }

  const vendors = summary?.vendors ?? [];
  const lastImport = summary ? latestImportDate(vendors) : null;
  const topRiskVendor = [...vendors].sort(
    (a, b) => Number(b.at_risk_value) - Number(a.at_risk_value)
  )[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            Inventory hub
          </h1>
          {summary && (
            <p className="mt-1 font-mono text-sm text-slate-500">
              {summary.vendor_count} vendors ·{' '}
              {Number(summary.sku_count).toLocaleString()} SKUs
              {lastImport ? ` · Updated ${lastImport}` : ''}
            </p>
          )}
        </div>
        <a
          href="/inventory/alerts"
          className="rounded-lg border border-brand-blue-200 bg-brand-blue-50 px-3 py-2 text-sm font-medium text-brand-blue-700 hover:bg-brand-blue-100"
        >
          Alert center →
        </a>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {summary && (
        <>
          <AlertStrip
            lowStock={summary.low_stock}
            outOfStock={summary.out_of_stock}
            atRiskValue={summary.at_risk_value}
            varianceCount={summary.variance_count}
            topVendor={
              topRiskVendor
                ? {
                    slug: topRiskVendor.slug,
                    name: topRiskVendor.name,
                    low_stock: topRiskVendor.low_stock,
                    out_of_stock: topRiskVendor.out_of_stock,
                  }
                : undefined
            }
          />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-12">
            <MetricCardMoney
              label="Total stock value"
              amount={summary.total_value}
              className="xl:col-span-3"
            />
            <MetricCardMoneyLink
              href={alertsUrl()}
              label="At-risk value"
              amount={summary.at_risk_value}
              sub={`${summary.at_risk_pct}% of portfolio · low + out lines`}
              className="xl:col-span-3"
            />
            <MetricCardCount
              label="Vendors"
              count={summary.vendor_count}
              className="xl:col-span-2"
            />
            <MetricCardCountLink
              href={alertsUrl('low')}
              label="Low stock"
              count={summary.low_stock}
              accent="gold"
              sub="Under 10 units"
              className="xl:col-span-2"
            />
            <MetricCardCountLink
              href={alertsUrl('out')}
              label="Out of stock"
              count={summary.out_of_stock}
              accent="gold"
              className="xl:col-span-2"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {vendors.length > 0 && (
                <VendorHubClient vendors={vendors} totalValue={summary.total_value} />
              )}
            </div>
            <PortfolioGroupMix
              groups={groupMix}
              vendors={vendors.map((v) => ({ slug: v.slug, name: v.name }))}
            />
          </div>

          {vendors.some((v) => staleDays(v.imported_at) > 7) && (
            <p className="text-xs text-brand-gold-700">
              Some vendors were last imported over 7 days ago. Re-run Tally Location
              Summary imports to refresh figures.
            </p>
          )}
        </>
      )}

      {vendors.length === 0 && !error && (
        <p className="text-sm text-slate-500">
          No inventory imported yet. Run a Location Summary import, then refresh.
        </p>
      )}
    </div>
  );
}
