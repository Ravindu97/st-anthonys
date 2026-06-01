'use client';

import Link from 'next/link';
import { formatLkr } from '@/lib/format';
import { vendorAlertItemUrl } from '@/lib/inventory-url';
import type { CrossVendorAlertRow } from '@/lib/inventory-search';

const itemLinkClass =
  'text-brand-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500';

export function AlertsTable({ items }: { items: CrossVendorAlertRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[720px] w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-100">
            <th className="px-4 py-3 font-medium text-slate-500">Vendor</th>
            <th className="px-4 py-3 font-medium text-slate-500">Unit</th>
            <th className="px-4 py-3 font-medium text-slate-500">Product</th>
            <th className="px-4 py-3 font-medium text-slate-500">Group</th>
            <th className="px-4 py-3 text-center font-medium text-slate-500">
              Status
            </th>
            <th className="px-4 py-3 text-right font-medium text-slate-500">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => {
            const itemHref = vendorAlertItemUrl(row.vendor_slug, row);
            return (
              <tr
                key={`${row.vendor_code}-${row.primary_sku}-${i}`}
                className="border-b border-slate-50 hover:bg-brand-blue-50/30"
              >
                <td className="px-4 py-3">
                  <Link href={itemHref} className={`font-semibold ${itemLinkClass}`}>
                    {row.vendor_name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={itemHref} className={itemLinkClass}>
                    {row.primary_sku ?? '—'}
                  </Link>
                </td>
                <td className="max-w-xs truncate px-4 py-3">
                  <Link href={itemHref} className={`text-slate-900 ${itemLinkClass}`}>
                    {row.item_name}
                  </Link>
                </td>
                <td className="max-w-[8rem] truncate px-4 py-3 text-xs text-slate-500">
                  {row.stock_group_name}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={row.alert_status} />
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                  <Link href={itemHref} className={itemLinkClass}>
                    {formatLkr(row.line_value)}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: CrossVendorAlertRow['alert_status'] }) {
  if (status === 'variance') {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
        Mismatch
      </span>
    );
  }
  if (status === 'out_of_stock') {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
        Out
      </span>
    );
  }
  return (
    <span className="rounded-full bg-brand-gold-50 px-2 py-0.5 text-xs font-medium text-brand-gold-800">
      Low
    </span>
  );
}
