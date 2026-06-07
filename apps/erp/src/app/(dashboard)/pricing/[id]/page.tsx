import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { PriceListItemsSection } from '@/components/pricing/PriceListItemsSection';
import { hasPermission } from '@/lib/auth/permissions';
import { getSessionFromCookies } from '@/lib/auth/session';
import { getPriceList, listPriceListItems } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function PriceListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session || !hasPermission(session.role, 'pricing:read')) {
    redirect('/');
  }

  const canWrite = hasPermission(session.role, 'pricing:write');
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));

  const priceList = await getPriceList(id);
  if (!priceList) notFound();

  const itemsResult = await listPriceListItems(id, {
    q: sp.q,
    page,
    pageSize: 50,
  });

  const scopeLabel =
    priceList.category_name ?? priceList.group_name ?? priceList.scope_type;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Pricing', href: '/pricing' },
          { label: `${priceList.price_level_name} — ${scopeLabel}` },
        ]}
      />

      <header className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-semibold text-slate-900">
            {priceList.price_level_name}
          </h1>
          {priceList.is_current && (
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Current
            </span>
          )}
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Scope</dt>
            <dd className="font-medium">{scopeLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Effective from</dt>
            <dd className="font-mono">{priceList.applicable_from}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Items</dt>
            <dd className="font-mono">{priceList.item_count}</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Link href="/pricing" className="text-sm text-brand-blue-600 hover:underline">
            Back to all price lists
          </Link>
          <a
            href={`/api/pricing/lists/${id}/export`}
            className="text-sm text-brand-blue-600 hover:underline"
          >
            Export CSV
          </a>
        </div>
      </header>

      <Suspense fallback={null}>
        <PriceListItemsSection
          priceListId={id}
          categoryId={priceList.scope_category_id}
          canWrite={canWrite}
          items={itemsResult.items}
          totalCount={itemsResult.totalCount}
          page={itemsResult.page}
          pageSize={itemsResult.pageSize}
        />
      </Suspense>
    </div>
  );
}
