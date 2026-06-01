import { formatLkr } from '@/lib/format';
import type { InventoryItemRow } from './types';

function stockBadge(qty: number) {
  if (qty <= 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
        Out of stock
      </span>
    );
  }
  if (qty < 10) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold-100 bg-brand-gold-50 px-2.5 py-1 text-xs font-semibold text-brand-gold-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-gold-500" />
        Low stock
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
      In stock
    </span>
  );
}

export function InventoryDataTable({ rows }: { rows: InventoryItemRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[min(70vh,720px)] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3 font-medium text-slate-500">Product</th>
              <th className="px-4 py-3 font-medium text-slate-500">Qty</th>
              <th className="px-4 py-3 font-medium text-slate-500">Rate</th>
              <th className="px-4 py-3 font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const qty = Number(row.quantity ?? 0);
              return (
                <tr
                  key={`${row.primary_sku ?? row.item_name}-${i}`}
                  className={`border-b border-slate-100/80 transition-colors hover:bg-brand-blue-50/40 ${
                    i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    {row.primary_sku && (
                      <span className="block font-mono text-[10px] text-slate-400">
                        {row.primary_sku}
                      </span>
                    )}
                    <span className="font-semibold text-slate-900">
                      {row.item_name}
                    </span>
                    <span className="mt-0.5 block w-fit rounded bg-brand-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-blue-700 uppercase">
                      {row.stock_group_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-800 tabular-nums">
                    <strong>{qty.toLocaleString()}</strong>{' '}
                    <span className="text-xs text-slate-400">{row.unit_code}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600 tabular-nums">
                    {row.rate != null ? formatLkr(row.rate) : '—'}
                  </td>
                  <td className="px-4 py-3">{stockBadge(qty)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {row.value != null ? formatLkr(row.value) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
