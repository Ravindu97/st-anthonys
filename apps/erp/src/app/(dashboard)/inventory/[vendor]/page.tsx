import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MetricCardCount, MetricCardMoney } from '@/components/MetricCard';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { InventoryExplorer } from '@/components/inventory/InventoryExplorer';
import { LoadingSkeleton } from '@/components/inventory/LoadingSkeleton';
import {
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
}: {
  params: Promise<{ vendor: string }>;
}) {
  const { vendor: vendorSlug } = await params;
  const vendorMeta = await resolveVendorCode(vendorSlug);

  if (!vendorMeta) notFound();

  const hasSnapshot = await vendorHasSnapshot(vendorMeta.code);
  if (!hasSnapshot) notFound();

  const [meta, kpis] = await Promise.all([
    getVendorSnapshotMeta(vendorMeta.code),
    getVendorKpis(vendorMeta.code),
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
        <MetricCardCount
          label="Low stock"
          count={kpis.low_stock}
          accent="gold"
          sub="1–9 units"
          className="col-span-1 lg:col-span-2"
        />
        <MetricCardCount
          label="Out of stock"
          count={kpis.out_of_stock}
          accent="gold"
          className="col-span-1 lg:col-span-2"
        />
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <InventoryExplorer
          vendorSlug={vendorSlug.toLowerCase()}
          vendorCode={vendorMeta.code}
          vendorName={vendorMeta.name}
        />
      </Suspense>
    </div>
  );
}
