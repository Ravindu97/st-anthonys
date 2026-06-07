import { BrandMark } from '@/components/BrandMark';
import { formatLkr } from '@/lib/format';
import type { CompanyProfile } from '@/lib/company-profile';
import type { PosTransactionDocument } from '@/lib/pos';

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

export function PosReceiptDocument({
  document,
  company,
  printMode = false,
  reprintedAt,
}: {
  document: PosTransactionDocument;
  company: CompanyProfile;
  printMode?: boolean;
  reprintedAt?: Date;
}) {
  const { transaction: txn, register, location, lines } = document;
  const b = company.branding;

  return (
    <article
      className={`receipt-document mx-auto text-slate-900 ${
        printMode
          ? 'receipt-document--print max-w-none'
          : 'max-w-md border border-slate-300 shadow-sm'
      }`}
    >
      <div className="po-doc-body">
        <div className="text-center border-b border-slate-400 pb-3">
          <div className="flex justify-center mb-2">
            <BrandMark size="md" />
          </div>
          <p className="font-display text-sm font-bold uppercase tracking-wide">
            {b.displayName}
          </p>
          {b.addressLines.map((line) => (
            <p key={line} className="text-xs text-slate-600">
              {line}
            </p>
          ))}
          {b.phone && <p className="text-xs text-slate-600">Tel: {b.phone}</p>}
        </div>

        <div className="mt-3 text-center text-xs">
          <p className="font-bold uppercase tracking-wider text-slate-700">Sales Receipt</p>
          <p className="mt-1 font-mono font-semibold text-base">{txn.transaction_number}</p>
          <p className="text-slate-600">{formatDateTime(txn.created_at)}</p>
        </div>

        <div className="mt-3 space-y-1 text-xs">
          <Row label="Register" value={register.name} />
          <Row label="Location" value={location.name} />
          <Row label="Customer" value={txn.customer_name ?? 'Walk-in'} />
          <Row label="Payment" value={txn.payment_method} capitalize />
          {txn.payment_reference && (
            <Row label="Auth ref" value={txn.payment_reference} mono />
          )}
        </div>

        <div className="mt-4 border-t border-dashed border-slate-400 pt-2">
          {lines.map((line) => (
            <div key={line.id} className="mb-2 text-xs">
              <p className="font-mono text-[10px] text-slate-500">{line.sku}</p>
              <p className="font-medium leading-snug">{line.item_name}</p>
              <p className="flex justify-between font-mono tabular-nums">
                <span>
                  {formatQty(line.quantity)} × {formatLkr(line.unit_rate)}
                </span>
                <span className="font-semibold">{formatLkr(line.line_total)}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-slate-400 pt-2 text-right">
          <p className="text-xs text-slate-600">Total (LKR)</p>
          <p className="font-mono text-lg font-bold">{formatLkr(txn.total_amount)}</p>
        </div>

        <p className="mt-4 text-center text-[10px] text-slate-500">
          Thank you for your business
          <br />
          {txn.transaction_number}
          {reprintedAt && <> · Reprinted {formatDateTime(reprintedAt)}</>}
        </p>
      </div>
    </article>
  );
}

function Row({
  label,
  value,
  capitalize,
  mono,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span
        className={`font-medium text-right ${capitalize ? 'capitalize' : ''} ${mono ? 'font-mono text-[10px]' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
