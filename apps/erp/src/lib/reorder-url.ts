export type ReorderUrlParams = {
  tab?: string;
  q?: string;
  page?: number;
  vendor?: string;
};

export function reorderHubUrl(params: ReorderUrlParams = {}) {
  const sp = new URLSearchParams();
  if (params.tab) sp.set('tab', params.tab);
  if (params.q?.trim()) sp.set('q', params.q.trim());
  if (params.vendor) sp.set('vendor', params.vendor);
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  const qs = sp.toString();
  return qs ? `/inventory/reorder?${qs}` : '/inventory/reorder';
}
