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

export function alertsUrl(tab?: 'low' | 'out' | 'variance' | 'new_outs') {
  const sp = new URLSearchParams();
  if (tab) sp.set('tab', tab);
  const qs = sp.toString();
  return qs ? `/inventory/alerts?${qs}` : '/inventory/alerts';
}

export type VendorAlertItemRow = {
  primary_sku: string | null;
  item_name: string;
  alert_status: 'low_stock' | 'out_of_stock' | 'variance';
};

export function vendorAlertItemUrl(slug: string, row: VendorAlertItemRow) {
  const q = row.primary_sku?.trim() || row.item_name.trim();
  return vendorInventoryUrl(slug, {
    tab: 'stock',
    q: q || undefined,
    sort: 'value_desc',
    status:
      row.alert_status === 'low_stock'
        ? 'low_stock'
        : row.alert_status === 'out_of_stock'
          ? 'out_of_stock'
          : undefined,
    dataIssues: row.alert_status === 'variance' ? 'variance' : undefined,
  });
}
