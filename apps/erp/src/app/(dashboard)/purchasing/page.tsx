import Link from 'next/link';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { listPurchaseOrders, listSuppliers } from '@/lib/purchasing';

export const dynamic = 'force-dynamic';

export default async function PurchasingPage() {
  const [orders, suppliers] = await Promise.all([
    listPurchaseOrders(),
    listSuppliers(),
  ]);

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: 'Purchasing' }]} />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
          Purchasing
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Purchase orders and goods receipt — linked to reorder suggestions
        </p>
      </header>

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
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Lines</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.items.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link
                    href={`/purchasing/${o.id}`}
                    className="text-brand-blue-600 hover:underline"
                  >
                    {o.po_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{o.supplier_name}</td>
                <td className="px-4 py-2 capitalize">{o.status}</td>
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
            No purchase orders yet. Approve lines in the{' '}
            <Link href="/inventory/reorder?tab=approved" className="text-brand-blue-600 hover:underline">
              reorder hub
            </Link>{' '}
            and create POs by vendor.
          </p>
        )}
      </div>

      <p className="text-xs text-slate-500">
        <Link href="/inventory/reorder" className="text-brand-blue-600 hover:underline">
          Reorder hub
        </Link>{' '}
        → approve → create PO per vendor
      </p>
    </div>
  );
}
