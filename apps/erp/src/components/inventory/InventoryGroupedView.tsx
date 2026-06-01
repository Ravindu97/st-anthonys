'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { formatLkr } from '@/lib/format';
import { vendorInventoryUrl } from '@/lib/inventory-url';
import { InventoryDataTable } from './InventoryDataTable';
import { LoadingSkeleton } from './LoadingSkeleton';
import type { GroupRollup, InventoryItemRow } from './types';

type Props = {
  vendorSlug: string;
  groups: GroupRollup[];
  filterQuery: string;
  status: string;
  sort: string;
};

export function InventoryGroupedView({
  vendorSlug,
  groups,
  filterQuery,
  status,
  sort,
}: Props) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [itemsByGroup, setItemsByGroup] = useState<
    Record<string, InventoryItemRow[]>
  >({});
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);

  const fetchGroupItems = useCallback(
    async (groupName: string) => {
      if (itemsByGroup[groupName]) return;
      setLoadingGroup(groupName);
      const params = new URLSearchParams(filterQuery);
      params.set('group', groupName);
      params.set('sort', sort);
      params.set('pageSize', '200');
      params.set('page', '1');
      try {
        const res = await fetch(
          `/api/inventory/${vendorSlug}/items?${params.toString()}`
        );
        const data = await res.json();
        if (res.ok) {
          setItemsByGroup((prev) => ({
            ...prev,
            [groupName]: data.items ?? [],
          }));
        }
      } finally {
        setLoadingGroup(null);
      }
    },
    [vendorSlug, filterQuery, sort]
  );

  const toggle = (groupName: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
        void fetchGroupItems(groupName);
      }
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <p className="text-sm text-slate-500">No stock groups match your filters.</p>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const isOpen = openGroups.has(g.group_name);
        const items = itemsByGroup[g.group_name];
        const childValue = items
          ? items.reduce((s, r) => s + Number(r.value ?? 0), 0)
          : null;
        const rollupValue = Number(g.total_value);
        const showVariance =
          childValue != null && Math.abs(childValue - rollupValue) > 1;

        return (
          <div
            key={g.group_name}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => toggle(g.group_name)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
              aria-expanded={isOpen}
            >
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-slate-900">
                  {g.group_name}
                </p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">
                  {Number(g.item_count)} SKUs ·{' '}
                  {Number(g.total_quantity).toLocaleString()} units
                </p>
                <Link
                  href={vendorInventoryUrl(vendorSlug, {
                    group: g.group_name,
                    sort: 'value_desc',
                    tab: 'stock',
                  })}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 inline-block text-xs font-medium text-brand-blue-600 hover:underline"
                >
                  View all in table →
                </Link>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold text-slate-900">
                  {formatLkr(g.total_value)}
                </p>
                {showVariance && isOpen && (
                  <p className="text-[10px] text-slate-400">Tally group rollup</p>
                )}
              </div>
              <span
                className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden
              >
                ▼
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100 bg-slate-50/30 p-2">
                {loadingGroup === g.group_name && !items && <LoadingSkeleton />}
                {items && items.length > 0 && (
                  <InventoryDataTable rows={items} vendorSlug={vendorSlug} />
                )}
                {items && items.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">
                    No items in this group for current filters.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
