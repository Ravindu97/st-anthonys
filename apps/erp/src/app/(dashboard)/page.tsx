import Link from 'next/link';
import { MetricCardCount, MetricCardMoney } from '@/components/MetricCard';
import { getInventoryHubSummary } from '@/lib/inventory-search';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let summary: Awaited<ReturnType<typeof getInventoryHubSummary>> | null = null;
  let error: string | null = null;

  try {
    summary = await getInventoryHubSummary();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Database unavailable';
  }

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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCardMoney
              label="Total stock value"
              amount={summary.total_value}
              sub={`${summary.vendor_count} active vendors`}
            />
            <MetricCardCount
              label="SKU lines"
              count={summary.sku_count}
              sub="Across all vendors"
            />
            <MetricCardCount
              label="Low stock SKUs"
              count={summary.low_stock}
              accent="gold"
              sub="Under 10 units"
            />
            <MetricCardCount
              label="Out of stock"
              count={summary.out_of_stock}
              accent="gold"
            />
          </div>

          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Inventory hub
            </h2>
            <Link
              href="/inventory"
              className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600"
            >
              View vendors →
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
