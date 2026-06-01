'use client';

import { useMemo, useState } from 'react';
import { formatLkrAmount } from '@/lib/format';
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

  const portfolioTotal = Number(totalValue ?? 0);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Vendors
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {filtered.length === vendors.length
              ? `${vendors.length} active locations`
              : `${filtered.length} of ${vendors.length} shown`}
            {portfolioTotal > 0 && (
              <span className="text-slate-400">
                {' '}
                · Portfolio (LKR) {formatLkrAmount(portfolioTotal)}
              </span>
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
          <input
            type="search"
            placeholder="Search name, code, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-blue-500 focus:bg-white focus:ring-2 focus:ring-brand-blue-100 focus:outline-none"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-40"
            aria-label="Sort vendors"
          >
            <option value="value">Sort: stock value</option>
            <option value="alerts">Sort: alerts</option>
            <option value="name">Sort: name</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          No vendors match your search.
        </p>
      ) : (
        <VendorHubTable vendors={filtered} />
      )}
    </section>
  );
}
