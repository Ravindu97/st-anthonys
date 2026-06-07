import { BrandMark } from '@/components/BrandMark';
import { formatLkr } from '@/lib/format';
import type { CompanyProfile } from '@/lib/company-profile';
import type { SalesLine } from '@/lib/sales';

type SalesDocHeader = {
  doc_kind: string;
  doc_number: string;
  status: string;
  fulfillment_type: string;
  customer_name: string | null;
  customer_code: string | null;
  location_name?: string | null;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  notes: string | null;
  valid_until?: string | Date | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  created_at: Date;
};

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

function docTitle(docKind: string) {
  return docKind === 'quote' ? 'Quotation' : 'Sales Order';
}

export function SalesOrderDocument({
  document,
  lines,
  company,
  printMode = false,
}: {
  document: SalesDocHeader;
  lines: SalesLine[];
  company: CompanyProfile;
  printMode?: boolean;
}) {
  const b = company.branding;
  const isQuote = document.doc_kind === 'quote';

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
                {docTitle(document.doc_kind)}
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
            <p>{formatDateTime(document.created_at)}</p>
            <p className="mt-1 font-mono font-semibold text-slate-900">{document.doc_number}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
          <Field label="Customer" value={document.customer_name ?? 'Walk-in'} />
          {document.customer_code && (
            <Field label="Customer code" value={document.customer_code} mono />
          )}
          <Field label="Status" value={document.status.replace(/_/g, ' ')} capitalize />
          <Field label="Fulfillment" value={document.fulfillment_type} capitalize />
          {document.location_name && <Field label="Location" value={document.location_name} />}
          {document.payment_method && (
            <Field label="Payment" value={document.payment_method} capitalize />
          )}
          {document.payment_reference && (
            <Field label="Auth ref" value={document.payment_reference} mono />
          )}
          {isQuote && document.valid_until && (
            <Field label="Valid until" value={formatDate(document.valid_until)} />
          )}
        </div>

        <div className="po-doc-table-wrap mt-5 overflow-x-auto border border-slate-300">
          <table className="po-doc-table w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="po-th w-8">#</th>
                <th className="po-th w-24">SKU</th>
                <th className="po-th">Description</th>
                <th className="po-th text-right w-16">Qty</th>
                <th className="po-th text-right w-24">Rate</th>
                <th className="po-th text-right w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td className="po-td text-center font-mono text-xs">{line.line_no}</td>
                  <td className="po-td font-mono text-xs">{line.primary_sku ?? '—'}</td>
                  <td className="po-td">
                    {line.item_name}
                    {line.is_special_order && (
                      <span className="ml-1 text-xs text-amber-700">(Special order)</span>
                    )}
                  </td>
                  <td className="po-td text-right font-mono tabular-nums">{line.quantity}</td>
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

        <div className="mt-4 flex flex-wrap items-start justify-end gap-4 text-sm">
          <div className="po-doc-total-box min-w-[14rem] border border-slate-400 px-4 py-2 text-right">
            <p className="text-xs text-slate-600 uppercase">Total (LKR)</p>
            <p className="font-mono text-lg font-bold text-slate-900">
              {formatLkr(document.total_amount)}
            </p>
          </div>
        </div>

        {document.notes && (
          <p className="mt-4 border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            <span className="font-semibold">Note:</span> {document.notes}
          </p>
        )}

        {isQuote && (
          <p className="mt-4 text-xs text-slate-600 italic">
            This quotation is not a tax invoice. Prices are subject to stock availability.
          </p>
        )}

        <p className="po-doc-footer mt-6 border-t border-slate-300 pt-3 text-center text-[10px] text-slate-500">
          {b.displayName}
          <br />
          {document.doc_number} · Printed {formatDate(new Date())}
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
