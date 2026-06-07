import { BrandMark } from '@/components/BrandMark';
import { formatLkr } from '@/lib/format';
import type { CompanyProfile } from '@/lib/company-profile';
import type { GoodsReceiptDocument as GrnDoc } from '@/lib/purchasing';

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

export function GrnDocument({
  document,
  company,
  printMode = false,
}: {
  document: GrnDoc;
  company: CompanyProfile;
  printMode?: boolean;
}) {
  const { receipt, purchase_order: po, lines } = document;
  const b = company.branding;
  const totalQty = lines.reduce((s, l) => s + Number(l.quantity), 0);
  const totalValue = lines.reduce((s, l) => s + Number(l.line_total), 0);

  return (
    <article
      className={`po-document mx-auto text-slate-900 ${
        printMode ? 'po-document--print max-w-none' : 'max-w-4xl border border-slate-300 shadow-sm'
      }`}
    >
      <div className="po-doc-body">
        <div className="po-doc-top grid gap-4 border-b border-slate-400 pb-4 sm:grid-cols-[auto_1fr_auto]">
          <div className="flex gap-3">
            <BrandMark size="lg" />
            <div>
              <p className="font-display text-base font-bold uppercase tracking-wide text-slate-900">
                St. Anthony&apos;s
              </p>
              <p className="text-[10px] font-bold tracking-widest text-slate-600 uppercase">
                Goods Receipt Note
              </p>
            </div>
          </div>

          <div className="text-center text-sm leading-snug text-slate-800">
            {b.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {b.phone && <p>Tel: {b.phone}</p>}
          </div>

          <div className="text-right text-xs text-slate-600 sm:min-w-[9rem]">
            <p>{formatDateTime(receipt.received_at)}</p>
            <p className="mt-1 font-mono font-semibold text-slate-900">{receipt.grn_number}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
          <Field label="Purchase order" value={po.po_number} mono />
          <Field label="Supplier" value={`${po.supplier_code} — ${po.supplier_name}`} />
          <Field label="Location" value={receipt.location_name} />
          {receipt.location_tally_name &&
            receipt.location_tally_name !== receipt.location_name && (
              <Field label="Location (Tally)" value={receipt.location_tally_name} />
            )}
          <Field label="Received by" value={receipt.created_by_email ?? '—'} />
          <Field label="PO status" value={po.status} capitalize />
        </div>

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
                  <td className="po-td">{line.item_name}</td>
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

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4 text-sm">
          <p className="text-slate-700">
            Lines: <span className="font-mono font-semibold">{lines.length}</span>
            <span className="mx-2 text-slate-300">|</span>
            Total qty: <span className="font-mono font-semibold">{formatQty(totalQty)}</span>
          </p>
          <div className="po-doc-total-box min-w-[14rem] border border-slate-400 px-4 py-2 text-right">
            <p className="text-xs text-slate-600 uppercase">Received value (LKR)</p>
            <p className="font-mono text-lg font-bold text-slate-900">{formatLkr(totalValue)}</p>
          </div>
        </div>

        {receipt.notes && (
          <p className="mt-4 border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            <span className="font-semibold">Note:</span> {receipt.notes}
          </p>
        )}

        <p className="po-doc-footer mt-6 border-t border-slate-300 pt-3 text-center text-[10px] text-slate-500">
          {b.displayName}
          <br />
          {receipt.grn_number} · PO {po.po_number} · Printed {formatDate(new Date())}
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
