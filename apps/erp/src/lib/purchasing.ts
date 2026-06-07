import type { PoolClient } from 'pg';
import { newCorrelationId, recordAuditEvent, type AuditSource } from './audit';
import { getPool } from './db';
import { recordStockMovement } from './stock-movements';

export type Supplier = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  payment_terms_days: number;
  is_active: boolean;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_name: string;
  status: string;
  subtotal: string;
  total_amount: string;
  expected_date: string | null;
  created_at: Date;
  created_by_email: string | null;
  line_count: number;
  lines_fully_received: number;
  receipt_label: string;
};

export type PoReceiptLineSummary = {
  id: string;
  line_no: number;
  stock_item_id: string;
  item_name: string;
  primary_sku: string | null;
  vendor_slug: string;
  ordered: number;
  received: number;
  remaining: number;
  fully_received: boolean;
};

export type PoReceiptSummary = {
  total_lines: number;
  lines_fully_received: number;
  lines_partially_received: number;
  lines_open: number;
  all_received: boolean;
  lines: PoReceiptLineSummary[];
};

export type GoodsReceiptListItem = {
  id: string;
  grn_number: string;
  purchase_order_id: string;
  po_number: string;
  supplier_name: string;
  location_name: string;
  received_at: Date;
  created_by_email: string | null;
  line_count: number;
  total_qty: number;
  notes: string | null;
};

export type GoodsReceiptLine = {
  id: string;
  line_no: number;
  stock_item_id: string;
  item_name: string;
  primary_sku: string | null;
  quantity: string;
  unit_rate: string;
  duty_amount: string;
  line_total: string;
};

export type GoodsReceiptDocument = {
  receipt: {
    id: string;
    grn_number: string;
    received_at: Date;
    notes: string | null;
    created_by_email: string | null;
    location_name: string;
    location_tally_name: string | null;
    vendor_code: string;
    vendor_name: string;
    company_id: string;
  };
  purchase_order: {
    id: string;
    po_number: string;
    supplier_name: string;
    supplier_code: string;
    status: string;
  };
  lines: GoodsReceiptLine[];
};

