import Link from 'next/link';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { listSalesDocuments } from '@/lib/sales';

export const dynamic = 'force-dynamic';

const STATUSES = [
  'draft',
  'confirmed',
  'picking',
  'ready_for_pickup',
  'collected',
  'delivered',
  'cancelled',
] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status;
  const kind = sp.kind ?? 'order';

  const result = await listSalesDocuments({
    docKind: kind,
    status: status ?? undefined,
  });

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: 'Orders' }]} />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
          Sales orders & quotes
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Click-and-collect workflow: confirmed → picking → ready → collected
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <Link
          href="/orders?kind=order"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            kind === 'order' ? 'bg-brand-blue-500 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Orders
        </Link>
        <Link
          href="/orders?kind=quote"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            kind === 'quote' ? 'bg-brand-blue-500 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Quotes
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/orders?kind=${kind}&status=${s}`}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              status === s ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Doc #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fulfillment</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Lines</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.items.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link href={`/orders/${o.id}`} className="text-brand-blue-600 hover:underline">
                    {o.doc_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{o.customer_name ?? 'Walk-in'}</td>
                <td className="px-4 py-2 capitalize">{o.status.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2 capitalize">{o.fulfillment_type}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {Number(o.total_amount).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">{o.line_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">No documents match filters.</p>
        )}
      </div>
    </div>
  );
}
