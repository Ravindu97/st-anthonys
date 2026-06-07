import { randomUUID } from 'crypto';
import type { Pool, PoolClient } from 'pg';
import {
  groupEventsIntoWorkflows,
  type AuditChange,
  type AuditEntityType,
  type AuditEvent,
  type AuditPreset,
  type AuditSource,
} from './audit-shared';
import { getPool } from './db';

export type {
  AuditChange,
  AuditEntityType,
  AuditEvent,
  AuditPreset,
  AuditSource,
  AuditWorkflow,
} from './audit-shared';

export {
  AUDIT_ACTION_LABELS,
  AUDIT_PRESETS,
  auditEventsToCsv,
  buildAuditSearchString,
  formatAuditChanges,
  groupEventsIntoWorkflows,
  resolveAuditRecordHref,
} from './audit-shared';

type Db = Pool | PoolClient;

export function newCorrelationId(): string {
  return randomUUID();
}

function parseChanges(raw: unknown): AuditChange[] {
  if (!raw) return [];
  const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(arr) ? (arr as AuditChange[]) : [];
}

function parseAuditRow(row: Record<string, unknown>): AuditEvent {
  return {
    ...(row as Omit<AuditEvent, 'metadata' | 'changes'>),
    metadata:
      typeof row.metadata === 'string'
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : (row.metadata as Record<string, unknown>) ?? {},
    changes: parseChanges(row.changes),
    source: (row.source as AuditSource) ?? 'web',
    correlation_id: (row.correlation_id as string | null) ?? null,
    record_label: (row.record_label as string | null) ?? null,
  };
}

export async function recordAuditEvent(
  db: Db,
  input: {
    companyId: string;
    entityType: AuditEntityType;
    entityId: string;
    action: string;
    actorId?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
    source?: AuditSource;
    changes?: AuditChange[];
    recordLabel?: string | null;
  }
) {
  await db.query(
    `INSERT INTO audit_events (
       company_id, entity_type, entity_id, action, actor_id, summary, metadata,
       correlation_id, source, changes, record_label
     ) VALUES ($1::uuid, $2::audit_entity_type, $3::uuid, $4, $5::uuid, $6, $7, $8::uuid, $9, $10, $11)`,
    [
      input.companyId,
      input.entityType,
      input.entityId,
      input.action,
      input.actorId ?? null,
      input.summary,
      JSON.stringify(input.metadata ?? {}),
      input.correlationId ?? null,
      input.source ?? 'web',
      JSON.stringify(input.changes ?? []),
      input.recordLabel ?? null,
    ]
  );
}

type ListOpts = {
  companyId?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  actorId?: string;
  userId?: string;
  action?: string;
  q?: string;
  from?: string;
  to?: string;
  preset?: AuditPreset;
  page?: number;
  pageSize?: number;
};

function applyPreset(opts: ListOpts): ListOpts {
  if (!opts.preset) return opts;
  const next = { ...opts };
  const now = new Date();
  if (opts.preset === 'last_7_days') {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    next.from = from.toISOString().slice(0, 10);
  }
  return next;
}

function buildWhere(opts: ListOpts, values: unknown[]) {
  let where = 'WHERE 1=1';

  if (opts.companyId) {
    values.push(opts.companyId);
    where += ` AND ae.company_id = $${values.length}::uuid`;
  }
  if (opts.entityType) {
    values.push(opts.entityType);
    where += ` AND ae.entity_type = $${values.length}::audit_entity_type`;
  }
  if (opts.entityId) {
    values.push(opts.entityId);
    where += ` AND ae.entity_id = $${values.length}::uuid`;
  }
  const actorFilter = opts.actorId ?? opts.userId;
  if (actorFilter) {
    values.push(actorFilter);
    where += ` AND ae.actor_id = $${values.length}::uuid`;
  }
  if (opts.action) {
    values.push(opts.action);
    where += ` AND ae.action = $${values.length}`;
  }
  if (opts.preset === 'po_actions') {
    where += ` AND ae.action LIKE 'po.%'`;
  }
  if (opts.preset === 'reorder_only') {
    where += ` AND (ae.entity_type IN ('purchase_suggestion', 'reorder_scan') OR ae.action LIKE 'suggestion.%' OR ae.action = 'reorder.scan_completed')`;
  }
  if (opts.preset === 'imports') {
    where += ` AND (ae.entity_type = 'import_run' OR ae.action LIKE 'import.%')`;
  }
  if (opts.preset === 'adjustments') {
    where += ` AND (ae.entity_type IN ('inventory_adjustment', 'stock_item') OR ae.action = 'adjustment.created')`;
  }
  if (opts.q?.trim()) {
    values.push(`%${opts.q.trim()}%`);
    where += ` AND (
      ae.summary ILIKE $${values.length}
      OR u.email ILIKE $${values.length}
      OR ae.record_label ILIKE $${values.length}
      OR ae.metadata::text ILIKE $${values.length}
    )`;
  }
  if (opts.from) {
    values.push(opts.from);
    where += ` AND ae.created_at >= $${values.length}::timestamptz`;
  }
  if (opts.to) {
    values.push(`${opts.to}T23:59:59`);
    where += ` AND ae.created_at <= $${values.length}::timestamptz`;
  }

  return where;
}