async function nextPoNumber(client: PoolClient, companyId: string) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int + 1 AS n FROM purchase_orders WHERE company_id = $1`,
    [companyId]
  );
  return `PO-${String(rows[0].n).padStart(5, '0')}`;
}

async function nextGrnNumber(client: PoolClient, companyId: string) {
  const { rows } = await client.query(
    `SELECT COALESCE(
       MAX(CAST(SUBSTRING(grn_number FROM 5) AS INT)),
       0
     ) + 1 AS n
     FROM goods_receipts
     WHERE company_id = $1::uuid AND grn_number ~ '^GRN-[0-9]+$'`,
    [companyId]
  );
  return `GRN-${String(rows[0].n).padStart(5, '0')}`;
}

export function formatReceiptLabel(
  status: string,
  linesFullyReceived: number,
  lineCount: number
): string {
  if (status === 'received') return 'Complete';
  if (status === 'cancelled') return 'Cancelled';
  if (lineCount === 0) return '—';
  if (linesFullyReceived === 0) return 'Awaiting';
  return `Partial (${linesFullyReceived}/${lineCount} lines)`;
}

export function poReceiptBadge(status: string): 'Awaiting' | 'Partial' | 'Received' | 'Cancelled' {
  if (status === 'received') return 'Received';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'partial') return 'Partial';
  return 'Awaiting';
}

export async function listSuppliers(opts?: { q?: string }) {
  const pool = getPool();
  const values: unknown[] = [];
  let where = 'WHERE s.is_active = true';
  if (opts?.q?.trim()) {
    values.push(`%${opts.q.trim()}%`);
    where += ` AND (s.name ILIKE $1 OR s.code ILIKE $1)`;
  }
  const { rows } = await pool.query(
    `SELECT * FROM suppliers s ${where} ORDER BY s.name`,
    values
  );
  return rows as Supplier[];
}

export async function createSupplier(input: {
  companyId: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  paymentTermsDays?: number;
}) {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO suppliers (company_id, code, name, email, phone, payment_terms_days)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      input.companyId,
      input.code,
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.paymentTermsDays ?? 30,
    ]
  );
  return rows[0];
}

export async function listPurchaseOrders(opts?: {
  status?: string;
  awaitingReceipt?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const pool = getPool();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  let where = 'WHERE 1=1';
  if (opts?.status) {
    values.push(opts.status);
    where += ` AND po.status = $${values.length}::po_status`;
  }
  if (opts?.awaitingReceipt) {
    where += ` AND po.status IN ('draft', 'submitted', 'partial')`;
  }
  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT
       po.*,
       s.name AS supplier_name,
       u.email AS created_by_email,
       COUNT(pol.id)::int AS line_count,
       COUNT(pol.id) FILTER (
         WHERE pol.received_qty >= pol.quantity
       )::int AS lines_fully_received,
       COUNT(*) OVER()::int AS total_count
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN app_users u ON u.id = po.created_by
     LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
     ${where}
     GROUP BY po.id, s.name, u.email
     ORDER BY po.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map(({ total_count: _, ...item }) => {
      const row = item as PurchaseOrder & { lines_fully_received: number; line_count: number };
      return {
        ...row,
        receipt_label: formatReceiptLabel(
          row.status,
          row.lines_fully_received,
          row.line_count
        ),
      };
    }),
    totalCount,
    page,
    pageSize,
  };
}

export type PurchaseOrderLine = {
  id: string;
  line_no: number;
  stock_item_id: string;
  quantity: string;
  unit_rate: string;
  received_qty: string;
  line_total: string;
  item_name: string;
  primary_sku: string | null;
  stock_group_name?: string | null;
  category_name?: string | null;
  category_code?: string | null;
};

export type PurchaseOrderDocument = {
  order: {
    id: string;
    po_number: string;
    status: string;
    subtotal: string;
    tax_amount: string;
    total_amount: string;
    notes: string | null;
    expected_date: string | null;
    created_at: Date;
    company_id: string;
    supplier_name: string;
    supplier_code: string;
    supplier_email: string | null;
    supplier_phone: string | null;
    payment_terms_days: number;
    location_name: string;
    location_tally_name: string | null;
    vendor_code: string;
    vendor_name: string;
  };
  lines: PurchaseOrderLine[];
};

export async function getPurchaseOrder(id: string) {
  const doc = await getPurchaseOrderDocument(id);
  if (!doc) return null;
  return { order: doc.order, lines: doc.lines };
}

export async function getPurchaseOrderDocument(
  id: string
): Promise<PurchaseOrderDocument | null> {
  const pool = getPool();
  const { rows: po } = await pool.query(
    `SELECT
       po.*,
       s.name AS supplier_name,
       s.code AS supplier_code,
       s.email AS supplier_email,
       s.phone AS supplier_phone,
       s.payment_terms_days,
       loc.name AS location_name,
       loc.tally_name AS location_tally_name,
       cat.code AS vendor_code,
       cat.name AS vendor_name
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     JOIN locations loc ON loc.id = po.location_id
     JOIN stock_categories cat ON cat.id = loc.stock_category_id
     WHERE po.id = $1::uuid`,
    [id]
  );
  if (po.length === 0) return null;

  const { rows: lines } = await pool.query(
    `SELECT
       pol.*,
       si.name AS item_name,
       a.alias AS primary_sku,
       sg.name AS stock_group_name,
       cat.name AS category_name,
       cat.code AS category_code
     FROM purchase_order_lines pol
     JOIN stock_items si ON si.id = pol.stock_item_id
     JOIN stock_categories cat ON cat.id = si.category_id
     LEFT JOIN stock_groups sg ON sg.id = si.group_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     WHERE pol.purchase_order_id = $1::uuid
     ORDER BY pol.line_no`,
    [id]
  );
  return { order: po[0], lines };
}

export async function getPurchaseOrderReceiptSummary(
  poId: string
): Promise<PoReceiptSummary | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       pol.id,
       pol.line_no,
       pol.stock_item_id,
       pol.quantity,
       pol.received_qty,
       si.name AS item_name,
       a.alias AS primary_sku,
       cat.code AS vendor_slug
     FROM purchase_order_lines pol
     JOIN stock_items si ON si.id = pol.stock_item_id
     JOIN stock_categories cat ON cat.id = si.category_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     WHERE pol.purchase_order_id = $1::uuid
     ORDER BY pol.line_no`,
    [poId]
  );
  if (rows.length === 0) {
    const { rows: po } = await pool.query(
      `SELECT id FROM purchase_orders WHERE id = $1::uuid`,
      [poId]
    );
    if (po.length === 0) return null;
    return {
      total_lines: 0,
      lines_fully_received: 0,
      lines_partially_received: 0,
      lines_open: 0,
      all_received: true,
      lines: [],
    };
  }

  const lines: PoReceiptLineSummary[] = rows.map((r) => {
    const ordered = Number(r.quantity);
    const received = Number(r.received_qty);
    const remaining = Math.max(0, ordered - received);
    const fully_received = received >= ordered;
    return {
      id: r.id as string,
      line_no: r.line_no as number,
      stock_item_id: r.stock_item_id as string,
      item_name: r.item_name as string,
      primary_sku: (r.primary_sku as string | null) ?? null,
      vendor_slug: r.vendor_slug as string,
      ordered,
      received,
      remaining,
      fully_received,
    };
  });

  const linesFullyReceived = lines.filter((l) => l.fully_received).length;
  const linesPartiallyReceived = lines.filter(
    (l) => l.received > 0 && !l.fully_received
  ).length;
  const linesOpen = lines.filter((l) => l.received === 0).length;

  return {
    total_lines: lines.length,
    lines_fully_received: linesFullyReceived,
    lines_partially_received: linesPartiallyReceived,
    lines_open: linesOpen,
    all_received: linesFullyReceived === lines.length,
    lines,
  };
}

