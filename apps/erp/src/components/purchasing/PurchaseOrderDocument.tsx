import { BrandMark } from '@/components/BrandMark';
import { formatLkr } from '@/lib/format';
import type { CompanyProfile } from '@/lib/company-profile';
import type { PurchaseOrderDocument as PoDoc } from '@/lib/purchasing';

function formatDate(d: Date | string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatQty(value: string | number) {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('en-LK', { maximumFractionDigits: 4 })
    : String(value);
}

export function PurchaseOrderDocument({
  document,
  company,
  printMode = false,
}: {
  document: PoDoc;
  company: CompanyProfile;
  printMode?: boolean;
}) {
  const { order, lines } = document;
  const b = company.branding;
  const itemCount = lines.length;
  const totalQty = lines.reduce((s, l) => s + Number(l.quantity), 0);

  return (
    <article
      className={`po-document mx-auto text-slate-900 ${
        printMode ? 'po-document--print max-w-none' : 'max-w-4xl border border-slate-300 shadow-sm'
      }`}
    >
      <div className="po-doc-body">
        {/* Header — distributor invoice layout */}
        <div className="po-doc-top grid gap-4 border-b border-slate-400 pb-4 sm:grid-cols-[auto_1fr_auto]">
          <div className="flex gap-3">
            <BrandMark size="lg" />
            <div>
              <p className="font-display text-base font-bold uppercase tracking-wide text-slate-900">
                St. Anthony&apos;s
              </p>
              <p className="text-[10px] font-bold tracking-widest text-slate-600 uppercase">
                Authorised Distributor
              </p>
            </div>
          </div>

          <div className="text-center text-sm leading-snug text-slate-800">
            {b.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {b.phone && <p>Tel: {b.phone}</p>}
            {b.email && <p>{b.email}</p>}
          </div>

          <div className="text-right text-xs text-slate-600 sm:min-w-[9rem]">
            <p>{formatDateTime(order.created_at)}</p>
            <p className="mt-1 font-mono font-semibold text-slate-900">{order.po_number}</p>
          </div>
        </div>

        <h1 className="po-doc-heading mt-4 text-center font-display text-lg font-bold tracking-wide text-slate-900 uppercase">
          Purchase Order
        </h1>

        {/* Meta rows — label : value like Tally invoices */}
        <div className="po-doc-meta mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Field label="PO No" value={order.po_number} mono />
          <Field label="Supplier" value={order.supplier_name} />
          <Field label="PO Date" value={formatDate(order.created_at)} />
          <Field label="Supplier code" value={order.supplier_code} mono />
          <Field label="Payment terms" value={`${order.payment_terms_days} days credit`} />
          <Field label="Product line" value={order.vendor_name} />
          <Field label="Expected delivery" value={formatDate(order.expected_date)} />
          <Field label="Status" value={order.status} capitalize />
        </div>

        <div className="po-doc-meta mt-3 border-t border-slate-300 pt-3 text-sm">
          <Field label="Ship to" value={b.legalName} />
          <Field label="Deliver to" value={order.location_name} />
          {order.location_tally_name && order.location_tally_name !== order.location_name && (
            <Field label="Location (Tally)" value={order.location_tally_name} />
          )}
          {order.supplier_phone && <Field label="Supplier tel" value={order.supplier_phone} />}
          {b.vatNo && <Field label="Buyer VAT" value={b.vatNo} />}
        </div>

        {/* Lines table */}
        <div className="po-doc-table-wrap mt-5 overflow-x-auto border border-slate-300">
          <table className="po-doc-table w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="po-th w-8">#</th>
                <th className="po-th w-24">Item code</th>
                <th className="po-th">Description</th>
                <th className="po-th text-right w-16">Qty</th>
                <th className="po-th text-right w-24">Price</th>
                <th className="po-th text-right w-28">Value</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td className="po-td text-center font-mono text-xs">{line.line_no}</td>
                  <td className="po-td font-mono text-xs">{line.primary_sku ?? '—'}</td>
                  <td className="po-td">
                    {line.item_name}
                    {line.stock_group_name && (
                      <span className="block text-xs text-slate-500">{line.stock_group_name}</span>
                    )}
                  </td>
                  <td className="po-td text-right font-mono tabular-nums">
                    {formatQty(line.quantity)}
                  </td>
                  <td className="po-td text-right font-mono tabular-nums">
                    {formatLkr(line.unit_rate)}
                  </td>
                  <td className="po-td text-right font-mono font-medium tabular-nums">
                    {formatLkr(line.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals row */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4 text-sm">
          <p className="text-slate-700">
            Total no. of items: <span className="font-mono font-semibold">{itemCount}</span>
            <span className="mx-2 text-slate-300">|</span>
            Total qty: <span className="font-mono font-semibold">{formatQty(totalQty)}</span>
          </p>
          <div className="po-doc-total-box min-w-[14rem] border border-slate-400 px-4 py-2 text-right">
            <p className="text-xs text-slate-600 uppercase">PO value (LKR)</p>
            <p className="font-mono text-lg font-bold text-slate-900">
              {formatLkr(order.total_amount)}
            </p>
          </div>
        </div>

        {order.notes && (
          <p className="mt-4 border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            <span className="font-semibold">Note:</span> {order.notes}
          </p>
        )}

        <div className="po-doc-signatures mt-8 grid gap-10 border-t border-slate-300 pt-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase">Prepared by</p>
            <div className="po-signature-line mt-12" />
            <p className="mt-1 text-xs text-slate-500">Name & signature</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase">
              Authorized by supplier
            </p>
            <div className="po-signature-line mt-12" />
            <p className="mt-1 text-xs text-slate-500">Stamp / signature / date</p>
          </div>
        </div>

        <p className="po-doc-footer mt-6 border-t border-slate-300 pt-3 text-center text-[10px] text-slate-500">
          {b.displayName}
          {b.vatNo ? ` · VAT ${b.vatNo}` : ''}
          <br />
          {order.po_number} · Printed {formatDateTime(new Date())}
        </p>
      </div>
    </article>
  );
}

function Field({
  label,
  value,
  mono,
  capitalize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="po-field flex gap-2 py-0.5">
      <span className="po-field-label w-28 shrink-0 font-semibold text-slate-700">{label}</span>
      <span className="text-slate-500">:</span>
      <span
        className={`min-w-0 flex-1 text-slate-900 ${mono ? 'font-mono text-xs' : ''} ${capitalize ? 'capitalize' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
