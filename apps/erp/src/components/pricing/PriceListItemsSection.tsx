'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PriceListItemForm, type PriceListItemEdit } from '@/components/pricing/PriceListItemForm';
import { TablePagination } from '@/components/TablePagination';
import { formatLkr } from '@/lib/format';
import { netPrice } from '@/lib/pricing-shared';

type ItemRow = {
  stock_item_id: string;
  item_name: string;
  primary_sku: string | null;
  from_qty: string;
  rate: string;
  discount_pct: string;
};

export function PriceListItemsSection({
  priceListId,
  categoryId,
  canWrite,
  items,
  totalCount,
  page,
  pageSize,
}: {
  priceListId: string;
  categoryId: string | null;
  canWrite: boolean;
  items: ItemRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<PriceListItemEdit | null>(null);
  const [q, setQ] = useState(searchParams.get('q') ?? '');

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    next.delete('page');
    router.push(`/pricing/${priceListId}?${next.toString()}`);
  }

  function closeForm() {
    setFormMode(null);
    setEditing(null);
  }

  function startEdit(row: ItemRow) {
    setFormMode('edit');
    setEditing({
      stockItemId: row.stock_item_id,
      sku: row.primary_sku ?? '',
      itemName: row.item_name,
      fromQty: Number(row.from_qty),
      rate: Number(row.rate),
      discountPct: Number(row.discount_pct ?? 0),
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form onSubmit={applySearch} className="flex flex-wrap items-end gap-2 flex-1">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="pl-q" className="text-xs font-medium text-slate-500">
              Search items
            </label>
            <input
              id="pl-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="SKU or item name…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Search
          </button>
        </form>
        {canWrite && formMode !== 'add' && (
          <button
            type="button"
            onClick={() => {
              setFormMode('add');
              setEditing(null);
            }}
            className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-700"
          >
            Add price
          </button>
        )}
      </div>

      {formMode && (
        <PriceListItemForm
          priceListId={priceListId}
          categoryId={categoryId}
          initial={formMode === 'edit' ? editing : null}
          onCancel={closeForm}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">From qty</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Discount %</th>
              <th className="px-4 py-3 text-right">Net price</th>
              {canWrite && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((row) => (
              <tr key={`${row.stock_item_id}-${row.from_qty}`} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">{row.primary_sku ?? '—'}</td>
                <td className="px-4 py-2">{row.item_name}</td>
                <td className="px-4 py-2 text-right font-mono">{row.from_qty}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatLkr(Number(row.rate))}
                </td>
                <td className="px-4 py-2 text-right">{row.discount_pct}%</td>
                <td className="px-4 py-2 text-right font-mono font-medium">
                  {formatLkr(netPrice(row.rate, row.discount_pct))}
                </td>
                {canWrite && (
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="text-xs text-brand-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">
            {searchParams.get('q')
              ? 'No items match your search.'
              : 'No prices in this list yet.'}
          </p>
        )}
        <TablePagination
          basePath={`/pricing/${priceListId}`}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          searchParams={{ q: searchParams.get('q') ?? undefined }}
        />
      </div>
    </section>
  );
}
