import { BrandMark } from '@/components/BrandMark';
import type { CompanyProfile } from '@/lib/company-profile';

type PickLine = {
  line_no: number;
  primary_sku: string | null;
  item_name: string;
  quantity: string | number;
  picked_qty: string | number;
};

export function PickListDocument({
  docNumber,
  customerName,
  locationName,
  status,
  lines,
  company,
  printMode = false,
}: {
  docNumber: string;
  customerName: string | null;
  locationName?: string | null;
  status: string;
  lines: PickLine[];
  company: CompanyProfile;
  printMode?: boolean;
}) {
  const b = company.branding;

  return (
    <article
      className={`po-document mx-auto text-slate-900 ${
        printMode ? 'po-document--print max-w-none' : 'max-w-4xl border border-slate-300 shadow-sm'
      }`}
    >
      <div className="po-doc-body">
        <div className="flex items-center gap-3 border-b border-slate-400 pb-4">
          <BrandMark size="lg" />
          <div>
            <p className="font-display text-base font-bold uppercase">Pick List</p>
            <p className="font-mono text-sm">{docNumber}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-700">Customer:</span>{' '}
            {customerName ?? 'Walk-in'}
          </p>
          <p className="capitalize">
            <span className="font-semibold text-slate-700">Status:</span>{' '}
            {status.replace(/_/g, ' ')}
          </p>
          {locationName && (
            <p>
              <span className="font-semibold text-slate-700">Location:</span> {locationName}
            </p>
          )}
        </div>

        <div className="po-doc-table-wrap mt-5 overflow-x-auto border border-slate-300">
          <table className="po-doc-table w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="po-th w-8">#</th>
                <th className="po-th w-28">SKU</th>
                <th className="po-th">Item</th>
                <th className="po-th text-right w-16">Order</th>
                <th className="po-th text-right w-16">Picked</th>
                <th className="po-th w-20">Check</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.line_no}>
                  <td className="po-td text-center font-mono text-xs">{line.line_no}</td>
                  <td className="po-td font-mono text-xs">{line.primary_sku ?? '—'}</td>
                  <td className="po-td">{line.item_name}</td>
                  <td className="po-td text-right font-mono">{line.quantity}</td>
                  <td className="po-td text-right font-mono">{line.picked_qty}</td>
                  <td className="po-td text-center text-slate-400">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="po-doc-footer mt-6 border-t border-slate-300 pt-3 text-center text-[10px] text-slate-500">
          {b.displayName} · {docNumber}
        </p>
      </div>
    </article>
  );
}