export async function listGoodsReceipts(opts?: {
  purchaseOrderId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const pool = getPool();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  let where = 'WHERE 1=1';

  if (opts?.purchaseOrderId) {
    values.push(opts.purchaseOrderId);
    where += ` AND gr.purchase_order_id = $${values.length}::uuid`;
  }
  if (opts?.from) {
    values.push(opts.from);
    where += ` AND gr.received_at >= $${values.length}::timestamptz`;
  }
  if (opts?.to) {
    values.push(`${opts.to}T23:59:59`);
    where += ` AND gr.received_at <= $${values.length}::timestamptz`;
  }
  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT
       gr.id,
       gr.grn_number,
       gr.purchase_order_id,
       gr.received_at,
       gr.notes,
       po.po_number,
       s.name AS supplier_name,
       loc.name AS location_name,
       u.email AS created_by_email,
       COUNT(grl.id)::int AS line_count,
       COALESCE(SUM(grl.quantity), 0)::numeric AS total_qty,
       COUNT(*) OVER()::int AS total_count
     FROM goods_receipts gr
     JOIN purchase_orders po ON po.id = gr.purchase_order_id
     JOIN suppliers s ON s.id = po.supplier_id
     JOIN locations loc ON loc.id = gr.location_id
     LEFT JOIN app_users u ON u.id = gr.created_by
     LEFT JOIN goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
     ${where}
     GROUP BY gr.id, po.po_number, s.name, loc.name, u.email
     ORDER BY gr.received_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map(({ total_count: _, ...item }) => item) as GoodsReceiptListItem[],
    totalCount,
    page,
    pageSize,
  };
}

