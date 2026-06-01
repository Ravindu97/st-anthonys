import type { InventorySearchParams, StockStatus } from './inventory-search';

export function parseInventorySearchParams(
  searchParams: URLSearchParams
): InventorySearchParams {
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10);
  const status = searchParams.get('status') as StockStatus | null;

  return {
    q: searchParams.get('q') ?? undefined,
    group: searchParams.get('group') ?? undefined,
    status:
      status && ['all', 'in_stock', 'low_stock', 'out_of_stock'].includes(status)
        ? status
        : 'all',
    sort: searchParams.get('sort') ?? 'value_desc',
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
  };
}

export async function resolveVendorFromSlug(slug: string) {
  const { resolveVendorCode } = await import('./inventory-search');
  return resolveVendorCode(slug);
}
