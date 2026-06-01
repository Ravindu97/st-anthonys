'use client';

import { useState } from 'react';

export function VendorHubSearch() {
  const [query, setQuery] = useState('');

  const onChange = (value: string) => {
    setQuery(value);
    const q = value.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>('.vendor-card').forEach((el) => {
      const name = el.dataset.vendorName ?? '';
      const loc = el.dataset.vendorLocation ?? '';
      const match = !q || name.includes(q) || loc.includes(q);
      el.style.display = match ? '' : 'none';
    });
  };

  return (
    <div className="w-full sm:w-72">
      <label htmlFor="vendor-hub-search" className="sr-only">
        Filter vendors
      </label>
      <input
        id="vendor-hub-search"
        type="search"
        placeholder="Filter vendors…"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-blue-500 focus:ring-2 focus:ring-brand-blue-100 focus:outline-none"
      />
    </div>
  );
}
