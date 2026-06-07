'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReorderWorkbenchLine } from '@/lib/reorder';

export function ReorderLineActions({
  line,
  tab,
}: {
  line: ReorderWorkbenchLine;
  tab: string;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(String(line.suggested_qty));
  const [loading, setLoading] = useState(false);

  async function ensureSuggestionId(): Promise<string | null> {
    if (line.suggestion_id) return line.suggestion_id;
    const res = await fetch('/api/reorder/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_for_item',
        stockItemId: line.stock_item_id,
        locationId: line.location_id,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Could not create suggestion');
    return data.id as string;
  }

  async function approve() {
    setLoading(true);
    try {
      const id = await ensureSuggestionId();
      if (!id) throw new Error('No suggestion');
      const res = await fetch('/api/reorder/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', id, status: 'approved' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Approve failed');
      }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setLoading(false);
    }
  }

  async function dismiss() {
    const note = window.prompt('Dismiss reason (optional)') ?? 'Dismissed';
    setLoading(true);
    try {
      const id = line.suggestion_id ?? (await ensureSuggestionId());
      if (!id) throw new Error('No suggestion');
      const res = await fetch('/api/reorder/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          id,
          status: 'cancelled',
          dismissedNote: note,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Dismiss failed');
      }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Dismiss failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveQty() {
    if (!line.suggestion_id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reorder/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_qty',
          id: line.suggestion_id,
          qty: Number(qty),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Update failed');
      }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  if (tab === 'history') {
    return (
      <span className="text-xs capitalize text-slate-500">
        {line.suggestion_status ?? '—'}
      </span>
    );
  }

  async function revertToDraft() {
    if (!line.suggestion_id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reorder/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert_to_draft', id: line.suggestion_id }),
      });
      if (!res.ok) throw new Error('Could not return to queue');
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  if (tab === 'approved') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-20 rounded border border-slate-200 px-2 py-1 font-mono text-xs"
          aria-label="Order quantity"
        />
        <button
          type="button"
          onClick={saveQty}
          disabled={loading || !line.suggestion_id}
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Save qty
        </button>
        <button
          type="button"
          onClick={revertToDraft}
          disabled={loading}
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50"
        >
          Back to queue
        </button>
      </div>
    );
  }

  if (tab === 'needs_rule') {
    return (
      <a
        href={`/inventory/${line.vendor_slug}/unit/${encodeURIComponent(line.primary_sku ?? line.stock_item_id)}`}
        className="text-xs font-medium text-brand-blue-600 hover:underline"
      >
        Set min qty
      </a>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tab === 'action' && (
        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-20 rounded border border-slate-200 px-2 py-1 font-mono text-xs"
          aria-label="Suggested quantity"
        />
      )}
      {tab === 'action' && line.suggestion_id && (
        <button
          type="button"
          onClick={saveQty}
          disabled={loading}
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Save
        </button>
      )}
      {tab === 'action' && (
        <>
          <button
            type="button"
            onClick={approve}
            disabled={loading}
            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={loading}
            className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
