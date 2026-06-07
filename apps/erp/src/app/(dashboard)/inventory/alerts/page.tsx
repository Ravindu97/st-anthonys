import Link from 'next/link';
import { searchCrossVendorAlerts } from '@/lib/inventory-search';
import { AlertsTable } from '@/components/inventory/AlertsTable';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { TablePagination } from '@/components/TablePagination';

export const dynamic = 'force-dynamic';

const TABS = [
  { id: 'all' as const, label: 'All alerts' },
  { id: 'out' as const, label: 'Out of stock' },
  { id: 'low' as const, label: 'Low stock' },
  { id: 'variance' as const, label: 'Value mismatches' },
  { id: 'new_outs' as const, label: 'New outs since import' },
];

export default async function InventoryAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const tabParam = sp.tab ?? 'all';
  const tab = TABS.some((t) => t.id === tabParam)
    ? (tabParam as (typeof TABS)[number]['id'])
    : 'all';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  let result: Awaited<ReturnType<typeof searchCrossVendorAlerts>> | null = null;
  let error: string | null = null;

  try {
    result = await searchCrossVendorAlerts({ tab, page, pageSize: 50 });
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load alerts';
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Inventory hub', href: '/inventory' },
          { label: 'Alert center' },
        ]}
      />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
          Alert center
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Cross-vendor lines that need attention, sorted by stock value
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/inventory/alerts?tab=${t.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? 'bg-brand-blue-500 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {result && result.totalCount === 0 && (
        <p className="text-sm text-slate-500">No lines match this alert type.</p>
      )}

      {result && result.items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              {result.totalCount.toLocaleString()} lines
              {tab === 'new_outs' && ' newly out since previous import'}
            </p>
            <a
              href={`/api/inventory/alerts/export?tab=${tab}`}
              className="rounded-lg border border-brand-blue-200 bg-brand-blue-50 px-3 py-2 text-sm font-medium text-brand-blue-700 hover:bg-brand-blue-100"
              download
            >
              Export CSV
            </a>
          </div>
          <AlertsTable items={result.items} />
          <TablePagination
            basePath="/inventory/alerts"
            page={page}
            pageSize={result.pageSize}
            totalCount={result.totalCount}
            searchParams={{ tab }}
          />
        </>
      )}
    </div>
  );
}
