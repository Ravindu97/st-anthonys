import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { ReorderRulesPanel } from '@/components/reorder/ReorderRulesPanel';
import { ReorderWorkbench } from '@/components/reorder/ReorderWorkbench';
import { getDefaultCompanyId } from '@/lib/company';
import {
  getReorderWorkbench,
  listCategoryDefaults,
  listReorderRules,
} from '@/lib/reorder';

export const dynamic = 'force-dynamic';

const VALID_TABS = ['action', 'approved', 'needs_rule', 'history', 'rules'] as const;
type Tab = (typeof VALID_TABS)[number];

export default async function ReorderPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; vendor?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const tab = (VALID_TABS.includes(sp.tab as Tab) ? sp.tab : 'action') as Tab;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const q = sp.q?.trim() || undefined;
  const companyId = await getDefaultCompanyId();

  let error: string | null = null;
  let workbench: Awaited<ReturnType<typeof getReorderWorkbench>> | null = null;
  let rulesResult: Awaited<ReturnType<typeof listReorderRules>> | null = null;
  let defaults: Awaited<ReturnType<typeof listCategoryDefaults>> = [];

  try {
    if (tab === 'rules') {
      [rulesResult, defaults, workbench] = await Promise.all([
        listReorderRules({ q, page, pageSize: 50, categoryCode: sp.vendor }),
        listCategoryDefaults(),
        getReorderWorkbench({ companyId, tab: 'action' }),
      ]);
    } else {
      workbench = await getReorderWorkbench({
        companyId,
        tab,
        vendorCode: sp.vendor,
        q,
        page,
        pageSize: 50,
      });
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load reorder hub';
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Inventory hub', href: '/inventory' },
          { label: 'Reorder hub' },
        ]}
      />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
          Reorder hub
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Vendor-grouped replenishment from Tally snapshots — scan, review, approve, create POs
        </p>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {workbench && (
        <ReorderWorkbench
          lines={tab === 'rules' ? [] : workbench.lines}
          summary={workbench.summary}
          tab={tab}
          totalCount={tab === 'rules' ? rulesResult?.totalCount ?? 0 : workbench.totalCount}
          page={tab === 'rules' ? rulesResult?.page ?? 1 : workbench.page}
          pageSize={tab === 'rules' ? rulesResult?.pageSize ?? 50 : workbench.pageSize}
          q={q}
          vendor={sp.vendor}
          rulesPanel={
            tab === 'rules' && rulesResult ? (
              <ReorderRulesPanel
                rules={rulesResult.items}
                defaults={defaults}
                totalCount={rulesResult.totalCount}
                page={rulesResult.page}
                pageSize={rulesResult.pageSize}
                q={q}
                vendor={sp.vendor}
              />
            ) : undefined
          }
        />
      )}
    </div>
  );
}
