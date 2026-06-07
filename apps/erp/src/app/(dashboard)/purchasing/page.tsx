import Link from 'next/link';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { TablePagination } from '@/components/TablePagination';
import { listPurchaseOrders, listSuppliers } from '@/lib/purchasing';

export const dynamic = 'force-dynamic';

export default async function PurchasingPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const params = await searchParams;
  const awaitingOnly = params.filter === 'awaiting';
  const page = Math.max(1, Number(params.page ?? 1));
  const queryBase = { filter: awaitingOnly ? 'awaiting' : undefined };

  const [orders, suppliers] = await Promise.all([
    listPurchaseOrders({ awaitingReceipt: awaitingOnly, page, pageSize: 25 }),
    listSuppliers(),
  ]);

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: 'Purchasing' }]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            Purchasing
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Purchase orders and goods receipt — linked to reorder suggestions
          </p>
        </div>
        <Link
          href="/purchasing/receipts"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Goods receipts
        </Link>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/purchasing"
          className={`rounded-lg px-3 py-1.5 ${
            !awaitingOnly
              ? 'bg-brand-blue-50 font-medium text-brand-blue-700'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          All POs
        </Link>
        <Link
          href="/purchasing?filter=awaiting"
          className={`rounded-lg px-3 py-1.5 ${
            awaitingOnly
              ? 'bg-brand-blue-50 font-medium text-brand-blue-700'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Awaiting receipt
        </Link>
      </nav>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">
          Suppliers ({suppliers.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {suppliers.map((s) => (
            <span
              key={s.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            >
              {s.code} — {s.name}
            </span>
          ))}
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">PO #</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Created by</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Lines</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.items.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link
                    href={
                      o.status === 'partial' || o.status === 'draft'
                        ? `/purchasing/${o.id}#receive`
                        : `/purchasing/${o.id}`
                    }
                    className="text-brand-blue-600 hover:underline"
                  >
                    {o.po_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{o.supplier_name}</td>
                <td className="px-4 py-2 capitalize">{o.status}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{o.receipt_label}</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {o.created_by_email ?? '—'}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {Number(o.total_amount).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">{o.line_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.items.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">
            {awaitingOnly
              ? 'No purchase orders awaiting receipt.'
              : 'No purchase orders yet. Approve lines in the '}
            {!awaitingOnly && (
              <>
                <Link
                  href="/inventory/reorder?tab=approved"
                  className="text-brand-blue-600 hover:underline"
                >
                  reorder hub
                </Link>{' '}
                and create POs by vendor.
              </>
            )}
          </p>
        )}
        <TablePagination
          basePath="/purchasing"
          page={orders.page}
          pageSize={orders.pageSize}
          totalCount={orders.totalCount}
          searchParams={queryBase}
        />
      </div>

      <p className="text-xs text-slate-500">
        <Link href="/inventory/reorder" className="text-brand-blue-600 hover:underline">
          Reorder hub
        </Link>{' '}
        → approve → create PO → receive goods
      </p>
    </div>
  );
}
