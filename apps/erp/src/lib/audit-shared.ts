/** Client-safe audit types and helpers (no database imports). */

export type AuditEntityType =
  | 'purchase_order'
  | 'purchase_suggestion'
  | 'goods_receipt'
  | 'reorder_scan'
  | 'import_run'
  | 'inventory_adjustment'
  | 'stock_item'
  | 'pos_transaction'
  | 'pos_session'
  | 'customer'
  | 'sales_document'
  | 'price_list'
  | 'reorder_rule';

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
  | 'adjustments'
  | 'sales'
  | 'customers'
  | 'pricing'
  | 'pos_sales';

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
  'pos.session_opened': 'POS session opened',
  'pos.session_closed': 'POS session closed',
  'reorder.rule_upserted': 'Reorder rule saved',
  'reorder.rules_imported': 'Reorder rules imported',
  'reorder.category_default_upserted': 'Category default saved',
  'price_list.exported': 'Price list exported',
  'customer.created': 'Customer created',
  'customer.updated': 'Customer updated',
  'price_list.imported': 'Price list imported',
  'price_list.import_dry_run': 'Price list preview',
  'price_list.item_upserted': 'Price updated',
  'sales.created': 'Sales doc created',
  'sales.status_changed': 'Status changed',
  'sales.pick_progress': 'Pick progress',
  'sales.quote_converted': 'Quote converted',
  'payment.mock_completed': 'Payment completed',
};

export const AUDIT_PRESETS: { id: AuditPreset; label: string }[] = [
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'po_actions', label: 'PO actions' },
  { id: 'reorder_only', label: 'Reorder only' },
  { id: 'imports', label: 'Imports' },
  { id: 'adjustments', label: 'Adjustments' },
  { id: 'sales', label: 'Sales' },
  { id: 'customers', label: 'Customers' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'pos_sales', label: 'POS sales' },
];

const RECORD_LABEL_PATTERNS = [
  /^PO-\d+/,
  /^SO-\d+/,
  /^QT-\d+/,
  /^TXN-\d+/,
  /^CUST-\d+/,
  /^GRN-\d+/,
];

function extractRecordKey(event: AuditEvent): string | null {
  if (event.record_label) {
    for (const pat of RECORD_LABEL_PATTERNS) {
      if (pat.test(event.record_label)) return event.record_label.match(pat)?.[0] ?? event.record_label;
    }
    if (event.record_label.startsWith('CUST-')) return event.record_label;
  }
  const meta = event.metadata;
  if (typeof meta.poNumber === 'string') return meta.poNumber;
  if (typeof meta.docNumber === 'string') return meta.docNumber;
  if (typeof meta.transactionNumber === 'string') return meta.transactionNumber;
  if (typeof meta.customerCode === 'string') return meta.customerCode;
  for (const pat of RECORD_LABEL_PATTERNS) {
    const match = event.summary.match(pat);
    if (match) return match[0];
  }
  return null;
}

function workflowTitle(events: AuditEvent[]): { title: string; subtitle: string } {
  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const primary =
    sorted.find((e) => e.action === 'po.created') ??
    sorted.find((e) => e.action === 'po.bulk_created') ??
    sorted.find((e) => e.action === 'sales.created') ??
    sorted.find((e) => e.action === 'customer.created') ??
    sorted.find((e) => e.action === 'price_list.imported') ??
    sorted.find((e) => e.action === 'import.completed') ??
    sorted.find((e) => e.action === 'grn.created') ??
    sorted.find((e) => e.action === 'pos.session_opened') ??
    sorted.find((e) => e.action === 'pos.sale_completed') ??
    sorted.find((e) => e.action === 'adjustment.created') ??
    sorted.find((e) => e.action === 'suggestion.bulk_approved') ??
    sorted[0];

  const salesSteps: string[] = [];
  if (events.some((e) => e.action === 'sales.created')) salesSteps.push('created');
  if (events.some((e) => e.action === 'sales.quote_converted')) salesSteps.push('converted');
  if (events.some((e) => e.action === 'sales.status_changed')) {
    const statuses = events
      .filter((e) => e.action === 'sales.status_changed')
      .map((e) => String(e.metadata.status ?? e.metadata.newStatus ?? ''))
      .filter(Boolean);
    if (statuses.includes('confirmed')) salesSteps.push('confirmed');
    if (statuses.includes('collected') || statuses.includes('delivered')) {
      salesSteps.push('collected');
    }
  }
  if (events.some((e) => e.action === 'sales.pick_progress')) salesSteps.push('picked');
  if (events.some((e) => e.action === 'payment.mock_completed')) salesSteps.push('paid');

  if (salesSteps.length > 1) {
    return {
      title: primary.record_label ?? primary.summary,
      subtitle: [...new Set(salesSteps)].join(' → '),
    };
  }

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
  if (events.some((e) => e.action === 'suggestion.auto_created')) {
    const n = events.filter((e) => e.action === 'suggestion.auto_created').length;
    parts.push(`${n} auto-created`);
  }
  if (events.some((e) => e.action === 'reorder.rules_imported')) {
    parts.push('rules import');
  }
  if (events.some((e) => e.action === 'price_list.item_upserted')) {
    parts.push('price edits');
  }
  if (events.some((e) => e.action === 'customer.updated')) {
    parts.push('updated');
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
  if (event.action === 'payment.mock_completed') {
    const targetType = event.metadata.targetType;
    const targetId = event.metadata.targetId;
    if (targetType === 'pos' && typeof targetId === 'string') {
      return `/orders/pos/${targetId}`;
    }
    if (targetType === 'sales' && typeof targetId === 'string') {
      return `/orders/${targetId}`;
    }
  }
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
  if (event.entity_type === 'customer') {
    return `/customers/${event.entity_id}`;
  }
  if (event.entity_type === 'sales_document') {
    return `/orders/${event.entity_id}`;
  }
  if (event.entity_type === 'price_list') {
    return `/pricing/${event.entity_id}`;
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
  if (event.entity_type === 'pos_session') {
    return '/pos';
  }
  if (event.entity_type === 'reorder_rule') {
    return '/inventory/reorder?tab=rules';
  }
  return null;
}

function bestPrimaryHref(events: AuditEvent[]): string | null {
  const priority = [
    'sales_document',
    'customer',
    'price_list',
    'purchase_order',
    'pos_transaction',
    'pos_session',
    'goods_receipt',
    'import_run',
  ] as const;
  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  for (const type of priority) {
    const match = sorted.find((e) => e.entity_type === type);
    const href = match ? resolveAuditRecordHref(match) : null;
    if (href) return href;
  }
  return resolveAuditRecordHref(sorted[0]);
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
      primary_href: bestPrimaryHref(sorted),
      events: sorted,
    });
  }

  const remaining = events.filter((e) => !used.has(e.id));
  for (const e of remaining) {
    if (used.has(e.id)) continue;
    const recordKey = extractRecordKey(e);
    const cluster = [e];
    used.add(e.id);

    if (recordKey) {
      for (const other of remaining) {
        if (used.has(other.id)) continue;
        if (extractRecordKey(other) !== recordKey) continue;
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
      primary_href: bestPrimaryHref(sorted),
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
