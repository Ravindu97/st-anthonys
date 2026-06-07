import { getPool } from './db';

export type SalesHubChannel = 'all' | 'counter' | 'pickup' | 'delivery' | 'quote';

export type SalesHubRow = {
  source: 'document' | 'pos';
  id: string;
  docNumber: string;
  channel: 'counter' | 'pickup' | 'delivery' | 'quote';
  status: string;
  customerName: string | null;
  total: number;
  lineCount: number;
  createdAt: Date;
  paymentMethod: string | null;
  locationName: string | null;
};

export async function listSalesHub(opts: {
  channel?: SalesHubChannel;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  includeDocuments?: boolean;
  includePos?: boolean;
}) {
  const channel = opts.channel ?? 'all';
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const includeDocuments = opts.includeDocuments ?? true;
  const includePos = opts.includePos ?? true;

  const showPos =
    includePos && (channel === 'all' || channel === 'counter');
  const showDocs =
    includeDocuments &&
    (channel === 'all' ||
      channel === 'pickup' ||
      channel === 'delivery' ||
      channel === 'quote');

  if (!showPos && !showDocs) {
    return { items: [] as SalesHubRow[], totalCount: 0, page, pageSize };
  }

  const parts: string[] = [];
  const values: unknown[] = [];

  if (showPos) {
    let posWhere = 'WHERE 1=1';
    if (opts.q?.trim()) {
      values.push(`%${opts.q.trim()}%`);
      const i = values.length;
      posWhere += ` AND (pt.transaction_number ILIKE $${i} OR c.name ILIKE $${i})`;
    }
    if (opts.dateFrom) {
      values.push(opts.dateFrom);
      posWhere += ` AND pt.created_at >= $${values.length}::date`;
    }
    if (opts.dateTo) {
      values.push(opts.dateTo);
      posWhere += ` AND pt.created_at < ($${values.length}::date + interval '1 day')`;
    }

    parts.push(`
      SELECT
        'pos'::text AS source,
        pt.id::text AS id,
        pt.transaction_number AS doc_number,
        'counter'::text AS channel,
        'completed'::text AS status,
        c.name AS customer_name,
        pt.total_amount::numeric AS total,
        COUNT(ptl.id)::int AS line_count,
        pt.created_at,
        pt.payment_method::text AS payment_method,
        loc.name AS location_name
      FROM pos_transactions pt
      JOIN pos_sessions ps ON ps.id = pt.session_id
      JOIN pos_registers pr ON pr.id = ps.register_id
      JOIN locations loc ON loc.id = pr.location_id
      LEFT JOIN customers c ON c.id = pt.customer_id
      LEFT JOIN pos_transaction_lines ptl ON ptl.transaction_id = pt.id
      ${posWhere}
      GROUP BY pt.id, c.name, loc.name
    `);
  }

  if (showDocs) {
    let docWhere = 'WHERE 1=1';
    if (channel === 'quote') {
      docWhere += ` AND sd.doc_kind = 'quote'`;
    } else if (channel === 'pickup') {
      docWhere += ` AND sd.doc_kind = 'order' AND sd.fulfillment_type = 'pickup'`;
    } else if (channel === 'delivery') {
      docWhere += ` AND sd.doc_kind = 'order' AND sd.fulfillment_type = 'delivery'`;
    } else if (channel === 'all') {
      docWhere += ` AND sd.fulfillment_type != 'counter'`;
    }
    if (opts.status) {
      values.push(opts.status);
      docWhere += ` AND sd.status = $${values.length}::sales_doc_status`;
    }
    if (opts.q?.trim()) {
      values.push(`%${opts.q.trim()}%`);
      const i = values.length;
      docWhere += ` AND (sd.doc_number ILIKE $${i} OR c.name ILIKE $${i})`;
    }
    if (opts.dateFrom) {
      values.push(opts.dateFrom);
      docWhere += ` AND sd.created_at >= $${values.length}::date`;
    }
    if (opts.dateTo) {
      values.push(opts.dateTo);
      docWhere += ` AND sd.created_at < ($${values.length}::date + interval '1 day')`;
    }

    parts.push(`
      SELECT
        'document'::text AS source,
        sd.id::text AS id,
        sd.doc_number,
        CASE
          WHEN sd.doc_kind = 'quote' THEN 'quote'
          ELSE sd.fulfillment_type::text
        END AS channel,
        sd.status::text AS status,
        c.name AS customer_name,
        sd.total_amount::numeric AS total,
        COUNT(sdl.id)::int AS line_count,
        sd.created_at,
        NULL::text AS payment_method,
        loc.name AS location_name
      FROM sales_documents sd
      LEFT JOIN customers c ON c.id = sd.customer_id
      LEFT JOIN locations loc ON loc.id = sd.location_id
      LEFT JOIN sales_document_lines sdl ON sdl.document_id = sd.id
      ${docWhere}
      GROUP BY sd.id, c.name, loc.name
    `);
  }

  values.push(pageSize, offset);
  const limitIdx = values.length - 1;
  const offsetIdx = values.length;

  const pool = getPool();
  const { rows } = await pool.query(
    `WITH combined AS (
       ${parts.join(' UNION ALL ')}
     )
     SELECT *, COUNT(*) OVER()::int AS total_count
     FROM combined
     ORDER BY created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items: SalesHubRow[] = rows.map((row) => ({
    source: row.source as 'document' | 'pos',
    id: row.id as string,
    docNumber: row.doc_number as string,
    channel: row.channel as SalesHubRow['channel'],
    status: row.status as string,
    customerName: (row.customer_name as string | null) ?? null,
    total: Number(row.total ?? 0),
    lineCount: Number(row.line_count ?? 0),
    createdAt: row.created_at as Date,
    paymentMethod: (row.payment_method as string | null) ?? null,
    locationName: (row.location_name as string | null) ?? null,
  }));

  return { items, totalCount, page, pageSize };
}