export async function getGoodsReceiptDocument(
  grnId: string
): Promise<GoodsReceiptDocument | null> {
  const pool = getPool();
  const { rows: gr } = await pool.query(
    `SELECT
       gr.*,
       po.id AS po_id,
       po.po_number,
       po.status AS po_status,
       s.name AS supplier_name,
       s.code AS supplier_code,
       loc.name AS location_name,
       loc.tally_name AS location_tally_name,
       cat.code AS vendor_code,
       cat.name AS vendor_name,
       u.email AS created_by_email
     FROM goods_receipts gr
     JOIN purchase_orders po ON po.id = gr.purchase_order_id
     JOIN suppliers s ON s.id = po.supplier_id
     JOIN locations loc ON loc.id = gr.location_id
     JOIN stock_categories cat ON cat.id = loc.stock_category_id
     LEFT JOIN app_users u ON u.id = gr.created_by
     WHERE gr.id = $1::uuid`,
    [grnId]
  );
  if (gr.length === 0) return null;

  const { rows: lines } = await pool.query(
    `SELECT
       grl.id,
       pol.line_no,
       grl.stock_item_id,
       grl.quantity,
       grl.unit_rate,
       grl.duty_amount,
       si.name AS item_name,
       a.alias AS primary_sku,
       (grl.quantity * grl.unit_rate)::numeric(18, 2) AS line_total
     FROM goods_receipt_lines grl
     JOIN purchase_order_lines pol ON pol.id = grl.purchase_order_line_id
     JOIN stock_items si ON si.id = grl.stock_item_id
     LEFT JOIN LATERAL (
       SELECT alias FROM stock_item_aliases WHERE item_id = si.id AND is_primary = true LIMIT 1
     ) a ON true
     WHERE grl.goods_receipt_id = $1::uuid
     ORDER BY pol.line_no`,
    [grnId]
  );

  const header = gr[0];
  return {
    receipt: {
      id: header.id,
      grn_number: header.grn_number,
      received_at: header.received_at,
      notes: header.notes,
      created_by_email: header.created_by_email,
      location_name: header.location_name,
      location_tally_name: header.location_tally_name,
      vendor_code: header.vendor_code,
      vendor_name: header.vendor_name,
      company_id: header.company_id,
    },
    purchase_order: {
      id: header.po_id,
      po_number: header.po_number,
      supplier_name: header.supplier_name,
      supplier_code: header.supplier_code,
      status: header.po_status,
    },
    lines: lines as GoodsReceiptLine[],
  };
}

export async function getGoodsReceiptSummariesForPo(poId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       gr.id,
       gr.grn_number,
       gr.received_at,
       u.email AS created_by_email,
       COUNT(grl.id)::int AS line_count,
       COALESCE(SUM(grl.quantity), 0)::numeric AS total_qty
     FROM goods_receipts gr
     LEFT JOIN app_users u ON u.id = gr.created_by
     LEFT JOIN goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
     WHERE gr.purchase_order_id = $1::uuid
     GROUP BY gr.id, u.email
     ORDER BY gr.received_at`,
    [poId]
  );
  return rows as Array<{
    id: string;
    grn_number: string;
    received_at: Date;
    created_by_email: string | null;
    line_count: number;
    total_qty: string;
  }>;
}

export async function suggestSupplierForVendor(vendorCode: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM suppliers
     WHERE is_active = true
       AND (UPPER(code) = UPPER($1) OR name ILIKE $2)
     ORDER BY CASE WHEN UPPER(code) = UPPER($1) THEN 0 ELSE 1 END, name
     LIMIT 1`,
    [vendorCode, `%${vendorCode}%`]
  );
  return (rows[0] as Supplier) ?? null;
}

