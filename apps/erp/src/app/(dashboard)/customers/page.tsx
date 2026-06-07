import Link from 'next/link';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { TablePagination } from '@/components/TablePagination';
import { listCustomers } from '@/lib/customers';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const result = await listCustomers({
    page,
    pageSize: 25,
    q: params.q,
  });

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: 'Customers' }]} />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
          Customers & contractors
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          B2B accounts with tier pricing and credit terms
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Price level</th>
              <th className="px-4 py-3 text-right">Credit limit</th>
              <th className="px-4 py-3 text-right">Terms (days)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.items.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-2">
                  <Link href={`/customers/${c.id}`} className="text-brand-blue-600 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2 capitalize text-slate-600">{c.customer_type}</td>
                <td className="px-4 py-2">{c.price_level_name ?? '—'}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {c.credit_limit ? Number(c.credit_limit).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2 text-right">{c.payment_terms_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">
            No customers yet. Create via API POST /api/customers
          </p>
        )}
        <TablePagination
          basePath="/customers"
          page={result.page}
          pageSize={result.pageSize}
          totalCount={result.totalCount}
          searchParams={{ q: params.q }}
        />
      </div>
    </div>
  );
}
