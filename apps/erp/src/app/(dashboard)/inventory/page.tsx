import Link from 'next/link';
import { getActiveVendors } from '@/lib/inventory-search';
import { formatLkr } from '@/lib/format';
import { VendorHubSearch } from '@/components/inventory/VendorHubSearch';

export const dynamic = 'force-dynamic';

export default async function InventoryIndexPage() {
  let vendors: Awaited<ReturnType<typeof getActiveVendors>> = [];
  let error: string | null = null;

  try {
    vendors = await getActiveVendors();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load vendors';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Inventory
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Select a vendor to search, filter, and export stock from your latest
            Tally import.
          </p>
        </div>
        <VendorHubSearch />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {vendors.length === 0 && !error && (
        <p className="text-sm text-slate-500">
          No imported inventory yet. Run a Location Summary import from the project
          root.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {vendors.map((v) => (
          <Link
            key={v.code}
            href={`/inventory/${v.slug}`}
            data-vendor-name={v.name.toLowerCase()}
            data-vendor-location={v.location_name.toLowerCase()}
            className="vendor-card group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-blue-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-lg font-semibold text-slate-900 group-hover:text-brand-blue-600">
                  {v.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{v.location_name}</p>
              </div>
              <span className="rounded-full bg-brand-blue-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-blue-700">
                {v.code}
              </span>
            </div>
            <p className="mt-4 font-mono text-lg font-bold text-slate-900">
              {formatLkr(v.total_value)}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-400">
              {Number(v.sku_count).toLocaleString()} SKUs · Updated{' '}
              {new Date(v.imported_at).toLocaleDateString('en-GB')}
            </p>
            <p className="mt-3 text-xs font-medium text-brand-blue-600">
              Open inventory →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
