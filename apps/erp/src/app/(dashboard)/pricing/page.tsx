import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { PriceListImportForm } from '@/components/pricing/PriceListImportForm';
import {
  PricingLevelCards,
  PricingSearchToolbar,
} from '@/components/pricing/PricingSearchToolbar';
import { TablePagination } from '@/components/TablePagination';
import { hasPermission } from '@/lib/auth/permissions';
import { getSessionFromCookies } from '@/lib/auth/session';
import { listPriceLevels, listPriceLists } from '@/lib/pricing';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; level?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session || !hasPermission(session.role, 'pricing:read')) {
    redirect('/');
  }

  const canWrite = hasPermission(session.role, 'pricing:write');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const companyId = await getDefaultCompanyId();
  const [lists, levels] = await Promise.all([
    listPriceLists(companyId, {
      page,
      pageSize: 25,
      levelName: params.level,
    }),
    listPriceLevels(companyId),
  ]);

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: 'Pricing' }]} />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
          Price lists
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tiered pricing by customer level — import from Tally CSV exports
        </p>
      </header>

      <PricingLevelCards levels={levels} activeLevel={params.level ?? ''} />

      <Suspense fallback={null}>
        <PricingSearchToolbar levels={levels} canWrite={canWrite} />
      </Suspense>

      {canWrite && <PriceListImportForm levels={levels.map((l) => l.name)} />}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3 text-right">Items</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lists.items.map((pl) => (
              <tr key={pl.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/pricing/${pl.id}`}
                    className="text-brand-blue-600 hover:underline"
                  >
                    {pl.price_level_name}
                  </Link>
                  {pl.is_current && (
                    <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                      Current
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {pl.category_name ?? pl.group_name ?? pl.scope_type}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{pl.applicable_from}</td>
                <td className="px-4 py-2 text-right">{pl.item_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lists.items.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-500">
              {params.level
                ? `No price lists for ${params.level}.`
                : 'No price lists yet.'}
            </p>
            {canWrite && !params.level && (
              <p className="mt-2 text-xs text-slate-500">
                Use the import form above to load your first Tally price list CSV.
              </p>
            )}
          </div>
        )}
        <TablePagination
          basePath="/pricing"
          page={lists.page}
          pageSize={lists.pageSize}
          totalCount={lists.totalCount}
          searchParams={{ level: params.level }}
        />
      </div>
    </div>
  );
}
