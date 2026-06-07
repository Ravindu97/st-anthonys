import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { OrderActions } from '@/components/sales/OrderActions';
import { getSalesDocument } from '@/lib/sales';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSalesDocument(id);
  if (!data) notFound();
  const { document: doc, lines } = data;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Orders', href: '/orders' },
          { label: doc.doc_number },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            {doc.doc_number}
          </h1>
          <p className="mt-1 text-sm text-slate-500 capitalize">
            {doc.doc_kind} · {doc.status.replace(/_/g, ' ')} · {doc.fulfillment_type}
          </p>
        </div>
        <OrderActions
          orderId={doc.id}
          status={doc.status}
          docKind={doc.doc_kind}
          canPick={['confirmed', 'picking', 'ready_for_pickup'].includes(doc.status)}
        />
      </header>

      <dl className="grid gap-3 sm:grid-cols-3 text-sm rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <dt className="text-slate-500">Customer</dt>
          <dd className="font-medium">{doc.customer_name ?? 'Walk-in'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Subtotal</dt>
          <dd className="font-mono">{Number(doc.subtotal).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Total</dt>
          <dd className="font-mono font-semibold">{Number(doc.total_amount).toLocaleString()}</dd>
        </div>
      </dl>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Picked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 font-mono text-xs">{l.primary_sku ?? '—'}</td>
                <td className="px-4 py-2">
                  {l.item_name}
                  {l.is_special_order && (
                    <span className="ml-2 text-xs text-amber-600">Special order</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-mono">{l.quantity}</td>
                <td className="px-4 py-2 text-right font-mono">{l.unit_rate}</td>
                <td className="px-4 py-2 text-right font-mono">{l.line_total}</td>
                <td className="px-4 py-2 text-right font-mono">{l.picked_qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {['confirmed', 'picking', 'ready_for_pickup'].includes(doc.status) && (
        <Link
          href={`/orders/${doc.id}/pick`}
          className="inline-flex rounded-lg bg-brand-gold-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-brand-gold-400"
        >
          Open pick list
        </Link>
      )}
    </div>
  );
}
