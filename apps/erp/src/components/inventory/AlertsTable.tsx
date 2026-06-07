'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatLkr } from '@/lib/format';
import { unitDetailUrl, vendorInventoryUrl } from '@/lib/inventory-url';
import type { CrossVendorAlertRow } from '@/lib/inventory-search';

function rowUnitHref(row: CrossVendorAlertRow) {
  return unitDetailUrl(row.vendor_slug, {
    stockItemId: row.stock_item_id,
    sku: row.primary_sku,
  });
}

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
            <th className="px-4 py-3 text-right font-medium text-slate-500">
              Reorder
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const unitHref = rowUnitHref(row);
            return (
              <AlertRow key={`${row.vendor_code}-${row.stock_item_id}`} row={row} unitHref={unitHref} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AlertRow({
  row,
  unitHref,
}: {
  row: CrossVendorAlertRow;
  unitHref: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const showReorder =
    row.alert_status === 'low_stock' || row.alert_status === 'out_of_stock';

  async function addToReorder() {
    setLoading(true);
    try {
      const res = await fetch('/api/reorder/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_for_item',
          stockItemId: row.stock_item_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes('No reorder rule')) {
          router.push(
            `${unitHref}${unitHref.includes('?') ? '&' : '?'}setRule=1`
          );
          return;
        }
        throw new Error(data.error ?? 'Failed');
      }
      router.push('/inventory/reorder?tab=action');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not add to reorder');
    } finally {
      setLoading(false);
    }
  }

  return (
              <tr
                className="border-b border-slate-50 hover:bg-brand-blue-50/30"
              >
                <td className="px-4 py-3">
                  <Link
                    href={vendorInventoryUrl(row.vendor_slug, { tab: 'stock' })}
                    className="font-semibold text-brand-blue-600 hover:underline"
                  >
                    {row.vendor_name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={unitHref}
                    className="font-mono text-xs font-medium text-brand-blue-600 hover:underline"
                  >
                    {row.primary_sku ?? '—'}
                  </Link>
                </td>
                <td className="max-w-xs px-4 py-3">
                  <Link
                    href={unitHref}
                    className="block truncate text-slate-900 hover:text-brand-blue-600 hover:underline"
                  >
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
                  {formatLkr(row.line_value)}
                </td>
                <td className="px-4 py-3 text-right">
                  {showReorder ? (
                    <button
                      type="button"
                      onClick={addToReorder}
                      disabled={loading}
                      className="text-xs font-medium text-brand-blue-600 hover:underline disabled:opacity-50"
                    >
                      {loading ? '…' : 'Add to reorder'}
                    </button>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
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
