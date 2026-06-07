import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import {
  listAuditEvents,
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

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'audit:read');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const companyId = await getDefaultCompanyId();
  const view = searchParams.get('view') ?? 'workflows';
  const entityType = searchParams.get('entityType');
  const preset = searchParams.get('preset');

  const baseOpts = {
    companyId,
    entityType:
      entityType && ENTITY_TYPES.includes(entityType as AuditEntityType)
        ? (entityType as AuditEntityType)
        : undefined,
    userId: searchParams.get('userId') ?? undefined,
    action: searchParams.get('action') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    preset:
      preset && PRESETS.includes(preset as AuditPreset)
        ? (preset as AuditPreset)
        : undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') ?? '25', 10),
  };

  if (view === 'workflows') {
    const result = await listAuditWorkflows(baseOpts);
    return NextResponse.json({ view: 'workflows', ...result });
  }

  const result = await listAuditEvents(baseOpts);
  return NextResponse.json({ view: 'events', ...result });
}
