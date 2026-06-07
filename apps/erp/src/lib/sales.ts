import type { PoolClient } from 'pg';
import {
  getOrCreateEntityCorrelationId,
  newCorrelationId,
  recordAuditEvent,
} from './audit';
import { getPool } from './db';
import { resolveItemPrice } from './pricing';
import { recordStockMovement } from './stock-movements';

export type SalesDocument = {
  id: string;
  doc_kind: string;
  doc_number: string;
  customer_id: string | null;
  customer_name: string | null;
  status: string;
  fulfillment_type: string;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  notes: string | null;
  created_at: Date;
  line_count: number;
};

export type SalesLine = {
  id: string;
  line_no: number;
  stock_item_id: string;
  item_name: string;
  primary_sku: string | null;
  quantity: string;
  unit_rate: string;
  discount_pct: string;
  line_total: string;
  is_special_order: boolean;
  picked_qty: string;
};

async function nextDocNumber(
  client: PoolClient,
  companyId: string,
  prefix: string
): Promise<string> {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int + 1 AS n FROM sales_documents
     WHERE company_id = $1 AND doc_number LIKE $2`,
    [companyId, `${prefix}-%`]
  );
  const n = Number(rows[0].n);
  return `${prefix}-${String(n).padStart(5, '0')}`;
}

export async function listSalesDocuments(opts?: {
  docKind?: string;
  status?: string;
  customerId?: string;
  fulfillmentType?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const pool = getPool();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  let where = 'WHERE 1=1';

  if (opts?.docKind) {
    values.push(opts.docKind);
    where += ` AND sd.doc_kind = $${values.length}::sales_doc_kind`;
  }
  if (opts?.status) {
    values.push(opts.status);
    where += ` AND sd.status = $${values.length}::sales_doc_status`;
  }
  if (opts?.customerId) {
    values.push(opts.customerId);
    where += ` AND sd.customer_id = $${values.length}::uuid`;
  }
  if (opts?.fulfillmentType) {
    values.push(opts.fulfillmentType);
    where += ` AND sd.fulfillment_type = $${values.length}::fulfillment_type`;
  }
  if (opts?.q?.trim()) {
    values.push(`%${opts.q.trim()}%`);
    const i = values.length;
    where += ` AND (sd.doc_number ILIKE $${i} OR c.name ILIKE $${i})`;
  }
  if (opts?.dateFrom) {
    values.push(opts.dateFrom);
    where += ` AND sd.created_at >= $${values.length}::date`;
  }
  if (opts?.dateTo) {
    values.push(opts.dateTo);
    where += ` AND sd.created_at < ($${values.length}::date + interval '1 day')`;
  }
  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT
       sd.*,
       c.name AS customer_name,
       COUNT(sdl.id)::int AS line_count,
       COUNT(*) OVER()::int AS total_count
     FROM sales_documents sd
     LEFT JOIN customers c ON c.id = sd.customer_id
     LEFT JOIN sales_document_lines sdl ON sdl.document_id = sd.id
     ${where}
     GROUP BY sd.id, c.name
     ORDER BY sd.updated_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...item }) => item) as SalesDocument[];
  return { items, totalCount, page, pageSize };
}

export async function getSalesDocument(id: string) {
  const pool = getPool();
  const { rows: docs } = await pool.query(
    `SELECT sd.*, c.name AS customer_name, c.code AS customer_code, loc.name AS location_name
     FROM sales_documents sd
     LEFT JOIN customers c ON c.id = sd.customer_id
     LEFT JOIN locations loc ON loc.id = sd.location_id
     WHERE sd.id = $1`,
    [id]
  );
  if (docs.length === 0) return null;

  const { rows: lines } = await pool.query(
    `SELECT
       sdl.*,
       si.name AS item_name,
       a.alias AS primary_sku
     FROM sales_document_lines sdl
     JOIN stock_items si ON si.id = sdl.stock_item_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases
       WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     WHERE sdl.document_id = $1
     ORDER BY sdl.line_no`,
    [id]
  );

  return {
    document: docs[0],
    lines: lines as SalesLine[],
  };
}

export async function createSalesDocument(input: {
  companyId: string;
  docKind: 'quote' | 'order';
  customerId?: string;
  fulfillmentType?: string;
  priceLevelId?: string;
  locationId?: string;
  notes?: string;
  validUntil?: string;
  createdBy?: string;
  lines: Array<{
    stockItemId: string;
    quantity: number;
    unitRate?: number;
    discountPct?: number;
    isSpecialOrder?: boolean;
  }>;
  correlationId?: string;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prefix = input.docKind === 'quote' ? 'QT' : 'SO';
    const docNumber = await nextDocNumber(client, input.companyId, prefix);

    let priceLevelId = input.priceLevelId ?? null;
    if (!priceLevelId && input.customerId) {
      const { rows: cust } = await client.query(
        'SELECT price_level_id FROM customers WHERE id = $1',
        [input.customerId]
      );
      priceLevelId = cust[0]?.price_level_id ?? null;
    }

    const { rows: docRows } = await client.query(
      `INSERT INTO sales_documents (
         company_id, doc_kind, doc_number, customer_id, status,
         fulfillment_type, price_level_id, location_id, notes, valid_until, created_by
       ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.companyId,
        input.docKind,
        docNumber,
        input.customerId ?? null,
        input.fulfillmentType ?? 'pickup',
        priceLevelId,
        input.locationId ?? null,
        input.notes ?? null,
        input.validUntil ?? null,
        input.createdBy ?? null,
      ]
    );
    const doc = docRows[0];
    let subtotal = 0;
    let lineNo = 1;

    for (const line of input.lines) {
      let rate = line.unitRate;
      if (rate == null && priceLevelId) {
        rate =
          (await resolveItemPrice(
            line.stockItemId,
            priceLevelId,
            line.quantity
          )) ?? 0;
      }
      rate = rate ?? 0;
      const discount = line.discountPct ?? 0;
      const lineTotal = line.quantity * rate * (1 - discount / 100);
      subtotal += lineTotal;

      await client.query(
        `INSERT INTO sales_document_lines (
           document_id, line_no, stock_item_id, quantity, unit_rate,
           discount_pct, line_total, is_special_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          doc.id,
          lineNo++,
          line.stockItemId,
          line.quantity,
          rate,
          discount,
          lineTotal,
          line.isSpecialOrder ?? false,
        ]
      );

      if (line.isSpecialOrder) {
        await client.query(
          `INSERT INTO purchase_suggestions (
             company_id, stock_item_id, location_id,
             current_qty, min_qty, suggested_qty, status, notes
           )
           SELECT $1, $2, COALESCE($3, loc.id), 0, 0, $4, 'draft', $5
           FROM locations loc
           WHERE loc.id = COALESCE($3, (
             SELECT l.id FROM locations l
             JOIN stock_categories cat ON cat.id = l.stock_category_id
             JOIN stock_items si ON si.category_id = cat.id
             WHERE si.id = $2 LIMIT 1
           ))
           LIMIT 1`,
          [
            input.companyId,
            line.stockItemId,
            input.locationId ?? null,
            line.quantity,
            `Special order from ${docNumber}`,
          ]
        );
      }
    }

    const tax = 0;
    const total = subtotal + tax;
    await client.query(
      `UPDATE sales_documents SET subtotal = $2, tax_amount = $3, total_amount = $4, updated_at = now()
       WHERE id = $1`,
      [doc.id, subtotal, tax, total]
    );

    const correlationId = input.correlationId ?? newCorrelationId();
    await recordAuditEvent(client, {
      companyId: input.companyId,
      entityType: 'sales_document',
      entityId: doc.id as string,
      action: 'sales.created',
      actorId: input.createdBy,
      summary: `${input.docKind === 'quote' ? 'Quote' : 'Order'} ${docNumber} — ${input.lines.length} line(s)`,
      recordLabel: docNumber,
      correlationId,
      source: 'api',
      metadata: {
        docNumber,
        docKind: input.docKind,
        customerId: input.customerId ?? null,
        fulfillmentType: input.fulfillmentType ?? 'pickup',
        lineCount: input.lines.length,
        total,
      },
    });

    await client.query('COMMIT');
    return { id: doc.id as string, docNumber, correlationId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function updateSalesStatus(
  id: string,
  status: string,
  userId?: string,
  payment?: { method: 'cash' | 'card' | 'account'; reference: string }
) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: prevRows } = await client.query(
      `SELECT * FROM sales_documents WHERE id = $1::uuid`,
      [id]
    );
    if (prevRows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const prev = prevRows[0];

    const { rows } = await client.query(
      `UPDATE sales_documents SET
         status = $2::sales_doc_status,
         updated_at = now(),
         payment_method = COALESCE($3::payment_method, payment_method),
         payment_reference = COALESCE($4, payment_reference)
       WHERE id = $1 RETURNING *`,
      [id, status, payment?.method ?? null, payment?.reference ?? null]
    );
    const doc = rows[0];
    const correlationId = await getOrCreateEntityCorrelationId(
      client,
      'sales_document',
      id
    );

    if (prev.status !== status) {
      await recordAuditEvent(client, {
        companyId: doc.company_id as string,
        entityType: 'sales_document',
        entityId: id,
        action: 'sales.status_changed',
        actorId: userId,
        summary: `${doc.doc_number} → ${status}`,
        recordLabel: doc.doc_number as string,
        correlationId,
        source: 'api',
        metadata: {
          docNumber: doc.doc_number,
          oldStatus: prev.status,
          newStatus: status,
          status,
        },
      });
    }

    if (payment?.reference) {
      await recordAuditEvent(client, {
        companyId: doc.company_id as string,
        entityType: 'sales_document',
        entityId: id,
        action: 'payment.mock_completed',
        actorId: userId,
        summary: `Payment ${payment.method} — ${doc.doc_number}`,
        recordLabel: doc.doc_number as string,
        correlationId,
        source: 'api',
        metadata: {
          targetType: 'sales',
          targetId: id,
          method: payment.method,
          paymentReference: payment.reference,
          docNumber: doc.doc_number,
        },
      });
    }

    if (status === 'collected' && doc.doc_kind === 'order') {
      await decrementStockForOrder(client, doc, userId);
    }

    await client.query('COMMIT');
    return doc;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function decrementStockForOrder(
  client: PoolClient,
  doc: { id: string; company_id: string; location_id: string | null },
  _userId?: string
) {
  const { rows: lines } = await client.query(
    `SELECT sdl.*, si.category_id
     FROM sales_document_lines sdl
     JOIN stock_items si ON si.id = sdl.stock_item_id
     WHERE sdl.document_id = $1`,
    [doc.id]
  );

  for (const line of lines) {
    const locationId = doc.location_id;
    if (!locationId) continue;

    const snap = await latestSnapshotForLocation(client, locationId);
    if (!snap) continue;

    const qty = Number(line.quantity);
    const { rows: bal } = await client.query(
      `SELECT quantity, rate, value FROM inventory_balances
       WHERE snapshot_id = $1 AND stock_item_id = $2`,
      [snap.snapshot_id, line.stock_item_id]
    );
    const prev = bal[0] ?? { quantity: 0, rate: line.unit_rate, value: 0 };
    const newQty = Math.max(0, Number(prev.quantity ?? 0) - qty);
    const rate = prev.rate ?? line.unit_rate;
    const newValue = newQty * Number(rate);

    await client.query(
      `INSERT INTO inventory_balances (snapshot_id, stock_item_id, quantity, rate, value)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (snapshot_id, stock_item_id) DO UPDATE SET
         quantity = EXCLUDED.quantity,
         value = EXCLUDED.value`,
      [snap.snapshot_id, line.stock_item_id, newQty, rate, newValue]
    );

    await recordStockMovement(client, {
      companyId: doc.company_id,
      locationId,
      stockItemId: line.stock_item_id,
      movementType: 'sale',
      quantityDelta: -qty,
      rate: Number(line.unit_rate),
      valueDelta: -qty * Number(line.unit_rate),
      referenceType: 'sales_document',
      referenceId: doc.id,
      note: 'Sales order collected',
    });
  }
}

async function latestSnapshotForLocation(client: PoolClient, locationId: string) {
  const { rows } = await client.query(
    `SELECT id AS snapshot_id, location_id
     FROM inventory_snapshots
     WHERE location_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [locationId]
  );
  return rows[0] as { snapshot_id: string; location_id: string } | undefined;
}

