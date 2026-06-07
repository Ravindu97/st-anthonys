'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type StockHit = { stock_item_id: string; item_name: string; primary_sku: string };

export type PriceListItemEdit = {
  stockItemId: string;
  sku: string;
  itemName: string;
  fromQty: number;
  rate: number;
  discountPct: number;
};

export function PriceListItemForm({
  priceListId,
  categoryId,
  initial,
  onCancel,
}: {
  priceListId: string;
  categoryId: string | null;
  initial?: PriceListItemEdit | null;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initial?.sku ?? '');
  const [hits, setHits] = useState<StockHit[]>([]);
  const [selected, setSelected] = useState<StockHit | null>(
    initial
      ? {
          stock_item_id: initial.stockItemId,
          item_name: initial.itemName,
          primary_sku: initial.sku,
        }
      : null
  );
  const [fromQty, setFromQty] = useState(String(initial?.fromQty ?? 0));
  const [rate, setRate] = useState(initial ? String(initial.rate) : '');
  const [discountPct, setDiscountPct] = useState(String(initial?.discountPct ?? 0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial || !query.trim() || selected) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q: query });
      if (categoryId) params.set('categoryId', categoryId);
      fetch(`/api/pricing/search-items?${params}`)
        .then((r) => r.json())
        .then((d) => setHits(d.items ?? []))
        .catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query, categoryId, initial, selected]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Select an item');
      return;
    }
    if (!rate.trim() || Number.isNaN(Number(rate))) {
      setError('Rate is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pricing/lists/${priceListId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockItemId: selected.stock_item_id,
          fromQty: parseFloat(fromQty) || 0,
          rate: parseFloat(rate),
          discountPct: parseFloat(discountPct) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      router.refresh();
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
    >
      <h3 className="text-sm font-semibold text-slate-900">
        {initial ? 'Edit price' : 'Add price'}
      </h3>

      {!initial && (
        <div className="relative">
          <label className="text-xs font-medium text-slate-500">Search SKU or item name</label>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Type SKU…"
          />
          {hits.length > 0 && !selected && (
            <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {hits.map((h) => (
                <li key={h.stock_item_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(h);
                      setQuery(h.primary_sku);
                      setHits([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-mono text-xs text-slate-500">{h.primary_sku}</span>
                    <span className="ml-2">{h.item_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && (
        <p className="text-sm text-slate-600">
          <span className="font-mono text-xs">{selected.primary_sku}</span>
          <span className="ml-2 font-medium">{selected.item_name}</span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-slate-500">From qty</label>
          <input
            type="number"
            min={0}
            value={fromQty}
            onChange={(e) => setFromQty(e.target.value)}
            disabled={Boolean(initial)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Rate (LKR)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Discount %</label>
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !selected}
          className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save price'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
