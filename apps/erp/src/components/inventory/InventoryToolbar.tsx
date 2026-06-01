'use client';

import type { GroupRollup } from './types';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
] as const;

const SORT_GROUPS = [
  {
    label: 'Unit code (212-4017, 133-1072, …)',
    options: [
      { value: 'sku_asc', label: 'Unit code: low to high' },
      { value: 'sku_desc', label: 'Unit code: high to low' },
    ],
  },
  {
    label: 'Stock value',
    options: [
      { value: 'value_desc', label: 'Value: high to low' },
      { value: 'value_asc', label: 'Value: low to high' },
    ],
  },
  {
    label: 'Quantity on hand',
    options: [
      { value: 'qty_desc', label: 'Quantity: high to low' },
      { value: 'qty_asc', label: 'Quantity: low to high' },
    ],
  },
  {
    label: 'Other',
    options: [
      { value: 'name_asc', label: 'Product name: A to Z' },
      { value: 'group_asc', label: 'Stock group: A to Z' },
    ],
  },
] as const;

export const SORT_OPTION_VALUES = SORT_GROUPS.flatMap((g) =>
  g.options.map((o) => o.value)
);

type Props = {
  searchInput: string;
  onSearchChange: (v: string) => void;
  group: string;
  onGroupChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  sort: string;
  onSortChange: (v: string) => void;
  pageSize: number;
  onPageSizeChange: (v: number) => void;
  view: 'table' | 'grouped';
  onViewChange: (v: 'table' | 'grouped') => void;
  groups: GroupRollup[];
  totalCount: number;
  vendorSlug: string;
  exportParams: string;
  onClearFilters: () => void;
};

export function InventoryToolbar({
  searchInput,
  onSearchChange,
  group,
  onGroupChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  pageSize,
  onPageSizeChange,
  view,
  onViewChange,
  groups,
  totalCount,
  vendorSlug,
  exportParams,
  onClearFilters,
}: Props) {
  const exportHref = `/api/inventory/${vendorSlug}/export?${exportParams}`;
  const sortValue = (SORT_OPTION_VALUES as readonly string[]).includes(sort)
    ? sort
    : 'value_desc';

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <label htmlFor="inventory-search" className="sr-only">
            Search inventory
          </label>
          <input
            id="inventory-search"
            type="search"
            placeholder="Search SKU, product name, or stock group…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-blue-500 focus:ring-2 focus:ring-brand-blue-100 focus:outline-none"
          />
          <svg
            className="pointer-events-none absolute top-3 left-3 h-5 w-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => onViewChange('table')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                view === 'table'
                  ? 'bg-brand-blue-500 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => onViewChange('grouped')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                view === 'grouped'
                  ? 'bg-brand-blue-500 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              By group
            </button>
          </div>
          <a
            href={totalCount > 0 ? exportHref : undefined}
            aria-disabled={totalCount === 0}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              totalCount > 0
                ? 'border-brand-blue-200 bg-brand-blue-50 text-brand-blue-700 hover:bg-brand-blue-100'
                : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
            }`}
            download
          >
            Export CSV
            {totalCount > 0 && (
              <span className="font-mono text-xs">({totalCount.toLocaleString()})</span>
            )}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end lg:gap-3">
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:min-w-[12rem]">
          <label
            htmlFor="inventory-sort"
            className="text-xs font-semibold tracking-wide text-slate-500 uppercase"
          >
            Sort by
          </label>
          <select
            id="inventory-sort"
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-brand-blue-500 focus:ring-2 focus:ring-brand-blue-100 focus:outline-none"
          >
            {SORT_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <select
          value={group}
          onChange={(e) => onGroupChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-blue-500 focus:outline-none lg:max-w-xs"
          aria-label="Stock group"
        >
          <option value="">All stock groups</option>
          {groups.map((g) => (
            <option key={g.group_name} value={g.group_name}>
              {g.group_name} ({g.item_count})
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-blue-500 focus:outline-none lg:w-auto"
          aria-label="Stock status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-blue-500 focus:outline-none lg:w-auto"
          aria-label="Rows per page"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onClearFilters}
          className="text-sm font-medium text-brand-blue-600 hover:text-brand-blue-700 lg:pb-2"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