export async function updatePickProgress(
  documentId: string,
  lineId: string,
  pickedQty: number,
  actorId?: string
) {
  const pool = getPool();
  const { rows: docRows } = await pool.query(
    `SELECT company_id, doc_number FROM sales_documents WHERE id = $1::uuid`,
    [documentId]
  );
  const { rows } = await pool.query(
    `UPDATE sales_document_lines SET picked_qty = $3
     WHERE id = $2 AND document_id = $1
     RETURNING *`,
    [documentId, lineId, pickedQty]
  );
  const line = rows[0];
  if (line && docRows[0]) {
    const correlationId = await getOrCreateEntityCorrelationId(
      pool,
      'sales_document',
      documentId
    );
    await recordAuditEvent(pool, {
      companyId: docRows[0].company_id as string,
      entityType: 'sales_document',
      entityId: documentId,
      action: 'sales.pick_progress',
      actorId,
      summary: `${docRows[0].doc_number} — picked qty ${pickedQty}`,
      recordLabel: docRows[0].doc_number as string,
      correlationId,
      source: 'api',
      metadata: {
        docNumber: docRows[0].doc_number,
        lineId,
        pickedQty,
      },
    });
  }
  return line ?? null;
}

export async function listFulfillmentLocations() {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT loc.id, loc.name, cat.code AS vendor_code
    FROM locations loc
    JOIN stock_categories cat ON cat.id = loc.stock_category_id
    ORDER BY loc.name
  `);
  return rows as Array<{ id: string; name: string; vendor_code: string }>;
}

export async function convertQuoteToOrder(quoteId: string, createdBy?: string) {
  const quote = await getSalesDocument(quoteId);
  if (!quote || quote.document.doc_kind !== 'quote') {
    return { ok: false as const, error: 'Quote not found' };
  }

  const pool = getPool();
  const correlationId = await getOrCreateEntityCorrelationId(
    pool,
    'sales_document',
    quoteId
  );

  const result = await createSalesDocument({
    companyId: quote.document.company_id,
    docKind: 'order',
    customerId: quote.document.customer_id ?? undefined,
    fulfillmentType: quote.document.fulfillment_type,
    priceLevelId: quote.document.price_level_id ?? undefined,
    locationId: quote.document.location_id ?? undefined,
    notes: quote.document.notes ?? undefined,
    createdBy,
    correlationId,
    lines: quote.lines.map((l) => ({
      stockItemId: l.stock_item_id,
      quantity: Number(l.quantity),
      unitRate: Number(l.unit_rate),
      discountPct: Number(l.discount_pct),
      isSpecialOrder: l.is_special_order,
    })),
  });

  await recordAuditEvent(pool, {
    companyId: quote.document.company_id,
    entityType: 'sales_document',
    entityId: quoteId,
    action: 'sales.quote_converted',
    actorId: createdBy,
    summary: `${quote.document.doc_number} → ${result.docNumber}`,
    recordLabel: quote.document.doc_number,
    correlationId,
    source: 'api',
    metadata: {
      quoteId,
      orderId: result.id,
      quoteNumber: quote.document.doc_number,
      orderNumber: result.docNumber,
    },
  });

  await pool.query(
    `UPDATE sales_documents SET source_quote_id = $2 WHERE id = $1`,
    [result.id, quoteId]
  );

  return { ok: true as const, ...result };
}
