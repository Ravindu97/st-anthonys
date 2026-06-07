'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function SalesHubToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');

  function applyFilters(e?: React.FormEvent) {
    e?.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    if (dateFrom) next.set('dateFrom', dateFrom);
    else next.delete('dateFrom');
    if (dateTo) next.set('dateTo', dateTo);
    else next.delete('dateTo');
    next.delete('page');
    router.push(`/orders?${next.toString()}`);
  }

  function clearFilters() {
    setQ('');
    setDateFrom('');
    setDateTo('');
    const next = new URLSearchParams(searchParams.toString());
    next.delete('q');
    next.delete('dateFrom');
    next.delete('dateTo');
    next.delete('page');
    router.push(`/orders?${next.toString()}`);
  }

  return (
    <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[12rem] flex-1">
        <label htmlFor="sales-q" className="text-xs font-medium text-slate-500">
          Search
        </label>
        <input
          id="sales-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Doc # or customer…"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="sales-from" className="text-xs font-medium text-slate-500">
          From
        </label>
        <input
          id="sales-from"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="sales-to" className="text-xs font-medium text-slate-500">
          To
        </label>
        <input
          id="sales-to"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
      >
        Apply
      </button>
      {(searchParams.get('q') || searchParams.get('dateFrom') || searchParams.get('dateTo')) && (
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
        >
          Clear
        </button>
      )}
    </form>
  );
}
