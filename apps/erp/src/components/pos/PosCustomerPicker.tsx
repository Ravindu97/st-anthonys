'use client';

import { useEffect, useState } from 'react';

export type PosCustomer = {
  id: string;
  code: string;
  name: string;
  price_level_name: string | null;
};

export function PosCustomerPicker({
  customer,
  onSelect,
}: {
  customer: PosCustomer | null;
  onSelect: (c: PosCustomer | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PosCustomer[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setResults((d.customers ?? []).slice(0, 8)))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  if (customer) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-lg bg-brand-blue-50 px-3 py-1.5 text-brand-blue-800">
          {customer.name}
          {customer.price_level_name && (
            <span className="ml-2 text-xs text-brand-blue-600">
              ({customer.price_level_name})
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Walk-in (Retail)
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="text-xs font-medium text-slate-500">Customer (optional)</label>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search customer for contractor pricing…"
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(c);
                  setQuery('');
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 font-mono text-xs text-slate-500">{c.code}</span>
                {c.price_level_name && (
                  <span className="ml-2 text-xs text-brand-blue-600">
                    {c.price_level_name}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
