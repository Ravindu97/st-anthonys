'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function CustomerSearchToolbar({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const showInactive = searchParams.get('activeOnly') === 'false';

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    if (showInactive) next.set('activeOnly', 'false');
    else next.delete('activeOnly');
    next.delete('page');
    router.push(`/customers?${next.toString()}`);
  }

  function toggleInactive() {
    const next = new URLSearchParams(searchParams.toString());
    if (showInactive) next.delete('activeOnly');
    else next.set('activeOnly', 'false');
    next.delete('page');
    router.push(`/customers?${next.toString()}`);
  }

  function clearFilters() {
    setQ('');
    router.push('/customers');
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3 flex-1">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="cust-q" className="text-xs font-medium text-slate-500">
            Search
          </label>
          <input
            id="cust-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, code, or phone…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Search
        </button>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={toggleInactive}
            className="rounded border-slate-300"
          />
          Include inactive
        </label>
        {(searchParams.get('q') || showInactive) && (
          <button
            type="button"
            onClick={clearFilters}
            className="pb-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </form>
      {canWrite && (
        <Link
          href="/customers/new"
          className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-700"
        >
          Add customer
        </Link>
      )}
    </div>
  );
}
