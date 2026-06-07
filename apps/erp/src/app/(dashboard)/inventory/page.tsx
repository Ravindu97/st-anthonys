import Link from 'next/link';
import { getSessionFromCookies, isAdminRole } from '@/lib/auth';
import { getInventoryHubSummary } from '@/lib/inventory-search';
import { MetricCardCount, MetricCardMoney } from '@/components/MetricCard';
import { MetricCardCountLink, MetricCardMoneyLink } from '@/components/inventory/MetricCardLink';
import { VendorHubClient } from '@/components/inventory/VendorHubClient';
import { alertsUrl } from '@/lib/inventory-url';
import { listImportRuns } from '@/lib/import-runs';
import { getReorderCountsByVendor } from '@/lib/reorder';

export const dynamic = 'force-dynamic';

function latestImportDate(vendors: { imported_at: string | Date }[]) {
  if (vendors.length === 0) return null;
  const latest = vendors.reduce(
    (max, v) => Math.max(max, new Date(v.imported_at).getTime()),
    0
  );
  return new Date(latest).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function staleDays(imported_at: Date | string) {
  return Math.floor(
    (Date.now() - new Date(imported_at).getTime()) / (1000 * 60 * 60 * 24)
  );
}

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function InventoryHubPage({ searchParams }: PageProps) {
  const session = await getSessionFromCookies();
  const isAdmin = session ? isAdminRole(session.role) : false;
  const params = await searchParams;
  const forbidden = params.error === 'forbidden';

  let summary: Awaited<ReturnType<typeof getInventoryHubSummary>> | null = null;
  let reorderByVendor: Awaited<ReturnType<typeof getReorderCountsByVendor>> = [];
  let recentImport: Awaited<ReturnType<typeof listImportRuns>>[number] | null = null;
  let error: string | null = null;

  try {
    const [hub, runs, reorderCounts] = await Promise.all([
      getInventoryHubSummary(),
      listImportRuns(1),
      getReorderCountsByVendor(),
    ]);
    summary = hub;
    recentImport = runs[0] ?? null;
    reorderByVendor = reorderCounts;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load inventory';
  }

  const reorderMap = Object.fromEntries(
    reorderByVendor.map((r) => [r.category_code, r.below_min_count])
  );
  const vendors = (summary?.vendors ?? []).map((v) => ({
    ...v,
    reorder_below_min: reorderMap[v.code] ?? 0,
  }));
  const lastImport = summary ? latestImportDate(vendors) : null;

  return (
    <div className="space-y-5">
      {forbidden && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Import is restricted to admin users.
        </p>
      )}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            Inventory hub
          </h1>
          {summary && (
            <p className="mt-1 font-mono text-sm text-slate-500">
              {summary.vendor_count} vendors ·{' '}
              {Number(summary.sku_count).toLocaleString()} SKUs
              {lastImport ? ` · Updated ${lastImport}` : ''}
            </p>
          )}
          {recentImport && (
            <p className="mt-1 text-xs text-slate-500">
              Last import: {recentImport.file_name ?? 'CSV'} ·{' '}
              {new Date(recentImport.imported_at).toLocaleString('en-GB')}
              {recentImport.row_counts &&
              (recentImport.row_counts as { validation_ok?: boolean }).validation_ok ===
                false
                ? ' · footer check failed'
                : ''}
            </p>
          )}
        </div>
        {isAdmin && (
          <Link
            href="/import"
            className="rounded-lg border border-brand-blue-200 bg-brand-blue-50 px-3 py-2 text-sm font-medium text-brand-blue-700 hover:bg-brand-blue-100"
          >
            Import CSV
          </Link>
        )}
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {summary && (
        <>
          <div className="grid items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
            <MetricCardMoney
              label="Total stock value"
              amount={summary.total_value}
              className="col-span-2 h-full lg:col-span-1"
            />
            <MetricCardMoneyLink
              href={alertsUrl()}
              label="At-risk value"
              amount={summary.at_risk_value}
              sub={`${summary.at_risk_pct}% of portfolio`}
              className="col-span-2 h-full lg:col-span-1"
            />
            <MetricCardCount
              label="Vendors"
              count={summary.vendor_count}
              className="h-full"
            />
            <MetricCardCountLink
              href={alertsUrl('low')}
              label="Low stock"
              count={summary.low_stock}
              accent="gold"
              sub="Under 10 units"
              className="h-full"
            />
            <MetricCardCountLink
              href={alertsUrl('out')}
              label="Out of stock"
              count={summary.out_of_stock}
              accent="gold"
              className="h-full"
            />
          </div>

          {vendors.length > 0 && (
            <VendorHubClient vendors={vendors} totalValue={summary.total_value} />
          )}

          {vendors.some((v) => staleDays(v.imported_at) > 7) && (
            <p className="text-xs text-slate-500">
              Some vendors were last imported over 7 days ago. Re-run Tally Location
              Summary imports to refresh figures.
            </p>
          )}
        </>
      )}

      {vendors.length === 0 && !error && (
        <p className="text-sm text-slate-500">
          No inventory imported yet. Run a Location Summary import, then refresh.
        </p>
      )}
    </div>
  );
}
