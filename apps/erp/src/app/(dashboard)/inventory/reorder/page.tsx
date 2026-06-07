import Link from 'next/link';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { ReorderActions } from '@/components/reorder/ReorderActions';
import { listPurchaseSuggestions } from '@/lib/reorder';

export const dynamic = 'force-dynamic';

export default async function ReorderPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? 'draft';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  let result: Awaited<ReturnType<typeof listPurchaseSuggestions>> | null = null;
  let error: string | null = null;

  try {
    result = await listPurchaseSuggestions({ status, page });
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load suggestions';
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Inventory hub', href: '/inventory' },
          { label: 'Reorder & purchasing suggestions' },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            Reorder suggestions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Items below reorder level — approve to create purchase orders
          </p>
        </div>
        <ReorderActions />
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(['draft', 'approved', 'converted', 'cancelled'] as const).map((s) => (
          <Link
            key={s}
            href={`/inventory/reorder?status=${s}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
              status === s
                ? 'bg-brand-blue-500 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {s}
          </Link>
        ))}
      </nav>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {result && result.items.length === 0 && (
        <p className="text-sm text-slate-500">No suggestions in this status.</p>
      )}

      {result && result.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Current</th>
                <th className="px-4 py-3 text-right">Min</th>
                <th className="px-4 py-3 text-right">Suggest</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">{s.primary_sku ?? '—'}</td>
                  <td className="px-4 py-2">{s.item_name}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/inventory/${s.vendor_slug}`}
                      className="text-brand-blue-600 hover:underline"
                    >
                      {s.category_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{s.location_name}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.current_qty}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.min_qty}</td>
                  <td className="px-4 py-2 text-right font-mono font-medium">
                    {s.suggested_qty}
                  </td>
                  <td className="px-4 py-2 capitalize text-slate-600">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
