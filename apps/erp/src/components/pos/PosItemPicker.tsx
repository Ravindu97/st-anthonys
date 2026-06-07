'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatLkr } from '@/lib/format';

export type PosLookupItem = {
  stock_item_id: string;
  item_name: string;
  sku: string;
  vendor_code: string;
  vendor_slug: string;
  on_hand: number;
  unit_rate: number;
  price_source: string;
};

type BrowseVendor = {
  code: string;
  name: string;
  slug: string;
};

type PosItemPickerProps = {
  disabled?: boolean;
  locationId: string;
  priceLevelId: string | null;
  customerId?: string;
  onAdd: (item: PosLookupItem) => void;
};

function lookupParams(
  locationId: string,
  priceLevelId: string | null,
  customerId?: string
) {
  const params = new URLSearchParams({ locationId });
  if (priceLevelId) params.set('priceLevelId', priceLevelId);
  if (customerId) params.set('customerId', customerId);
  return params;
}

function ItemRow({
  item,
  selected,
  onSelect,
  onAdd,
}: {
  item: PosLookupItem;
  selected: boolean;
  onSelect: () => void;
  onAdd: () => void;
}) {
  return (
    <li>
      <div
        className={`flex items-stretch gap-1 rounded-lg ${
          selected ? 'bg-brand-blue-50 ring-1 ring-brand-blue-200' : ''
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={onAdd}
          className="min-w-0 flex-1 px-3 py-2 text-left text-sm hover:bg-slate-50 rounded-lg"
        >
          <span className="font-mono text-xs text-slate-500">{item.sku}</span>{' '}
          <span className="text-slate-800">{item.item_name}</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Stock {item.on_hand} · {formatLkr(item.unit_rate)}
            {item.price_source === 'price_list' && (
              <span className="ml-1 text-brand-blue-600">price list</span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 self-center rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white mr-1"
        >
          Add
        </button>
      </div>
    </li>
  );
}

export function PosItemPicker({
  disabled,
  locationId,
  priceLevelId,
  customerId,
  onAdd,
}: PosItemPickerProps) {
  const [mode, setMode] = useState<'search' | 'browse'>('search');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PosLookupItem[]>([]);
  const [searchIndex, setSearchIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  const [vendors, setVendors] = useState<BrowseVendor[]>([]);
  const [vendorCode, setVendorCode] = useState('');
  const [browseQuery, setBrowseQuery] = useState('');
  const [browseResults, setBrowseResults] = useState<PosLookupItem[]>([]);
  const [browseIndex, setBrowseIndex] = useState(-1);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);

  const pageSize = 25;
  const browsePages = Math.max(1, Math.ceil(browseTotal / pageSize));

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        setSearchIndex(-1);
        return;
      }
      const params = lookupParams(locationId, priceLevelId, customerId);
      params.set('q', q);
      const res = await fetch(`/api/pos/lookup?${params}`);
      const data = await res.json();
      const items = (data.items ?? []) as PosLookupItem[];
      setSearchResults(items);
      setSearchIndex(items.length > 0 ? 0 : -1);
    },
    [locationId, priceLevelId, customerId]
  );

  useEffect(() => {
    if (mode !== 'search' || disabled) return;
    const t = setTimeout(() => {
      if (query.trim().length >= 2) {
        runSearch(query);
      } else {
        setSearchResults([]);
        setSearchIndex(-1);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, mode, disabled, runSearch]);

  const loadBrowse = useCallback(
    async (page: number, vendor: string, q: string) => {
      setBrowseLoading(true);
      try {
        const params = lookupParams(locationId, priceLevelId, customerId);
        if (vendor) params.set('vendorCode', vendor);
        if (q.trim()) params.set('q', q);
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
        const res = await fetch(`/api/pos/browse?${params}`);
        const data = await res.json();
        const items = (data.items ?? []) as PosLookupItem[];
        setBrowseResults(items);
        setBrowseTotal(Number(data.total ?? 0));
        setBrowseIndex(items.length > 0 ? 0 : -1);
        if (data.vendorCode && !vendor) setVendorCode(data.vendorCode);
      } finally {
        setBrowseLoading(false);
      }
    },
    [locationId, priceLevelId, customerId]
  );

  useEffect(() => {
    if (mode !== 'browse' || disabled) return;
    const params = lookupParams(locationId, priceLevelId, customerId);
    params.set('vendors', '1');
    fetch(`/api/pos/browse?${params}`)
      .then((r) => r.json())
      .then((d) => setVendors(d.vendors ?? []))
      .catch(() => setVendors([]));
  }, [mode, disabled, locationId, priceLevelId, customerId]);

  useEffect(() => {
    if (mode !== 'browse' || disabled) return;
    const t = setTimeout(() => {
      loadBrowse(browsePage, vendorCode, browseQuery);
    }, 200);
    return () => clearTimeout(t);
  }, [mode, disabled, browsePage, vendorCode, browseQuery, loadBrowse]);

  useEffect(() => {
    setBrowsePage(1);
  }, [vendorCode, browseQuery]);

  function addSelected(items: PosLookupItem[], index: number) {
    const item = items[index];
    if (!item) return;
    onAdd(item);
    setQuery('');
    setSearchResults([]);
    setSearchIndex(-1);
    searchRef.current?.focus();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchIndex((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchIndex >= 0) {
        addSelected(searchResults, searchIndex);
      } else if (searchResults.length === 1) {
        addSelected(searchResults, 0);
      } else {
        runSearch(query);
      }
    } else if (e.key === 'Escape') {
      setSearchResults([]);
      setSearchIndex(-1);
    }
  }

  function handleBrowseKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setBrowseIndex((i) => Math.min(i + 1, browseResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setBrowseIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && browseIndex >= 0) {
      e.preventDefault();
      onAdd(browseResults[browseIndex]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('search')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
            mode === 'search'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Search
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('browse')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
            mode === 'browse'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Browse &amp; select
        </button>
      </div>

      {mode === 'search' ? (
        <>
          <div className="flex gap-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="SKU or item name… (↑↓ select, Enter add)"
              disabled={disabled}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={() => runSearch(query)}
              disabled={disabled || !query.trim()}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              Search
            </button>
          </div>
          {searchResults.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1">
              {searchResults.map((r, i) => (
                <ItemRow
                  key={r.stock_item_id}
                  item={r}
                  selected={i === searchIndex}
                  onSelect={() => setSearchIndex(i)}
                  onAdd={() => addSelected(searchResults, i)}
                />
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && searchResults.length === 0 && (
            <p className="text-xs text-slate-500">No matching items.</p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <select
              value={vendorCode}
              onChange={(e) => setVendorCode(e.target.value)}
              disabled={disabled}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="">Register location</option>
              {vendors.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.name} ({v.code})
                </option>
              ))}
            </select>
            <input
              value={browseQuery}
              onChange={(e) => setBrowseQuery(e.target.value)}
              onKeyDown={handleBrowseKeyDown}
              placeholder="Filter browse list…"
              disabled={disabled}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>

          {browseLoading ? (
            <p className="text-xs text-slate-500">Loading items…</p>
          ) : browseResults.length === 0 ? (
            <p className="text-xs text-slate-500">No items at this location.</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1">
              {browseResults.map((r, i) => (
                <ItemRow
                  key={r.stock_item_id}
                  item={r}
                  selected={i === browseIndex}
                  onSelect={() => setBrowseIndex(i)}
                  onAdd={() => onAdd(r)}
                />
              ))}
            </ul>
          )}

          {browseTotal > pageSize && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {browsePage} of {browsePages} ({browseTotal} items)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={disabled || browsePage <= 1}
                  onClick={() => setBrowsePage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={disabled || browsePage >= browsePages}
                  onClick={() => setBrowsePage((p) => p + 1)}
                  className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!disabled && (
        <p className="text-[11px] text-slate-400">
          Click a row to select · Add button or Enter to add · Double-click to add quickly
        </p>
      )}
    </div>
  );
}
