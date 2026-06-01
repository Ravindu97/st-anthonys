import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MetricCardMoney } from '@/components/MetricCard';
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

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs font-semibold tracking-wider text-brand-blue-600 uppercase">
          {vendorMeta.code}
        </p>
        <h1 className="font-display text-2xl font-semibold text-slate-900">
          {vendorMeta.name}
        </h1>
        {meta && (
          <p className="mt-1 text-sm text-slate-500">
            {meta.location_name} · Closing balance{' '}
            {formatPeriod(meta.period_starts_on, meta.period_ends_on)}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCardMoney label="Stock value" amount={kpis.total_value} />
        <MetricCardMoney
          label="Low stock SKUs"
          amount={kpis.low_stock}
          accent="gold"
          sub="Fewer than 10 units"
        />
        <MetricCardMoney
          label="Out of stock lines"
          amount={kpis.out_of_stock}
          accent="gold"
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
