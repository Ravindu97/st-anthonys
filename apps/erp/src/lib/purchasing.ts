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
    `SELECT COUNT(*)::int + 1 AS n FROM goods_receipts WHERE company_id = $1`,
    [companyId]
  );
  return `GRN-${String(rows[0].n).padStart(5, '0')}`;
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
  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT
       po.*,
       s.name AS supplier_name,
       u.email AS created_by_email,
       COUNT(pol.id)::int AS line_count,
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
    items: rows.map(({ total_count: _, ...item }) => item) as PurchaseOrder[],
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
     WHERE po.id = $1`,
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
     WHERE pol.purchase_order_id = $1
     ORDER BY pol.line_no`,
    [id]
  );
  return { order: po[0], lines };
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
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: po } = await client.query(
      'SELECT * FROM purchase_orders WHERE id = $1',
      [input.purchaseOrderId]
    );
    if (po.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'PO not found' };
    }
    const order = po[0];
    const grnNumber = await nextGrnNumber(client, input.companyId);

    const { rows: grn } = await client.query(
      `INSERT INTO goods_receipts (
         company_id, grn_number, purchase_order_id, location_id, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
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

    let allReceived = true;
    for (const recv of input.lines) {
      const { rows: pol } = await client.query(
        `SELECT pol.*, si.duty_rate_pct
         FROM purchase_order_lines pol
         JOIN stock_items si ON si.id = pol.stock_item_id
         WHERE pol.id = $1`,
        [recv.lineId]
      );
      if (pol.length === 0) continue;
      const line = pol[0];
      const newReceived = Number(line.received_qty) + recv.quantity;
      if (newReceived < Number(line.quantity)) allReceived = false;

      const dutyPct = Number(line.duty_rate_pct ?? 0);
      const dutyAmount = recv.quantity * Number(line.unit_rate) * (dutyPct / 100);

      await client.query(
        `INSERT INTO goods_receipt_lines (
           goods_receipt_id, purchase_order_line_id, stock_item_id,
           quantity, unit_rate, duty_amount
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
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
        `UPDATE purchase_order_lines SET received_qty = $2 WHERE id = $1`,
        [recv.lineId, newReceived]
      );

      const { rows: bal } = await client.query(
        `SELECT quantity, rate, value FROM inventory_balances
         WHERE snapshot_id = $1 AND stock_item_id = $2`,
        [snap.snapshot_id, line.stock_item_id]
      );
      const prev = bal[0] ?? { quantity: 0, rate: line.unit_rate, value: 0 };
      const newQty = Number(prev.quantity ?? 0) + recv.quantity;
      const rate = line.unit_rate;
      const newValue = newQty * Number(rate);

      await client.query(
        `INSERT INTO inventory_balances (snapshot_id, stock_item_id, quantity, rate, value)
         VALUES ($1, $2, $3, $4, $5)
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
    }

    const newStatus = allReceived ? 'received' : 'partial';
    const prevStatus = order.status as string;
    await client.query(
      `UPDATE purchase_orders SET status = $2::po_status, updated_at = now() WHERE id = $1`,
      [input.purchaseOrderId, newStatus]
    );

    const receivedLines = input.lines.filter((l) => l.quantity > 0).length;
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
        lineCount: receivedLines,
        newStatus,
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
    return { ok: true as const, grnNumber, grnId: grn[0].id as string };
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
     WHERE location_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [locationId]
  );
  return rows[0] as { snapshot_id: string } | undefined;
}
