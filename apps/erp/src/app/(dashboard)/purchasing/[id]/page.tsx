import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { ReceiveGoodsForm } from '@/components/purchasing/ReceiveGoodsForm';
import { formatLkr } from '@/lib/format';
import { getPurchaseOrder } from '@/lib/purchasing';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPurchaseOrder(id);
  if (!data) notFound();

  const { order, lines } = data;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Purchasing', href: '/purchasing' },
          { label: order.po_number },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            {order.po_number}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {order.supplier_name} ·{' '}
            <span className="capitalize">{order.status}</span>
          </p>
        </div>
        <p className="font-mono text-lg font-semibold text-slate-900">
          {formatLkr(order.total_amount)}
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Ordered</th>
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-2 font-mono text-xs">{line.line_no}</td>
                <td className="px-4 py-2 font-mono text-xs">{line.primary_sku ?? '—'}</td>
                <td className="px-4 py-2">{line.item_name}</td>
                <td className="px-4 py-2 text-right font-mono">{line.quantity}</td>
                <td className="px-4 py-2 text-right font-mono">{line.received_qty}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatLkr(line.unit_rate)}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatLkr(line.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {order.status !== 'received' && (
        <ReceiveGoodsForm
          purchaseOrderId={order.id}
          lines={lines.map((l) => ({
            id: l.id,
            item_name: l.item_name,
            primary_sku: l.primary_sku,
            quantity: Number(l.quantity),
            received_qty: Number(l.received_qty),
          }))}
        />
      )}

      <Link
        href="/purchasing"
        className="text-sm text-brand-blue-600 hover:underline"
      >
        ← All purchase orders
      </Link>
    </div>
  );
}
