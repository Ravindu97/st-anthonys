import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MetricCardCount, MetricCardMoney } from '@/components/MetricCard';
import { MetricCardCountLink } from '@/components/inventory/MetricCardLink';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { InventoryExplorer } from '@/components/inventory/InventoryExplorer';
import { VendorInsightsPanel } from '@/components/inventory/VendorInsightsPanel';
import { LoadingSkeleton } from '@/components/inventory/LoadingSkeleton';
import { vendorInventoryUrl } from '@/lib/inventory-url';
import {
  getGroupHealth,
  getGroupRollupsForVendor,
  getParetoStats,
  getPriorityWatchlist,
  getSnapshotDiffSummary,
  getVarianceCount,
  getVendorKpis,
  getVendorSnapshotMeta,
  resolveVendorCode,
  vendorHasSnapshot,
} from '@/lib/inventory-search';

export const dynamic = 'force-dynamic';

function formatPeriod(start: string | Date, end: string | Date) {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  return `${fmt(new Date(start))} – ${fmt(new Date(end))}`;
}

export default async function VendorInventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ vendor: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { vendor: vendorSlug } = await params;
  const sp = await searchParams;
  const tab = sp.tab === 'insights' ? 'insights' : 'stock';

  const vendorMeta = await resolveVendorCode(vendorSlug);
  if (!vendorMeta) notFound();

  const hasSnapshot = await vendorHasSnapshot(vendorMeta.code);
  if (!hasSnapshot) notFound();

  const slug = vendorSlug.toLowerCase();

  const [meta, kpis, pareto, watchlist, groupHealth, groupRollups, varianceCount, snapshotDiff] =
    await Promise.all([
      getVendorSnapshotMeta(vendorMeta.code),
      getVendorKpis(vendorMeta.code),
      getParetoStats(vendorMeta.code, 20),
      getPriorityWatchlist(vendorMeta.code, 15),
      getGroupHealth(vendorMeta.code),
      getGroupRollupsForVendor(vendorMeta.code),
      getVarianceCount(vendorMeta.code),
      getSnapshotDiffSummary(vendorMeta.code),
    ]);

  const inStock =
    Number(kpis.sku_count) - Number(kpis.low_stock) - Number(kpis.out_of_stock);

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Inventory hub', href: '/inventory' },
          { label: vendorMeta.name },
        ]}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            {vendorMeta.name}
          </h1>
          {meta && (
            <p className="mt-1 text-sm text-slate-500">
              {meta.location_name} · Closing balance{' '}
              {formatPeriod(meta.period_starts_on, meta.period_ends_on)}
            </p>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          <Link
            href={`/inventory/${slug}?tab=insights`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === 'insights'
                ? 'bg-brand-blue-500 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Insights
          </Link>
          <Link
            href={`/inventory/${slug}?tab=stock`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === 'stock'
                ? 'bg-brand-blue-500 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Stock list
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-12">
        <MetricCardMoney
          label="Stock value"
          amount={kpis.total_value}
          className="col-span-2 lg:col-span-4"
        />
        <MetricCardCount
          label="SKU lines"
          count={kpis.sku_count}
          className="col-span-1 lg:col-span-2"
        />
        <MetricCardCount
          label="In stock"
          count={Math.max(0, inStock)}
          sub="10+ units"
          className="col-span-1 lg:col-span-2"
        />
        <MetricCardCountLink
          href={vendorInventoryUrl(slug, { status: 'low_stock', sort: 'value_desc' })}
          label="Low stock"
          count={kpis.low_stock}
          accent="gold"
          sub="1–9 units"
          className="col-span-1 lg:col-span-2"
        />
        <MetricCardCountLink
          href={vendorInventoryUrl(slug, { status: 'out_of_stock', sort: 'value_desc' })}
          label="Out of stock"
          count={kpis.out_of_stock}
          accent="gold"
          className="col-span-1 lg:col-span-2"
        />
      </div>

      {tab === 'insights' && (
        <VendorInsightsPanel
          vendorSlug={slug}
          pareto={pareto}
          watchlist={watchlist}
          groupHealth={groupHealth}
          groupRollups={groupRollups}
          varianceCount={varianceCount}
          snapshotDiff={snapshotDiff}
        />
      )}

      {tab === 'stock' && (
        <Suspense fallback={<LoadingSkeleton />}>
          <InventoryExplorer
            vendorSlug={slug}
            vendorCode={vendorMeta.code}
            vendorName={vendorMeta.name}
          />
        </Suspense>
      )}
    </div>
  );
}
