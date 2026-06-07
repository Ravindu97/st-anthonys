import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { TablePagination } from '@/components/TablePagination';
import { PriceListImportForm } from '@/components/pricing/PriceListImportForm';
import { listPriceLevels, listPriceLists } from '@/lib/pricing';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const companyId = await getDefaultCompanyId();
  const [lists, levels] = await Promise.all([
    listPriceLists(companyId, { page, pageSize: 25 }),
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

      <section className="grid gap-4 sm:grid-cols-3">
        {levels.map((l) => (
          <div
            key={l.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <p className="text-xs text-slate-500">Price level</p>
            <p className="font-medium text-slate-900">{l.name}</p>
          </div>
        ))}
      </section>

      <PriceListImportForm levels={levels.map((l) => l.name)} />

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
              <tr key={pl.id}>
                <td className="px-4 py-2">{pl.price_level_name}</td>
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
          <p className="px-4 py-6 text-sm text-slate-500">No price lists yet. Import a CSV.</p>
        )}
        <TablePagination
          basePath="/pricing"
          page={lists.page}
          pageSize={lists.pageSize}
          totalCount={lists.totalCount}
        />
      </div>
    </div>
  );
}
