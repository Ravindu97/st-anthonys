import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import {
  auditEventsToCsv,
  listAllAuditEventsForGrouping,
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

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'audit:read');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const companyId = await getDefaultCompanyId();
  const entityType = searchParams.get('entityType');
  const preset = searchParams.get('preset');

  const events = await listAllAuditEventsForGrouping({
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
  });

  const csv = auditEventsToCsv(events);
  const filename = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
