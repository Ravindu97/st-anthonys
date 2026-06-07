/** Client-safe audit types and helpers (no database imports). */

export type AuditEntityType =
  | 'purchase_order'
  | 'purchase_suggestion'
  | 'goods_receipt'
  | 'reorder_scan'
  | 'import_run'
  | 'inventory_adjustment'
  | 'stock_item'
  | 'pos_transaction';

export type AuditSource = 'web' | 'api' | 'system';

export type AuditChange = {
  field: string;
  old: unknown;
  new: unknown;
};

export type AuditEvent = {
  id: string;
  company_id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  correlation_id: string | null;
  source: AuditSource;
  changes: AuditChange[];
  record_label: string | null;
  created_at: Date;
};

export type AuditWorkflow = {
  id: string;
  title: string;
  subtitle: string;
  actor_email: string | null;
  started_at: Date;
  event_count: number;
  primary_href: string | null;
  events: AuditEvent[];
};

export type AuditPreset =
  | 'last_7_days'
  | 'po_actions'
  | 'reorder_only'
  | 'imports'
  | 'adjustments';

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'po.created': 'PO created',
  'po.bulk_created': 'Bulk PO run',
  'po.status_changed': 'PO status changed',
  'grn.created': 'Goods received',
  'suggestion.approved': 'Suggestion approved',
  'suggestion.dismissed': 'Suggestion dismissed',
  'suggestion.reverted': 'Reverted to queue',
  'suggestion.qty_changed': 'Qty adjusted',
  'suggestion.bulk_approved': 'Bulk approved',
  'suggestion.bulk_dismissed': 'Bulk dismissed',
  'suggestion.converted': 'Converted to PO',
  'suggestion.auto_created': 'Auto-created by scan',
  'suggestion.auto_updated': 'Updated by scan',
  'suggestion.auto_cancelled': 'Auto-cancelled by scan',
  'reorder.scan_completed': 'Reorder scan completed',
  'import.completed': 'Import completed',
  'import.dry_run': 'Import preview',
  'adjustment.created': 'Balance adjusted',
  'pos.sale_completed': 'POS sale completed',
};

export const AUDIT_PRESETS: { id: AuditPreset; label: string }[] = [
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'po_actions', label: 'PO actions' },
  { id: 'reorder_only', label: 'Reorder only' },
  { id: 'imports', label: 'Imports' },
  { id: 'adjustments', label: 'Adjustments' },
];

function extractPoNumber(event: AuditEvent): string | null {
  if (event.record_label?.startsWith('PO-')) return event.record_label;
  const meta = event.metadata;
  if (typeof meta.poNumber === 'string') return meta.poNumber;
  const match = event.summary.match(/PO-\d+/);
  return match?.[0] ?? null;
}

function workflowTitle(events: AuditEvent[]): { title: string; subtitle: string } {
  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const primary =
    sorted.find((e) => e.action === 'po.created') ??
    sorted.find((e) => e.action === 'po.bulk_created') ??
    sorted.find((e) => e.action === 'import.completed') ??
    sorted.find((e) => e.action === 'grn.created') ??
    sorted.find((e) => e.action === 'adjustment.created') ??
    sorted.find((e) => e.action === 'suggestion.bulk_approved') ??
    sorted[0];

  const counts = {
    approved: events.filter((e) => e.action === 'suggestion.approved').length,
    converted: events.filter((e) => e.action === 'suggestion.converted').length,
    bulkApproved: events.filter((e) => e.action === 'suggestion.bulk_approved').length,
  };

  const parts: string[] = [];
  if (counts.bulkApproved > 0) parts.push(`${counts.bulkApproved} bulk approved`);
  else if (counts.approved > 0) parts.push(`${counts.approved} approved`);
  if (counts.converted > 0) parts.push(`${counts.converted} converted`);
  if (events.some((e) => e.action === 'reorder.scan_completed')) {
    parts.push('reorder scan');
  }

  const subtitle =
    parts.length > 0
      ? parts.join(' → ')
      : `${events.length} event${events.length === 1 ? '' : 's'}`;

  return {
    title: primary.record_label ?? primary.summary,
    subtitle,
  };
}

