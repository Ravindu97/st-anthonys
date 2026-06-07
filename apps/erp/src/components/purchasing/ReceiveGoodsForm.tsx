'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Line = {
  id: string;
  item_name: string;
  primary_sku: string | null;
  quantity: number;
  received_qty: number;
};

export function ReceiveGoodsForm({
  purchaseOrderId,
  lines,
}: {
  purchaseOrderId: string;
  lines: Line[];
}) {
  const router = useRouter();
  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((l) => [l.id, String(Math.max(0, l.quantity - l.received_qty))])
    )
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const recvLines = lines
        .map((l) => ({ lineId: l.id, quantity: Number(qtys[l.id] ?? 0) }))
        .filter((l) => l.quantity > 0);

      if (recvLines.length === 0) {
        throw new Error('Enter quantity to receive for at least one line');
      }

      const res = await fetch(`/api/purchasing/orders/${purchaseOrderId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: recvLines, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Receive failed');
      setMessage(`Goods received — ${data.grnNumber}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Receive failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="font-display text-sm font-semibold text-slate-900">
        Receive goods (GRN)
      </h2>
      <div className="mt-4 space-y-3">
        {lines.map((line) => {
          const remaining = Math.max(0, line.quantity - line.received_qty);
          if (remaining <= 0) return null;
          return (
            <div key={line.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 font-mono text-xs text-slate-500">
                {line.primary_sku ?? '—'}
              </span>
              <span className="max-w-xs truncate text-slate-800">{line.item_name}</span>
              <label className="text-xs text-slate-500">
                Qty (max {remaining})
                <input
                  type="number"
                  min={0}
                  max={remaining}
                  value={qtys[line.id]}
                  onChange={(e) =>
                    setQtys((prev) => ({ ...prev, [line.id]: e.target.value }))
                  }
                  className="ml-1 w-20 rounded border border-slate-200 px-2 py-1 font-mono"
                />
              </label>
            </div>
          );
        })}
      </div>
      <label className="mt-4 block text-xs text-slate-500">
        Notes
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Posting…' : 'Post goods receipt'}
        </button>
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>
    </form>
  );
}
