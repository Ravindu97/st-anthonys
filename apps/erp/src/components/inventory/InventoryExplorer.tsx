'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { InventoryToolbar } from './InventoryToolbar';
import { InventoryDataTable } from './InventoryDataTable';
import { InventoryGroupedView } from './InventoryGroupedView';
import { PaginationBar } from './PaginationBar';
import { EmptyState } from './EmptyState';
import { LoadingSkeleton } from './LoadingSkeleton';
import type { GroupRollup, InventoryItemRow } from './types';

type Props = {
  vendorSlug: string;
  vendorCode: string;
  vendorName: string;
};

export function InventoryExplorer({
  vendorSlug,
  vendorCode,
  vendorName,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const group = searchParams.get('group') ?? '';
  const status = searchParams.get('status') ?? 'all';
  const sort = searchParams.get('sort') ?? 'value_desc';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10);
  const view = (searchParams.get('view') === 'grouped' ? 'grouped' : 'table') as
    | 'table'
    | 'grouped';
  const dataIssues = searchParams.get('dataIssues') === 'variance' ? 'variance' : undefined;

  const [searchInput, setSearchInput] = useState(q);
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [groups, setGroups] = useState<GroupRollup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const apiQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (group) params.set('group', group);
    if (status && status !== 'all') params.set('status', status);
    if (sort) params.set('sort', sort);
    if (dataIssues) params.set('dataIssues', dataIssues);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return params.toString();
  }, [q, group, status, sort, dataIssues, page, pageSize]);

  const exportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (group) params.set('group', group);
    if (status && status !== 'all') params.set('status', status);
    if (sort) params.set('sort', sort);
    if (dataIssues) params.set('dataIssues', dataIssues);
    return params.toString();
  }, [q, group, status, sort, dataIssues]);

  const filterQueryForGroups = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status && status !== 'all') params.set('status', status);
    if (sort) params.set('sort', sort);
    return params.toString();
  }, [q, status, sort]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      if (!params.has('tab')) params.set('tab', 'stock');
      router.replace(`/inventory/${vendorSlug}?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams, vendorSlug]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== q) {
        updateParams({ q: searchInput || null, page: '1' });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, q, updateParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [itemsRes, groupsRes] = await Promise.all([
          fetch(`/api/inventory/${vendorSlug}/items?${apiQuery}`),
          fetch(`/api/inventory/${vendorSlug}/groups`),
        ]);
        const itemsData = await itemsRes.json();
        const groupsData = await groupsRes.json();
        if (cancelled) return;
        if (!itemsRes.ok) throw new Error(itemsData.error ?? 'Failed to load items');
        setItems(itemsData.items ?? []);
        setTotalCount(itemsData.totalCount ?? 0);
        setGroups(groupsData.groups ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Load failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [vendorSlug, apiQuery]);

  const clearFilters = () => {
    setSearchInput('');
    router.replace(`/inventory/${vendorSlug}?tab=stock`, { scroll: false });
  };

  const statusFilter =
    dataIssues === 'variance'
      ? 'variance'
      : status === 'low_stock' || status === 'out_of_stock'
        ? status
        : 'all';

  return (
    <div className="space-y-4">
      <InventoryToolbar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        group={group}
        onGroupChange={(v) => updateParams({ group: v || null, page: '1' })}
        status={statusFilter}
        onStatusChange={(v) =>
          updateParams({
            status: v === 'all' || v === 'variance' ? null : v,
            dataIssues: v === 'variance' ? 'variance' : null,
            page: '1',
          })
        }
        sort={sort}
        onSortChange={(v) => updateParams({ sort: v, page: '1' })}
        pageSize={pageSize}
        onPageSizeChange={(n) => updateParams({ pageSize: String(n), page: '1' })}
        view={view}
        onViewChange={(v) => updateParams({ view: v === 'table' ? null : v })}
        groups={groups}
        totalCount={totalCount}
        vendorSlug={vendorSlug}
        exportParams={exportParams}
        onClearFilters={clearFilters}
      />

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading && <LoadingSkeleton />}

      {!loading && !error && totalCount === 0 && (
        <EmptyState
          title="No products found"
          description={`No inventory lines match your search in ${vendorName}. Try clearing filters or another stock group.`}
          onClear={clearFilters}
        />
      )}

      {!loading && !error && totalCount > 0 && view === 'table' && (
        <>
          <InventoryDataTable
            rows={items}
            sort={sort}
            onSortChange={(v) => updateParams({ sort: v, page: '1' })}
          />
          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={(p) => updateParams({ page: String(p) })}
          />
        </>
      )}

      {!loading && !error && view === 'grouped' && (
        <InventoryGroupedView
          vendorSlug={vendorSlug}
          groups={groups}
          filterQuery={filterQueryForGroups}
          status={status}
          sort={sort}
        />
      )}
    </div>
  );
}
