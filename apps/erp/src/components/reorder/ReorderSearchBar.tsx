'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { reorderHubUrl } from '@/lib/reorder-url';

export function ReorderSearchBar({
  tab,
  q,
  vendor,
}: {
  tab: string;
  q?: string;
  vendor?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q ?? '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(
      reorderHubUrl({
        tab,
        q: query.trim() || undefined,
        vendor,
        page: 1,
      })
    );
  }

  function clear() {
    setQuery('');
    router.push(reorderHubUrl({ tab, vendor, page: 1 }));
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md gap-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search SKU, item, vendor…"
        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-blue-500 focus:ring-2 focus:ring-brand-blue-100 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
      >
        Search
      </button>
      {q && (
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Clear
        </button>
      )}
    </form>
  );
}