export async function createPurchaseOrderFromSuggestions(input: {
  companyId: string;
  suggestionIds: string[];
  supplierId: string;
  locationId?: string;
  createdBy?: string;
  correlationId?: string;
  source?: AuditSource;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: sugs } = await client.query(
      `SELECT * FROM purchase_suggestions
       WHERE id = ANY($1::uuid[]) AND status = 'approved'`,
      [input.suggestionIds]
    );
    if (sugs.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'No approved suggestions found' };
    }
    if (sugs.length !== input.suggestionIds.length) {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'Some suggestions are missing or not approved' };
    }

    const locationId = input.locationId ?? sugs[0].location_id;
    const poNumber = await nextPoNumber(client, input.companyId);
    let subtotal = 0;
    const lineRows: Array<{
      stockItemId: string;
      qty: number;
      rate: number;
      lineTotal: number;
    }> = [];

    for (const s of sugs) {
      const qty = Number(s.user_adjusted_qty ?? s.suggested_qty);
      const rate = Number(s.rate_at_scan ?? 0);
      const lineTotal = qty * rate;
      subtotal += lineTotal;
      lineRows.push({
        stockItemId: s.stock_item_id,
        qty,
        rate,
        lineTotal,
      });
    }

    const { rows: po } = await client.query(
      `INSERT INTO purchase_orders (
         company_id, po_number, supplier_id, location_id, status,
         subtotal, total_amount, created_by
       ) VALUES ($1, $2, $3, $4, 'draft', $5, $5, $6)
       RETURNING *`,
      [
        input.companyId,
        poNumber,
        input.supplierId,
        locationId,
        subtotal,
        input.createdBy ?? null,
      ]
    );

    let lineNo = 1;
    for (const line of lineRows) {
      await client.query(
        `INSERT INTO purchase_order_lines (
           purchase_order_id, line_no, stock_item_id, quantity, unit_rate, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [po[0].id, lineNo++, line.stockItemId, line.qty, line.rate, line.lineTotal]
      );
    }

    await client.query(
      `UPDATE purchase_suggestions SET status = 'converted', updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [input.suggestionIds]
    );

    const correlationId = input.correlationId ?? newCorrelationId();

    await recordAuditEvent(client, {
      companyId: input.companyId,
      entityType: 'purchase_order',
      entityId: po[0].id,
      action: 'po.created',
      actorId: input.createdBy,
      summary: `Purchase order ${poNumber} created with ${lineRows.length} line(s)`,
      recordLabel: poNumber,
      correlationId,
      source: input.source ?? 'api',
      metadata: {
        poNumber,
        purchaseOrderId: po[0].id,
        lineCount: lineRows.length,
        suggestionIds: input.suggestionIds,
        supplierId: input.supplierId,
        totalAmount: subtotal,
      },
    });

    for (const suggestionId of input.suggestionIds) {
      await recordAuditEvent(client, {
        companyId: input.companyId,
        entityType: 'purchase_suggestion',
        entityId: suggestionId,
        action: 'suggestion.converted',
        actorId: input.createdBy,
        summary: `Converted to ${poNumber}`,
        recordLabel: poNumber,
        correlationId,
        source: input.source ?? 'api',
        metadata: { purchaseOrderId: po[0].id, poNumber },
      });
    }

    await client.query('COMMIT');
    return {
      ok: true as const,
      id: po[0].id as string,
      poNumber,
      lineCount: lineRows.length,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export type VendorPoBatch = {
  vendorCode: string;
  vendorName: string;
  suggestionIds: string[];
  supplierId: string;
  locationId: string;
};

/** Create one PO per vendor group from approved reorder suggestions */
export async function createBulkPurchaseOrdersByVendor(input: {
  companyId: string;
  batches: VendorPoBatch[];
  createdBy?: string;
  notes?: string;
}) {
  const results: Array<{
    ok: true;
    id: string;
    poNumber: string;
    vendorCode: string;
    lineCount: number;
  }> = [];
  const errors: string[] = [];
  const bulkCorrelationId = newCorrelationId();

  for (const batch of input.batches) {
    if (batch.suggestionIds.length === 0) continue;
    const poCorrelationId = newCorrelationId();
    const result = await createPurchaseOrderFromSuggestions({
      companyId: input.companyId,
      suggestionIds: batch.suggestionIds,
      supplierId: batch.supplierId,
      locationId: batch.locationId,
      createdBy: input.createdBy,
      correlationId: poCorrelationId,
      source: 'api',
    });
    if (!result.ok) {
      errors.push(`${batch.vendorName}: ${result.error}`);
      continue;
    }
    if (input.notes) {
      const pool = getPool();
      await pool.query(`UPDATE purchase_orders SET notes = $2 WHERE id = $1`, [
        result.id,
        input.notes,
      ]);
    }
    results.push({
      ok: true,
      id: result.id,
      poNumber: result.poNumber,
      vendorCode: batch.vendorCode,
      lineCount: result.lineCount,
    });
  }

  if (results.length === 0) {
    return {
      ok: false as const,
      error: errors.join('; ') || 'No purchase orders created',
    };
  }

  const pool = getPool();
  await recordAuditEvent(pool, {
    companyId: input.companyId,
    entityType: 'purchase_order',
    entityId: results[0].id,
    action: 'po.bulk_created',
    actorId: input.createdBy,
    summary: `Bulk PO run created ${results.length} purchase order(s)`,
    recordLabel: `Bulk PO ×${results.length}`,
    correlationId: bulkCorrelationId,
    source: 'api',
    metadata: {
      orderCount: results.length,
      orders: results.map((o) => ({
        id: o.id,
        poNumber: o.poNumber,
        vendorCode: o.vendorCode,
        lineCount: o.lineCount,
      })),
      errors,
    },
  });

  return { ok: true as const, orders: results, errors };
}

export async function createPurchaseOrderFromSuggestion(input: {
  companyId: string;
  suggestionId: string;
  supplierId: string;
  createdBy?: string;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: sug } = await client.query(
      `SELECT * FROM purchase_suggestions WHERE id = $1 AND status = 'approved'`,
      [input.suggestionId]
    );
    if (sug.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'Approved suggestion not found' };
    }
    const s = sug[0];

    const { rows: rateRows } = await client.query(
      `SELECT rate FROM inventory_balances ib
       JOIN inventory_snapshots inv ON inv.id = ib.snapshot_id
       WHERE ib.stock_item_id = $1 AND inv.location_id = $2
       ORDER BY inv.created_at DESC LIMIT 1`,
      [s.stock_item_id, s.location_id]
    );
    const rate = Number(rateRows[0]?.rate ?? 0);
    const qty = Number(s.suggested_qty);
    const lineTotal = qty * rate;
    const poNumber = await nextPoNumber(client, input.companyId);

    const { rows: po } = await client.query(
      `INSERT INTO purchase_orders (
         company_id, po_number, supplier_id, location_id, status,
         suggestion_id, subtotal, total_amount, created_by
       ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $6, $7)
       RETURNING *`,
      [
        input.companyId,
        poNumber,
        input.supplierId,
        s.location_id,
        input.suggestionId,
        lineTotal,
        input.createdBy ?? null,
      ]
    );

    await client.query(
      `INSERT INTO purchase_order_lines (
         purchase_order_id, line_no, stock_item_id, quantity, unit_rate, line_total
       ) VALUES ($1, 1, $2, $3, $4, $5)`,
      [po[0].id, s.stock_item_id, qty, rate, lineTotal]
    );

    await client.query(
      `UPDATE purchase_suggestions SET status = 'converted', updated_at = now() WHERE id = $1`,
      [input.suggestionId]
    );

    const correlationId = newCorrelationId();

    await recordAuditEvent(client, {
      companyId: input.companyId,
      entityType: 'purchase_order',
      entityId: po[0].id,
      action: 'po.created',
      actorId: input.createdBy,
      summary: `Purchase order ${poNumber} created from reorder suggestion`,
      recordLabel: poNumber,
      correlationId,
      source: 'api',
      metadata: {
        poNumber,
        purchaseOrderId: po[0].id,
        lineCount: 1,
        suggestionId: input.suggestionId,
        supplierId: input.supplierId,
        totalAmount: lineTotal,
      },
    });

    await recordAuditEvent(client, {
      companyId: input.companyId,
      entityType: 'purchase_suggestion',
      entityId: input.suggestionId,
      action: 'suggestion.converted',
      actorId: input.createdBy,
      summary: `Converted to ${poNumber}`,
      recordLabel: poNumber,
      correlationId,
      source: 'api',
      metadata: { purchaseOrderId: po[0].id, poNumber },
    });

    await client.query('COMMIT');
    return { ok: true as const, id: po[0].id as string, poNumber };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function receiveGoods(input: {
  companyId: string;
  purchaseOrderId: string;
  lines: Array<{ lineId: string; quantity: number }>;
  createdBy?: string;
  notes?: string;
}) {
  const recvLines = input.lines.filter((l) => l.quantity > 0);
  if (recvLines.length === 0) {
    return { ok: false as const, error: 'Enter quantity to receive for at least one line' };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: po } = await client.query(
      `SELECT po.*, loc.name AS location_name
       FROM purchase_orders po
       JOIN locations loc ON loc.id = po.location_id
       WHERE po.id = $1::uuid`,
      [input.purchaseOrderId]
    );
    if (po.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'PO not found' };
    }
    const order = po[0];
    const poStatus = order.status as string;

    if (poStatus === 'cancelled') {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'Cannot receive goods on a cancelled purchase order' };
    }
    if (poStatus === 'received') {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'Purchase order is already fully received' };
    }

    const { rows: poLines } = await client.query(
      `SELECT pol.id, pol.quantity, pol.received_qty
       FROM purchase_order_lines pol
       WHERE pol.purchase_order_id = $1::uuid`,
      [input.purchaseOrderId]
    );
    const lineById = new Map(
      poLines.map((l) => [
        l.id as string,
        {
          quantity: Number(l.quantity),
          received_qty: Number(l.received_qty),
        },
      ])
    );

    for (const recv of recvLines) {
      const pol = lineById.get(recv.lineId);
      if (!pol) {
        await client.query('ROLLBACK');
        return { ok: false as const, error: `Invalid line: ${recv.lineId}` };
      }
      if (recv.quantity <= 0) {
        await client.query('ROLLBACK');
        return { ok: false as const, error: 'Quantities must be greater than zero' };
      }
      const remaining = pol.quantity - pol.received_qty;
      if (recv.quantity > remaining) {
        await client.query('ROLLBACK');
        return {
          ok: false as const,
          error: `Cannot receive more than remaining quantity (${remaining} left on line)`,
        };
      }
    }

    const grnNumber = await nextGrnNumber(client, input.companyId);

    const { rows: grn } = await client.query(
      `INSERT INTO goods_receipts (
         company_id, grn_number, purchase_order_id, location_id, notes, created_by
       ) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, $6::uuid) RETURNING id`,
      [
        input.companyId,
        grnNumber,
        input.purchaseOrderId,
        order.location_id,
        input.notes ?? null,
        input.createdBy ?? null,
      ]
    );

    const snap = await latestSnapshot(client, order.location_id);
    if (!snap) {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'No inventory snapshot for location' };
    }

    const inventoryUpdated: Array<{
      stockItemId: string;
      sku: string | null;
      vendorSlug: string;
      newQty: number;
      quantityReceived: number;
    }> = [];
    const lineDeltas: Array<{ lineId: string; quantity: number; sku: string | null }> = [];

    for (const recv of recvLines) {
      const { rows: pol } = await client.query(
        `SELECT pol.*, si.duty_rate_pct, si.name AS item_name,
                a.alias AS primary_sku, cat.code AS vendor_slug
         FROM purchase_order_lines pol
         JOIN stock_items si ON si.id = pol.stock_item_id
         JOIN stock_categories cat ON cat.id = si.category_id
         LEFT JOIN LATERAL (
           SELECT alias FROM stock_item_aliases WHERE item_id = si.id AND is_primary = true LIMIT 1
         ) a ON true
         WHERE pol.id = $1::uuid AND pol.purchase_order_id = $2::uuid`,
        [recv.lineId, input.purchaseOrderId]
      );
      const line = pol[0];
      const newReceived = Number(line.received_qty) + recv.quantity;

      const dutyPct = Number(line.duty_rate_pct ?? 0);
      const dutyAmount = recv.quantity * Number(line.unit_rate) * (dutyPct / 100);

      await client.query(
        `INSERT INTO goods_receipt_lines (
           goods_receipt_id, purchase_order_line_id, stock_item_id,
           quantity, unit_rate, duty_amount
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
        [
          grn[0].id,
          recv.lineId,
          line.stock_item_id,
          recv.quantity,
          line.unit_rate,
          dutyAmount,
        ]
      );

      await client.query(
        `UPDATE purchase_order_lines SET received_qty = $2 WHERE id = $1::uuid`,
        [recv.lineId, newReceived]
      );

      const { rows: bal } = await client.query(
        `SELECT quantity, rate, value FROM inventory_balances
         WHERE snapshot_id = $1::uuid AND stock_item_id = $2::uuid`,
        [snap.snapshot_id, line.stock_item_id]
      );
      const prev = bal[0] ?? { quantity: 0, rate: line.unit_rate, value: 0 };
      const newQty = Number(prev.quantity ?? 0) + recv.quantity;
      const rate = line.unit_rate;
      const newValue = newQty * Number(rate);

      await client.query(
        `INSERT INTO inventory_balances (snapshot_id, stock_item_id, quantity, rate, value)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5)
         ON CONFLICT (snapshot_id, stock_item_id) DO UPDATE SET
           quantity = EXCLUDED.quantity,
           rate = EXCLUDED.rate,
           value = EXCLUDED.value`,
        [snap.snapshot_id, line.stock_item_id, newQty, rate, newValue]
      );

      await recordStockMovement(client, {
        companyId: input.companyId,
        locationId: order.location_id,
        stockItemId: line.stock_item_id,
        movementType: 'purchase_receipt',
        quantityDelta: recv.quantity,
        rate: Number(rate),
        valueDelta: recv.quantity * Number(rate),
        referenceType: 'goods_receipt',
        referenceId: grn[0].id,
        note: `GRN ${grnNumber}`,
      });

      inventoryUpdated.push({
        stockItemId: line.stock_item_id,
        sku: line.primary_sku ?? null,
        vendorSlug: line.vendor_slug,
        newQty,
        quantityReceived: recv.quantity,
      });
      lineDeltas.push({
        lineId: recv.lineId,
        quantity: recv.quantity,
        sku: line.primary_sku ?? null,
      });
    }

    const { rows: allLines } = await client.query(
      `SELECT quantity, received_qty FROM purchase_order_lines WHERE purchase_order_id = $1::uuid`,
      [input.purchaseOrderId]
    );
    const allReceived = allLines.every(
      (l) => Number(l.received_qty) >= Number(l.quantity)
    );
    const newStatus = allReceived ? 'received' : 'partial';
    const prevStatus = poStatus;
    await client.query(
      `UPDATE purchase_orders SET status = $2::po_status, updated_at = now() WHERE id = $1::uuid`,
      [input.purchaseOrderId, newStatus]
    );

    const grnCorrelationId = newCorrelationId();

    await recordAuditEvent(client, {
      companyId: input.companyId,
      entityType: 'goods_receipt',
      entityId: grn[0].id,
      action: 'grn.created',
      actorId: input.createdBy,
      summary: `Goods receipt ${grnNumber} recorded for ${order.po_number}`,
      recordLabel: grnNumber,
      correlationId: grnCorrelationId,
      source: 'api',
      metadata: {
        grnNumber,
        purchaseOrderId: input.purchaseOrderId,
        poNumber: order.po_number,
        lineCount: recvLines.length,
        newStatus,
        lineDeltas,
      },
    });

    if (prevStatus !== newStatus) {
      await recordAuditEvent(client, {
        companyId: input.companyId,
        entityType: 'purchase_order',
        entityId: input.purchaseOrderId,
        action: 'po.status_changed',
        actorId: input.createdBy,
        summary: `${order.po_number} status changed from ${prevStatus} to ${newStatus}`,
        recordLabel: order.po_number,
        correlationId: grnCorrelationId,
        source: 'api',
        changes: [{ field: 'status', old: prevStatus, new: newStatus }],
        metadata: { from: prevStatus, to: newStatus, grnNumber, purchaseOrderId: input.purchaseOrderId },
      });
    }

    await client.query('COMMIT');
    return {
      ok: true as const,
      grnNumber,
      grnId: grn[0].id as string,
      poStatus: newStatus,
      linesReceived: recvLines.length,
      inventoryUpdated,
      locationName: order.location_name as string,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function latestSnapshot(client: PoolClient, locationId: string) {
  const { rows } = await client.query(
    `SELECT id AS snapshot_id FROM inventory_snapshots
     WHERE location_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
    [locationId]
  );
  return rows[0] as { snapshot_id: string } | undefined;
}
