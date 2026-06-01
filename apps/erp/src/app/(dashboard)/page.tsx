import Link from 'next/link';
import { MetricCardMoney } from '@/components/MetricCard';
import { formatLkr } from '@/lib/format';
import { getActiveVendors } from '@/lib/inventory-search';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let vendors: Awaited<ReturnType<typeof getActiveVendors>> = [];
  let error: string | null = null;

  try {
    vendors = await getActiveVendors();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Database unavailable';
  }

  const totalValue = vendors.reduce(
    (s, v) => s + Number(v.total_value),
    0
  );
  const totalSkus = vendors.reduce((s, v) => s + Number(v.sku_count), 0);

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCardMoney
          label="Total stock value (imported)"
          amount={totalValue}
          sub={`${vendors.length} active locations`}
        />
        <MetricCardMoney
          label="SKU lines on hand"
          amount={totalSkus}
          sub="Distinct items with balances"
          accent="gold"
        />
        <MetricCardMoney
          label="Vendors synced"
          amount={vendors.length}
          sub="ORANGE, SWISSTEK + more"
        />
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Vendor locations
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {vendors.map((v) => (
            <Link
              key={v.code}
              href={`/inventory/${v.slug}`}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-semibold text-slate-900 group-hover:text-brand-blue-600">
                    {v.name}
                  </p>
                  <p className="text-xs text-slate-500">{v.location_name}</p>
                </div>
                <span className="font-mono text-sm font-bold text-brand-blue-600">
                  {formatLkr(v.total_value)}
                </span>
              </div>
              <p className="mt-3 font-mono text-xs text-slate-400">
                {Number(v.sku_count).toLocaleString()} SKUs
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
