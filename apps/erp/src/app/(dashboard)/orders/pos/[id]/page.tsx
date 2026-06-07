import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { formatLkr } from '@/lib/format';
import { getPosTransactionDocument } from '@/lib/pos';

export const dynamic = 'force-dynamic';

export default async function PosTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPosTransactionDocument(id);
  if (!data) notFound();

  const { transaction: txn, register, location, lines } = data;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Sales', href: '/orders' },
          { label: txn.transaction_number },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            {txn.transaction_number}
          </h1>
          <p className="mt-1 text-sm text-slate-500 capitalize">
            Counter sale · {txn.payment_method} · {register.name}
          </p>
        </div>
        <Link
          href={`/orders/pos/${id}/print`}
          className="rounded-lg bg-brand-gold-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-brand-gold-400"
        >
          Print receipt
        </Link>
      </header>

      <dl className="grid gap-3 sm:grid-cols-3 text-sm rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <dt className="text-slate-500">Customer</dt>
          <dd className="font-medium">{txn.customer_name ?? 'Walk-in'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Location</dt>
          <dd>{location.name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Total</dt>
          <dd className="font-mono font-semibold">{formatLkr(txn.total_amount)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Date</dt>
          <dd>{new Date(txn.created_at).toLocaleString('en-GB')}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Payment</dt>
          <dd className="capitalize">
            {txn.payment_method}
            {txn.payment_reference && (
              <span className="mt-0.5 block font-mono text-xs text-slate-500 normal-case">
                {txn.payment_reference}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Register</dt>
          <dd>{register.name}</dd>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 font-mono text-xs">
                  <Link
                    href={`/inventory/${l.vendor_slug}/unit/${encodeURIComponent(l.sku)}`}
                    className="text-brand-blue-600 hover:underline"
                  >
                    {l.sku}
                  </Link>
                </td>
                <td className="px-4 py-2">{l.item_name}</td>
                <td className="px-4 py-2 text-right font-mono">{l.quantity}</td>
                <td className="px-4 py-2 text-right font-mono">{formatLkr(l.unit_rate)}</td>
                <td className="px-4 py-2 text-right font-mono">{formatLkr(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
