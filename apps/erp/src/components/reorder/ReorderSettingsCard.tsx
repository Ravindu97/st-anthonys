'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function ReorderSettingsCard({
  stockItemId,
  locationId,
  currentQty,
  stockStatus,
}: {
  stockItemId: string;
  locationId: string;
  currentQty: number;
  stockStatus: string;
}) {
  const router = useRouter();
  const [minQty, setMinQty] = useState('10');
  const [reorderQty, setReorderQty] = useState('20');
  const [leadTime, setLeadTime] = useState('0');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [existingMin, setExistingMin] = useState<number | null>(null);

  useEffect(() => {
    fetch(
      `/api/reorder/rules?stockItemId=${stockItemId}&locationId=${locationId}`
    )
      .then((r) => r.json())
      .then((d) => {
        const rule = d.rules?.[0];
        if (rule) {
          setMinQty(rule.min_qty);
          setReorderQty(rule.reorder_qty);
          setLeadTime(String(rule.lead_time_days ?? 0));
          setExistingMin(Number(rule.min_qty));
        }
      })
      .catch(() => {});
  }, [stockItemId, locationId]);

  const threshold = existingMin ?? Number(minQty);
  const statusLabel =
    currentQty <= 0
      ? 'Out of stock'
      : threshold != null && currentQty < threshold
        ? 'Below min'
        : 'OK';

  async function save() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/reorder/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockItemId,
          locationId,
          minQty: Number(minQty),
          reorderQty: Number(reorderQty),
          leadTimeDays: Number(leadTime),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Save failed');
      }
      setExistingMin(Number(minQty));
      setMessage('Reorder settings saved');
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-display text-sm font-semibold text-slate-900">
        Reorder settings
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Status: <span className="font-medium text-slate-700">{statusLabel}</span>
        {threshold != null && ` (min ${threshold})`}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate-500">
          Min qty
          <input
            type="number"
            min={0}
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="text-xs text-slate-500">
          Reorder qty
          <input
            type="number"
            min={1}
            value={reorderQty}
            onChange={(e) => setReorderQty(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="text-xs text-slate-500">
          Lead time (days)
          <input
            type="number"
            min={0}
            value={leadTime}
            onChange={(e) => setLeadTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save reorder rule'}
        </button>
        {message && <span className="text-xs text-slate-600">{message}</span>}
      </div>
    </section>
  );
}
