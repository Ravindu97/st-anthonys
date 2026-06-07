import Link from 'next/link';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { AuditFilters } from '@/components/audit/AuditFilters';
import { buildAuditSearchString } from '@/lib/audit-shared';
import { AuditExportButton } from '@/components/audit/AuditExportButton';
import { AuditKpiStrip } from '@/components/audit/AuditKpiStrip';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { AuditWorkflowGroup } from '@/components/audit/AuditWorkflowGroup';
import {
  getAuditKpis,
  listAuditEvents,
  listAuditUsers,
  listAuditWorkflows,
  type AuditEntityType,
  type AuditPreset,
} from '@/lib/audit';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

const ENTITY_TYPES: AuditEntityType[] = [
  'purchase_order',
  'purchase_suggestion',
  'goods_receipt',
  'reorder_scan',
  'import_run',
  'inventory_adjustment',
  'stock_item',
];

const PRESETS: AuditPreset[] = [
  'last_7_days',
  'po_actions',
  'reorder_only',
  'imports',
  'adjustments',
];

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    entityType?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
    view?: string;
    userId?: string;
    preset?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const view = params.view === 'events' ? 'events' : 'workflows';
  const companyId = await getDefaultCompanyId();

  const entityType =
    params.entityType && ENTITY_TYPES.includes(params.entityType as AuditEntityType)
      ? (params.entityType as AuditEntityType)
      : undefined;

  const preset =
    params.preset && PRESETS.includes(params.preset as AuditPreset)
      ? (params.preset as AuditPreset)
      : undefined;

  const filterOpts = {
    companyId,
    entityType,
    userId: params.userId || undefined,
    action: params.action || undefined,
    q: params.q || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    preset,
    page,
    pageSize: view === 'workflows' ? 25 : 50,
  };

  const [kpis, users, workflowData, eventData] = await Promise.all([
    getAuditKpis(companyId),
    listAuditUsers(),
    view === 'workflows' ? listAuditWorkflows(filterOpts) : Promise.resolve(null),
    view === 'events' ? listAuditEvents(filterOpts) : Promise.resolve(null),
  ]);

  const data = view === 'workflows' ? workflowData! : eventData!;
  const totalPages = Math.max(1, Math.ceil(data.totalCount / data.pageSize));
  const exportSearch = buildAuditSearchString(params);

  function auditUrl(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const merged = { ...params, page: String(page), view, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) next.set(k, v);
    }
    return `/admin/audit?${next.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Admin', href: '/admin/audit' },
          { label: 'Activity log' },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            Activity log
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Workflow stories and full audit trail — admin only
          </p>
        </div>
        <AuditExportButton search={exportSearch} />
      </header>

      <AuditKpiStrip kpis={kpis} />

      <AuditFilters users={users} params={{ ...params, view }} />

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {data.totalCount} {view === 'workflows' ? 'workflow' : 'event'}
          {data.totalCount === 1 ? '' : 's'}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={auditUrl({ page: String(page - 1) })}
              className="text-brand-blue-600 hover:underline"
            >
              ← Previous
            </Link>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={auditUrl({ page: String(page + 1) })}
              className="text-brand-blue-600 hover:underline"
            >
              Next →
            </Link>
          )}
        </div>
      </div>

      {view === 'workflows' && workflowData ? (
        <div className="space-y-3">
          {workflowData.items.map((workflow) => (
            <AuditWorkflowGroup key={workflow.id} workflow={workflow} />
          ))}
          {workflowData.totalCount === 0 && (
            <p className="text-sm text-slate-500">No workflows match your filters.</p>
          )}
        </div>
      ) : eventData ? (
        <AuditTimeline events={eventData.items} />
      ) : null}
    </div>
  );
}
