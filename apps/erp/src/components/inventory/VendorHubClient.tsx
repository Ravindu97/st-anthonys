'use client';

import { useMemo, useState } from 'react';
import { VendorHubTable, type VendorHubRow } from './VendorHubTable';

export function VendorHubClient({
  vendors,
  totalValue,
}: {
  vendors: VendorHubRow[];
  totalValue?: number | string;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'value' | 'name' | 'alerts'>('value');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = vendors;
    if (q) {
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          v.location_name.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'alerts') {
        const alertA = Number(a.low_stock) + Number(a.out_of_stock);
        const alertB = Number(b.low_stock) + Number(b.out_of_stock);
        return alertB - alertA;
      }
      return Number(b.total_value) - Number(a.total_value);
    });
  }, [vendors, query, sort]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Vendors
          <span className="ml-2 font-mono text-sm font-normal text-slate-400">
            {filtered.length}
            {query ? ` / ${vendors.length}` : ''}
          </span>
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Search name, code, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue-500 focus:ring-2 focus:ring-brand-blue-100 focus:outline-none sm:w-64"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            aria-label="Sort vendors"
          >
            <option value="value">Stock value</option>
            <option value="alerts">Alerts</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          No vendors match your search.
        </p>
      ) : (
        <VendorHubTable vendors={filtered} totalValue={totalValue} />
      )}
    </section>
  );
}