export async function listAuditEvents(opts?: ListOpts) {
  const resolved = applyPreset(opts ?? {});
  const pool = getPool();
  const page = Math.max(1, resolved.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, resolved.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  const where = buildWhere(resolved, values);

  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT ae.*, u.email AS actor_email, COUNT(*) OVER()::int AS total_count
     FROM audit_events ae
     LEFT JOIN app_users u ON u.id = ae.actor_id
     ${where}
     ORDER BY ae.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...row }) => parseAuditRow(row));

  return { items, totalCount, page, pageSize };
}

export async function listAllAuditEventsForGrouping(opts?: Omit<ListOpts, 'page' | 'pageSize'>) {
  const resolved = applyPreset(opts ?? {});
  const pool = getPool();
  const values: unknown[] = [];
  const where = buildWhere(resolved, values);

  const { rows } = await pool.query(
    `SELECT ae.*, u.email AS actor_email
     FROM audit_events ae
     LEFT JOIN app_users u ON u.id = ae.actor_id
     ${where}
     ORDER BY ae.created_at DESC
     LIMIT 500`,
    values
  );

  return rows.map((row) => parseAuditRow(row));
}

export async function listAuditWorkflows(
  opts?: Omit<ListOpts, 'page' | 'pageSize'> & { page?: number; pageSize?: number }
) {
  const allEvents = await listAllAuditEventsForGrouping(opts);
  const workflows = groupEventsIntoWorkflows(allEvents);
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, opts?.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  return {
    items: workflows.slice(offset, offset + pageSize),
    totalCount: workflows.length,
    page,
    pageSize,
  };
}

export async function getPurchaseOrderAuditTrail(
  poId: string,
  limit = 50
): Promise<AuditEvent[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ae.*, u.email AS actor_email
     FROM audit_events ae
     LEFT JOIN app_users u ON u.id = ae.actor_id
     WHERE
       (ae.entity_type = 'purchase_order' AND ae.entity_id = $1::uuid)
       OR (
         ae.entity_type = 'goods_receipt'
         AND ae.entity_id IN (
           SELECT id FROM goods_receipts WHERE purchase_order_id = $1::uuid
         )
       )
       OR ae.metadata->>'purchaseOrderId' = $1::text
     ORDER BY ae.created_at DESC
     LIMIT $2`,
    [poId, limit]
  );
  return rows.map((row) => parseAuditRow(row));
}

export async function getRecordAuditStory(
  entityType: AuditEntityType,
  entityId: string,
  limit = 50
): Promise<AuditEvent[]> {
  if (entityType === 'purchase_order') {
    const events = await getPurchaseOrderAuditTrail(entityId, limit);
    return events.reverse();
  }
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ae.*, u.email AS actor_email
     FROM audit_events ae
     LEFT JOIN app_users u ON u.id = ae.actor_id
     WHERE ae.entity_type = $1::audit_entity_type AND ae.entity_id = $2::uuid
     ORDER BY ae.created_at ASC
     LIMIT $3`,
    [entityType, entityId, limit]
  );
  return rows.map((row) => parseAuditRow(row));
}

export async function getEntityAuditTrail(
  entityType: AuditEntityType,
  entityId: string,
  limit = 50
): Promise<AuditEvent[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ae.*, u.email AS actor_email
     FROM audit_events ae
     LEFT JOIN app_users u ON u.id = ae.actor_id
     WHERE ae.entity_type = $1::audit_entity_type AND ae.entity_id = $2::uuid
     ORDER BY ae.created_at DESC
     LIMIT $3`,
    [entityType, entityId, limit]
  );
  return rows.map((row) => parseAuditRow(row));
}

export async function listAuditUsers() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, email FROM app_users WHERE is_active = true ORDER BY email`
  );
  return rows as Array<{ id: string; email: string }>;
}

export async function getAuditKpis(companyId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS events_today,
       COUNT(*) FILTER (WHERE action = 'po.created' AND created_at >= CURRENT_DATE)::int AS pos_today,
       COUNT(*) FILTER (WHERE action = 'import.completed' AND created_at >= CURRENT_DATE)::int AS imports_today,
       (
         SELECT u.email FROM audit_events ae2
         JOIN app_users u ON u.id = ae2.actor_id
         WHERE ae2.company_id = $1::uuid AND ae2.created_at >= CURRENT_DATE - INTERVAL '7 days'
         GROUP BY u.email ORDER BY COUNT(*) DESC LIMIT 1
       ) AS top_actor_7d
     FROM audit_events
     WHERE company_id = $1::uuid`,
    [companyId]
  );
  return rows[0] as {
    events_today: number;
    pos_today: number;
    imports_today: number;
    top_actor_7d: string | null;
  };
}

export async function getPurchaseOrderAttribution(poId: string) {
  const pool = getPool();
  const { rows: po } = await pool.query(
    `SELECT po.id, po.po_number, po.created_at, po.status, u.email AS created_by_email
     FROM purchase_orders po
     LEFT JOIN app_users u ON u.id = po.created_by
     WHERE po.id = $1::uuid`,
    [poId]
  );
  if (po.length === 0) return null;

  const { rows: grns } = await pool.query(
    `SELECT gr.id, gr.grn_number, gr.received_at, gr.created_at, u.email AS created_by_email
     FROM goods_receipts gr
     LEFT JOIN app_users u ON u.id = gr.created_by
     WHERE gr.purchase_order_id = $1::uuid
     ORDER BY gr.created_at`,
    [poId]
  );

  return {
    po: po[0] as {
      id: string;
      po_number: string;
      created_at: Date;
      status: string;
      created_by_email: string | null;
    },
    grns: grns as Array<{
      id: string;
      grn_number: string;
      received_at: Date;
      created_at: Date;
      created_by_email: string | null;
    }>,
  };
}
