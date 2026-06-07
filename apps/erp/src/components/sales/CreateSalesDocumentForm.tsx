'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatLkr } from '@/lib/format';
import { PosCustomerPicker, type PosCustomer } from '@/components/pos/PosCustomerPicker';
import { PosItemPicker, type PosLookupItem } from '@/components/pos/PosItemPicker';

type LocationOption = {
  id: string;
  name: string;
  vendor_code: string;
};

type LineDraft = {
  stockItemId: string;
  item_name: string;
  sku: string;
  quantity: number;
  unit_rate: number;
};

export function CreateSalesDocumentForm({
  locations,
}: {
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [docKind, setDocKind] = useState<'quote' | 'order'>('quote');
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location = locations.find((l) => l.id === locationId);

  function addLine(item: PosLookupItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.stockItemId === item.stock_item_id);
      if (existing) {
        return prev.map((l) =>
          l.stockItemId === item.stock_item_id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          stockItemId: item.stock_item_id,
          item_name: item.item_name,
          sku: item.sku,
          quantity: 1,
          unit_rate: item.unit_rate,
        },
      ];
    });
  }

  function updateLineQty(stockItemId: string, quantity: number) {
    if (quantity <= 0) {
      setLines((prev) => prev.filter((l) => l.stockItemId !== stockItemId));
      return;
    }
    setLines((prev) =>
      prev.map((l) => (l.stockItemId === stockItemId ? { ...l, quantity } : l))
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Add at least one line');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docKind,
          customerId: customer?.id,
          fulfillmentType: docKind === 'order' ? fulfillmentType : 'pickup',
          locationId: locationId || undefined,
          notes: notes.trim() || undefined,
          lines: lines.map((l) => ({
            stockItemId: l.stockItemId,
            quantity: l.quantity,
            unitRate: l.unit_rate,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not create document');
      router.push(`/orders/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_rate, 0);

  return (
    <form
      id="create-sales"
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
    >
      <h2 className="font-display text-lg font-semibold text-slate-900">New quote or order</h2>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="text-xs font-medium text-slate-500">Type</span>
          <select
            value={docKind}
            onChange={(e) => setDocKind(e.target.value as 'quote' | 'order')}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="quote">Quote (QT)</option>
            <option value="order">Order (SO)</option>
          </select>
        </label>
        {docKind === 'order' && (
          <label className="text-sm">
            <span className="text-xs font-medium text-slate-500">Fulfillment</span>
            <select
              value={fulfillmentType}
              onChange={(e) =>
                setFulfillmentType(e.target.value as 'pickup' | 'delivery')
              }
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="pickup">Pickup</option>
              <option value="delivery">Delivery</option>
            </select>
          </label>
        )}
        <label className="text-sm min-w-[12rem] flex-1">
          <span className="text-xs font-medium text-slate-500">Stock location</span>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.vendor_code})
              </option>
            ))}
          </select>
        </label>
      </div>

      <PosCustomerPicker customer={customer} onSelect={setCustomer} />

      {location && (
        <PosItemPicker
          locationId={location.id}
          priceLevelId={null}
          customerId={customer?.id}
          onAdd={addLine}
        />
      )}

      {lines.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.stockItemId}>
                  <td className="px-3 py-2 font-mono text-xs">{l.sku}</td>
                  <td className="px-3 py-2">{l.item_name}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) =>
                        updateLineQty(l.stockItemId, Number(e.target.value))
                      }
                      className="w-16 rounded border border-slate-200 px-1 py-0.5 text-right font-mono"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {formatLkr(l.unit_rate)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatLkr(l.quantity * l.unit_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-3 py-2 text-right text-sm font-semibold">
            Total {formatLkr(total)}
          </p>
        </div>
      )}

      <label className="block text-sm">
        <span className="text-xs font-medium text-slate-500">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || lines.length === 0}
        className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {loading ? 'Creating…' : docKind === 'quote' ? 'Create quote' : 'Create order'}
      </button>
    </form>
  );
}
