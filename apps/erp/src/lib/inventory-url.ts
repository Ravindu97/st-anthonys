import type { StockStatus } from './inventory-search';

export function vendorInventoryUrl(
  slug: string,
  params?: {
    status?: StockStatus;
    group?: string;
    sort?: string;
    q?: string;
    dataIssues?: 'variance';
    tab?: 'stock' | 'insights';
  }
) {
  const base = `/inventory/${slug.toLowerCase()}`;
  if (!params) return base;
  const sp = new URLSearchParams();
  if (params.tab) sp.set('tab', params.tab);
  if (params.status && params.status !== 'all') sp.set('status', params.status);
  if (params.group) sp.set('group', params.group);
  if (params.sort) sp.set('sort', params.sort);
  if (params.q) sp.set('q', params.q);
  if (params.dataIssues === 'variance') sp.set('dataIssues', 'variance');
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export function alertsUrl(tab?: 'low' | 'out' | 'variance' | 'new_outs' | 'all') {
  const sp = new URLSearchParams();
  if (tab) sp.set('tab', tab);
  const qs = sp.toString();
  return qs ? `/inventory/alerts?${qs}` : '/inventory/alerts';
}

/** Prefer stockItemId when linking from alert rows (stable); SKU-only URLs may match first duplicate. */
export function unitDetailUrl(
  vendorSlug: string,
  opts: { sku?: string | null; stockItemId?: string }
) {
  const slug = vendorSlug.toLowerCase();
  const key = opts.stockItemId ?? opts.sku;
  if (!key) return `/inventory/${slug}`;
  return `/inventory/${slug}/unit/${encodeURIComponent(key)}`;
}
