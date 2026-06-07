'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Line = {
  id: string;
  primary_sku: string | null;
  item_name: string;
  quantity: number;
  picked_qty: number;
};

export function PickListClient({
  orderId,
  status,
  lines,
}: {
  orderId: string;
  status: string;
  lines: Line[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Record<string, number>>(
    Object.fromEntries(lines.map((l) => [l.id, l.picked_qty]))
  );
  const [loading, setLoading] = useState(false);

  async function saveLine(lineId: string) {
    await fetch(`/api/sales/${orderId}/pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_pick',
        lineId,
        pickedQty: picked[lineId],
      }),
    });
  }

  async function markReady() {
    setLoading(true);
    try {
      for (const l of lines) await saveLine(l.id);
      await fetch(`/api/sales/${orderId}/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_ready' }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {lines.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <span className="font-mono text-xs text-slate-500 w-24">{l.primary_sku ?? '—'}</span>
            <span className="flex-1 min-w-0">{l.item_name}</span>
            <span className="font-mono text-sm">Qty {l.quantity}</span>
            <input
              type="number"
              min={0}
              max={l.quantity}
              value={picked[l.id] ?? 0}
              onChange={(e) =>
                setPicked((p) => ({ ...p, [l.id]: Number(e.target.value) }))
              }
              className="w-20 rounded border border-slate-200 px-2 py-1 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => saveLine(l.id)}
              className="text-xs text-brand-blue-600 hover:underline"
            >
              Save
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {status !== 'ready_for_pickup' && status !== 'collected' && (
          <button
            type="button"
            disabled={loading}
            onClick={markReady}
            className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Mark ready for pickup
          </button>
        )}
        {status === 'ready_for_pickup' && (
          <p className="text-sm text-slate-500">
            Use the payment panel below when the customer collects.
          </p>
        )}
      </div>
    </div>
  );
}
