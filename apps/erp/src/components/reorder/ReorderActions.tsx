'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ReorderActions() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function syncSuggestions() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/reorder/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setMessage(`Created ${data.created} new suggestions (scanned ${data.scanned})`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={syncSuggestions}
        disabled={loading}
        className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600 disabled:opacity-50"
      >
        {loading ? 'Scanning…' : 'Scan & generate suggestions'}
      </button>
      {message && <p className="text-xs text-slate-500">{message}</p>}
    </div>
  );
}