export function resolveAuditRecordHref(event: AuditEvent): string | null {
  if (event.entity_type === 'purchase_order') {
    return `/purchasing/${event.entity_id}`;
  }
  if (event.entity_type === 'goods_receipt') {
    const poId = event.metadata.purchaseOrderId;
    if (typeof poId === 'string') return `/purchasing/${poId}`;
  }
  if (event.entity_type === 'import_run') {
    return '/import';
  }
  const vendorSlug = event.metadata.vendorSlug;
  const primarySku = event.metadata.primarySku;
  if (typeof vendorSlug === 'string' && typeof primarySku === 'string') {
    return `/inventory/${vendorSlug}/unit/${encodeURIComponent(primarySku)}`;
  }
  if (event.entity_type === 'purchase_suggestion') {
    return '/inventory/reorder?tab=history';
  }
  if (event.entity_type === 'pos_transaction') {
    return `/orders/pos/${event.entity_id}`;
  }
  return null;
}

export function groupEventsIntoWorkflows(events: AuditEvent[]): AuditWorkflow[] {
  const used = new Set<string>();
  const workflows: AuditWorkflow[] = [];

  const byCorrelation = new Map<string, AuditEvent[]>();
  for (const e of events) {
    if (e.correlation_id) {
      const list = byCorrelation.get(e.correlation_id) ?? [];
      list.push(e);
      byCorrelation.set(e.correlation_id, list);
    }
  }

  for (const [cid, evts] of byCorrelation) {
    evts.forEach((e) => used.add(e.id));
    const sorted = [...evts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const { title, subtitle } = workflowTitle(evts);
    workflows.push({
      id: cid,
      title,
      subtitle,
      actor_email: sorted.find((e) => e.actor_email)?.actor_email ?? null,
      started_at: sorted[sorted.length - 1]?.created_at ?? sorted[0].created_at,
      event_count: evts.length,
      primary_href: resolveAuditRecordHref(sorted[0]),
      events: sorted,
    });
  }

  const remaining = events.filter((e) => !used.has(e.id));
  for (const e of remaining) {
    if (used.has(e.id)) continue;
    const poNumber = extractPoNumber(e);
    const cluster = [e];
    used.add(e.id);

    if (poNumber) {
      for (const other of remaining) {
        if (used.has(other.id)) continue;
        if (extractPoNumber(other) !== poNumber) continue;
        const delta = Math.abs(
          new Date(e.created_at).getTime() - new Date(other.created_at).getTime()
        );
        if (delta <= 120_000) {
          cluster.push(other);
          used.add(other.id);
        }
      }
    }

    const sorted = cluster.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const { title, subtitle } = workflowTitle(cluster);
    workflows.push({
      id: `retro-${sorted[0].id}`,
      title,
      subtitle,
      actor_email: sorted.find((ev) => ev.actor_email)?.actor_email ?? null,
      started_at: sorted[sorted.length - 1]?.created_at ?? sorted[0].created_at,
      event_count: cluster.length,
      primary_href: resolveAuditRecordHref(sorted[0]),
      events: sorted,
    });
  }

  return workflows.sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
}

function formatVal(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') return String(v);
  return String(v);
}

export function formatAuditChanges(changes: AuditChange[]): string {
  if (changes.length === 0) return '';
  return changes
    .map((c) => `${c.field}: ${formatVal(c.old)} → ${formatVal(c.new)}`)
    .join('; ');
}

export function buildAuditSearchString(params: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== 'page') next.set(k, v);
  }
  return next.toString();
}

export function auditEventsToCsv(events: AuditEvent[]): string {
  const header = [
    'Time',
    'User',
    'Action',
    'Record',
    'Summary',
    'Changes',
    'Source',
    'Entity type',
    'Entity id',
  ];
  const lines = events.map((e) =>
    [
      new Date(e.created_at).toISOString(),
      e.actor_email ?? 'System',
      e.action,
      e.record_label ?? '',
      e.summary.replace(/"/g, '""'),
      formatAuditChanges(e.changes).replace(/"/g, '""'),
      e.source,
      e.entity_type,
      e.entity_id,
    ]
      .map((cell) => `"${cell}"`)
      .join(',')
  );
  return [header.map((h) => `"${h}"`).join(','), ...lines].join('\n');
}
