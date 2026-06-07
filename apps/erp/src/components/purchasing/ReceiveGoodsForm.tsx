'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ReceiptProgressBar } from './ReceiptProgressBar';

type Line = {
  id: string;
  item_name: string;
  primary_sku: string | null;
  vendor_slug: string;
  quantity: number;
  received_qty: number;
};

type SuccessResult = {
  grnNumber: string;
  grnId: string;
  poStatus: string;
  locationName: string;
  inventoryUpdated: Array<{
    stockItemId: string;
    sku: string | null;
    vendorSlug: string;
    newQty: number;
    quantityReceived: number;
  }>;
};

export function ReceiveGoodsForm({
  purchaseOrderId,
  lines,
  receiptSummary,
  locationName,
  poStatus,
}: {
  purchaseOrderId: string;
  lines: Line[];
  receiptSummary: {
    total_lines: number;
    lines_fully_received: number;
    all_received: boolean;
  };
  locationName: string;
  poStatus: string;
}) {
  const router = useRouter();
  const openLines = useMemo(
    () =>
      lines
        .map((l) => ({
          ...l,
          remaining: Math.max(0, l.quantity - l.received_qty),
        }))
        .filter((l) => l.remaining > 0),
    [lines]
  );

  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(openLines.map((l) => [l.id, String(l.remaining)]))
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessResult | null>(null);

  if (poStatus === 'cancelled') {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        This purchase order was cancelled — goods cannot be received.
      </section>
    );
  }

  if (poStatus === 'received' || receiptSummary.all_received) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <h2 className="font-display text-sm font-semibold text-emerald-900">
          Fully received
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          All {receiptSummary.total_lines} line
          {receiptSummary.total_lines === 1 ? '' : 's'} have been received into inventory.
        </p>
        <Link
          href="/purchasing/receipts"
          className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
        >
          View goods receipts →
        </Link>
      </section>
    );
  }

  function receiveAll() {
    setQtys(Object.fromEntries(openLines.map((l) => [l.id, String(l.remaining)])));
  }

  function clearAll() {
    setQtys(Object.fromEntries(openLines.map((l) => [l.id, '0'])));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const recvLines = openLines
        .map((l) => ({ lineId: l.id, quantity: Number(qtys[l.id] ?? 0) }))
        .filter((l) => l.quantity > 0);

      if (recvLines.length === 0) {
        throw new Error('Enter quantity to receive for at least one line');
      }

      for (const line of openLines) {
        const qty = Number(qtys[line.id] ?? 0);
        if (qty > line.remaining) {
          throw new Error(`Cannot receive more than ${line.remaining} for ${line.primary_sku ?? line.item_name}`);
        }
      }

      const res = await fetch(`/api/purchasing/orders/${purchaseOrderId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: recvLines, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Receive failed');

      setSuccess({
        grnNumber: data.grnNumber,
        grnId: data.grnId,
        poStatus: data.poStatus,
        locationName: data.locationName ?? locationName,
        inventoryUpdated: data.inventoryUpdated ?? [],
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receive failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      id="receive"
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Receive goods (GRN)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Post received quantities to inventory at {locationName}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={receiveAll}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Receive all remaining
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4">
        <ReceiptProgressBar
          linesFullyReceived={receiptSummary.lines_fully_received}
          totalLines={receiptSummary.total_lines}
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2">SKU</th>
              <th className="px-2 py-2">Description</th>
              <th className="px-2 py-2 text-right">Ordered</th>
              <th className="px-2 py-2 text-right">Received</th>
              <th className="px-2 py-2 text-right">Remaining</th>
              <th className="px-2 py-2 text-right">Receive now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {openLines.map((line) => (
              <tr key={line.id}>
                <td className="px-2 py-2 font-mono text-xs text-slate-600">
                  {line.primary_sku ?? '—'}
                </td>
                <td className="max-w-xs truncate px-2 py-2 text-slate-800">{line.item_name}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums">{line.quantity}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">
                  {line.received_qty}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-medium">
                  {line.remaining}
                </td>
                <td className="px-2 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    max={line.remaining}
                    step="any"
                    value={qtys[line.id] ?? '0'}
                    onChange={(e) =>
                      setQtys((prev) => ({ ...prev, [line.id]: e.target.value }))
                    }
                    className="w-24 rounded border border-slate-200 px-2 py-1 text-right font-mono text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {openLines.length === 0 && (
          <p className="py-4 text-sm text-slate-500">No lines remaining to receive.</p>
        )}
      </div>

      <label className="mt-4 block text-xs text-slate-500">
        Notes
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Delivery reference, shortage notes…"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading || openLines.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Posting…' : 'Post goods receipt'}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {success && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-medium text-emerald-900">
            {success.grnNumber} posted — PO status:{' '}
            <span className="capitalize">{success.poStatus}</span>
          </p>
          <p className="mt-1 text-emerald-800">
            Inventory updated for {success.inventoryUpdated.length} item
            {success.inventoryUpdated.length === 1 ? '' : 's'} at {success.locationName}.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={`/purchasing/receipts/${success.grnId}/print`}
              className="font-medium text-emerald-700 hover:underline"
            >
              Print GRN
            </Link>
            {success.inventoryUpdated.map((item) => (
              <Link
                key={item.stockItemId}
                href={`/inventory/${item.vendorSlug}/unit/${encodeURIComponent(item.sku ?? item.stockItemId)}`}
                className="text-emerald-700 hover:underline"
              >
                {item.sku ?? 'View item'} (+{item.quantityReceived})
              </Link>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
