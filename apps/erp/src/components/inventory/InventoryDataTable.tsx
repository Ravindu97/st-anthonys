'use client';

import Link from 'next/link';
import { formatLkr } from '@/lib/format';
import { unitDetailUrl } from '@/lib/inventory-url';
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

function SortHeader({
  label,
  active,
  direction,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  direction?: 'asc' | 'desc';
  onClick?: () => void;
  align?: 'left' | 'right';
}) {
  if (!onClick) {
    return (
      <th
        className={`px-4 py-3 font-medium text-slate-500 ${align === 'right' ? 'text-right' : ''}`}
      >
        {label}
      </th>
    );
  }

  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-left text-sm font-medium transition-colors ${
          active
            ? 'text-brand-blue-700'
            : 'text-slate-500 hover:text-brand-blue-600'
        }`}
      >
        {label}
        <span className="font-mono text-[10px] text-brand-blue-500" aria-hidden>
          {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

type Props = {
  rows: InventoryItemRow[];
  vendorSlug: string;
  sort?: string;
  onSortChange?: (sort: string) => void;
};

export function InventoryDataTable({ rows, vendorSlug, sort, onSortChange }: Props) {
  const skuActive = sort === 'sku_asc' || sort === 'sku_desc';
  const valueActive = sort === 'value_desc' || sort === 'value_asc';
  const qtyActive = sort === 'qty_desc' || sort === 'qty_asc';

  const toggleSku = () => {
    onSortChange?.(sort === 'sku_asc' ? 'sku_desc' : 'sku_asc');
  };
  const toggleValue = () => {
    onSortChange?.(sort === 'value_desc' ? 'value_asc' : 'value_desc');
  };
  const toggleQty = () => {
    onSortChange?.(sort === 'qty_desc' ? 'qty_asc' : 'qty_desc');
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
            <tr className="border-b border-slate-100">
              <SortHeader
                label="Unit code / product"
                active={skuActive}
                direction={sort === 'sku_desc' ? 'desc' : 'asc'}
                onClick={onSortChange ? toggleSku : undefined}
              />
              <SortHeader
                label="Qty"
                active={qtyActive}
                direction={sort === 'qty_desc' ? 'desc' : 'asc'}
                onClick={onSortChange ? toggleQty : undefined}
              />
              <th className="hidden px-4 py-3 font-medium text-slate-500 md:table-cell">
                Rate
              </th>
              <th className="px-4 py-3 font-medium text-slate-500">Status</th>
              <SortHeader
                label="Value"
                active={valueActive}
                direction={sort === 'value_desc' ? 'desc' : 'asc'}
                onClick={onSortChange ? toggleValue : undefined}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const qty = Number(row.quantity ?? 0);
              const unitHref = unitDetailUrl(vendorSlug, {
                stockItemId: row.stock_item_id,
                sku: row.primary_sku,
              });
              return (
                <tr
                  key={row.stock_item_id}
                  className={`border-b border-slate-100/80 transition-colors hover:bg-brand-blue-50/40 ${
                    i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    {row.primary_sku ? (
                      <Link
                        href={unitHref}
                        className="block font-mono text-xs font-semibold text-brand-blue-600 hover:underline"
                      >
                        {row.primary_sku}
                      </Link>
                    ) : (
                      <Link
                        href={unitHref}
                        className="block font-mono text-xs font-semibold text-brand-blue-600 hover:underline"
                      >
                        View unit
                      </Link>
                    )}
                    <Link
                      href={unitHref}
                      className="font-semibold text-slate-900 hover:text-brand-blue-600 hover:underline"
                    >
                      {row.item_name}
                    </Link>
                    <span className="mt-0.5 block w-fit rounded bg-brand-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-blue-700 uppercase">
                      {row.stock_group_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-800 tabular-nums">
                    <strong>{qty.toLocaleString()}</strong>{' '}
                    <span className="text-xs text-slate-400">{row.unit_code}</span>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-slate-600 tabular-nums md:table-cell">
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
