import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { TablePagination } from '@/components/TablePagination';
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
  'pos_transaction',
  'pos_session',
  'customer',
  'sales_document',
  'price_list',
  'reorder_rule',
];

const PRESETS: AuditPreset[] = [
  'last_7_days',
  'po_actions',
  'reorder_only',
  'imports',
  'adjustments',
  'sales',
  'customers',
  'pricing',
  'pos_sales',
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
  const exportSearch = buildAuditSearchString(params);
  const paginationParams = {
    q: params.q,
    entityType: params.entityType,
    action: params.action,
    from: params.from,
    to: params.to,
    view,
    userId: params.userId,
    preset: params.preset,
  };

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

      <div className="rounded-xl border border-slate-200 bg-white">
        <TablePagination
          basePath="/admin/audit"
          page={data.page}
          pageSize={data.pageSize}
          totalCount={data.totalCount}
          searchParams={paginationParams}
        />
      </div>
    </div>
  );
}
