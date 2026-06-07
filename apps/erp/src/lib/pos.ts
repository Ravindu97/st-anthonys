import type { PoolClient } from 'pg';
import { newCorrelationId, recordAuditEvent } from './audit';
import { getPool } from './db';
import { resolveItemPrice } from './pricing';
import { recordStockMovement } from './stock-movements';

export type PosRegister = {
  id: string;
  name: string;
  location_id: string;
  location_name: string;
  price_level_id: string | null;
  price_level_name: string | null;
  is_active: boolean;
};

export type PosLookupItem = {
  stock_item_id: string;
  item_name: string;
  sku: string;
  vendor_code: string;
  vendor_slug: string;
  on_hand: number;
  unit_rate: number;
  price_source: 'price_list' | 'inventory';
};

export type CartLineInput = {
  stockItemId: string;
  quantity: number;
};

export type PricedCartLine = CartLineInput & {
  item_name: string;
  sku: string;
  vendor_code: string;
  vendor_slug: string;
  on_hand: number;
  unit_rate: number;
  line_total: number;
  price_source: 'price_list' | 'inventory';
};

async function effectivePriceLevelId(
  client: PoolClient | ReturnType<typeof getPool>,
  registerPriceLevelId: string | null,
  customerId?: string
): Promise<string | null> {
  if (!customerId) return registerPriceLevelId;
  const { rows } = await (client as PoolClient).query(
    'SELECT price_level_id FROM customers WHERE id = $1::uuid',
    [customerId]
  );
  return (rows[0]?.price_level_id as string | null) ?? registerPriceLevelId;
}

async function getOnHandAndInventoryRate(
  db: PoolClient | ReturnType<typeof getPool>,
  stockItemId: string,
  locationId: string
): Promise<{ on_hand: number; inventory_rate: number }> {
  const { rows } = await (db as PoolClient).query(
    `SELECT ib.quantity, ib.rate
     FROM inventory_balances ib
     JOIN inventory_snapshots inv ON inv.id = ib.snapshot_id
     WHERE ib.stock_item_id = $1::uuid AND inv.location_id = $2::uuid
     ORDER BY inv.created_at DESC LIMIT 1`,
    [stockItemId, locationId]
  );
  return {
    on_hand: Number(rows[0]?.quantity ?? 0),
    inventory_rate: Number(rows[0]?.rate ?? 0),
  };
}

async function resolveLineRate(
  db: PoolClient | ReturnType<typeof getPool>,
  stockItemId: string,
  quantity: number,
  priceLevelId: string | null,
  locationId: string
): Promise<{ unit_rate: number; price_source: 'price_list' | 'inventory' }> {
  let rate: number | null = null;
  if (priceLevelId) {
    rate = await resolveItemPrice(stockItemId, priceLevelId, quantity);
  }
  if (rate != null && rate > 0) {
    return { unit_rate: rate, price_source: 'price_list' };
  }
  const { inventory_rate } = await getOnHandAndInventoryRate(db, stockItemId, locationId);
  return { unit_rate: inventory_rate, price_source: 'inventory' };
}

export async function listRegisters(companyId?: string) {
  const pool = getPool();
  const filter = companyId ? 'WHERE pr.company_id = $1::uuid' : '';
  const params = companyId ? [companyId] : [];
  const { rows } = await pool.query(
    `SELECT pr.*, loc.name AS location_name, pl.name AS price_level_name
     FROM pos_registers pr
     JOIN locations loc ON loc.id = pr.location_id
     LEFT JOIN price_levels pl ON pl.id = pr.price_level_id
     ${filter}
     ORDER BY pr.name`,
    params
  );
  return rows as PosRegister[];
}

export async function openPosSession(input: {
  registerId: string;
  openedBy: string;
  openingCash?: number;
}) {
  const pool = getPool();
  const { rows: existing } = await pool.query(
    `SELECT id FROM pos_sessions WHERE register_id = $1::uuid AND closed_at IS NULL`,
    [input.registerId]
  );
  if (existing.length > 0) {
    return { ok: false as const, error: 'Register already has an open session' };
  }

  const { rows: reg } = await pool.query(
    `SELECT pr.name AS register_name, pr.company_id
     FROM pos_registers pr WHERE pr.id = $1::uuid`,
    [input.registerId]
  );
  if (reg.length === 0) {
    return { ok: false as const, error: 'Register not found' };
  }

  const { rows } = await pool.query(
    `INSERT INTO pos_sessions (register_id, opened_by, opening_cash)
     VALUES ($1::uuid, $2::uuid, $3) RETURNING *`,
    [input.registerId, input.openedBy, input.openingCash ?? 0]
  );
  const session = rows[0];
  const correlationId = newCorrelationId();
  await recordAuditEvent(pool, {
    companyId: reg[0].company_id as string,
    entityType: 'pos_session',
    entityId: session.id,
    action: 'pos.session_opened',
    actorId: input.openedBy,
    summary: `Opened POS session on ${reg[0].register_name}`,
    recordLabel: reg[0].register_name as string,
    correlationId,
    source: 'api',
    metadata: {
      registerId: input.registerId,
      registerName: reg[0].register_name,
      openingCash: input.openingCash ?? 0,
    },
  });
  return { ok: true as const, session };
}

export async function closePosSession(
  sessionId: string,
  closingCash: number,
  actorId?: string
) {
  const pool = getPool();
  const { rows: before } = await pool.query(
    `SELECT ps.*, pr.name AS register_name, pr.company_id
     FROM pos_sessions ps
     JOIN pos_registers pr ON pr.id = ps.register_id
     WHERE ps.id = $1::uuid AND ps.closed_at IS NULL`,
    [sessionId]
  );
  if (before.length === 0) return null;

  const { rows } = await pool.query(
    `UPDATE pos_sessions SET closed_at = now(), closing_cash = $2
     WHERE id = $1::uuid AND closed_at IS NULL RETURNING *`,
    [sessionId, closingCash]
  );
  const session = rows[0];
  if (session) {
    const correlationId = await (async () => {
      const { rows: prior } = await pool.query(
        `SELECT correlation_id FROM audit_events
         WHERE entity_type = 'pos_session' AND entity_id = $1::uuid
           AND action = 'pos.session_opened' AND correlation_id IS NOT NULL
         LIMIT 1`,
        [sessionId]
      );
      return (prior[0]?.correlation_id as string | undefined) ?? newCorrelationId();
    })();
    await recordAuditEvent(pool, {
      companyId: before[0].company_id as string,
      entityType: 'pos_session',
      entityId: sessionId,
      action: 'pos.session_closed',
      actorId: actorId ?? (before[0].opened_by as string),
      summary: `Closed POS session on ${before[0].register_name}`,
      recordLabel: before[0].register_name as string,
      correlationId,
      source: 'api',
      metadata: {
        registerId: before[0].register_id,
        registerName: before[0].register_name,
        openingCash: Number(before[0].opening_cash),
        closingCash,
      },
    });
  }
  return session ?? null;
}

export async function getOpenSession(registerId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ps.*, pr.name AS register_name, pr.location_id, pr.price_level_id
     FROM pos_sessions ps
     JOIN pos_registers pr ON pr.id = ps.register_id
     WHERE ps.register_id = $1::uuid AND ps.closed_at IS NULL
     ORDER BY ps.opened_at DESC LIMIT 1`,
    [registerId]
  );
  return rows[0] ?? null;
}

/** @deprecated Use lookupPosItems */
export async function lookupSku(sku: string, locationId?: string) {
  const items = await lookupPosItems(sku, {
    locationId: locationId!,
    priceLevelId: null,
  });
  return items.map((i) => ({
    stock_item_id: i.stock_item_id,
    item_name: i.item_name,
    sku: i.sku,
    quantity: String(i.on_hand),
    rate: String(i.unit_rate),
  }));
}

export async function lookupPosItems(
  query: string,
  opts: { locationId: string; priceLevelId: string | null; customerId?: string }
): Promise<PosLookupItem[]> {
  const pool = getPool();
  const pattern = `%${query.trim()}%`;
  const priceLevelId = await effectivePriceLevelId(
    pool,
    opts.priceLevelId,
    opts.customerId
  );

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (si.id)
       si.id AS stock_item_id,
       si.name AS item_name,
       sia.alias AS sku,
       cat.code AS vendor_code,
       LOWER(cat.code) AS vendor_slug
     FROM stock_item_aliases sia
     JOIN stock_items si ON si.id = sia.item_id
     JOIN stock_categories cat ON cat.id = si.category_id
     WHERE sia.alias ILIKE $1 OR si.name ILIKE $1
     ORDER BY si.id, sia.is_primary DESC NULLS LAST, sia.alias
     LIMIT 20`,
    [pattern]
  );

  const items: PosLookupItem[] = [];
  for (const row of rows) {
    const stockItemId = row.stock_item_id as string;
    const { on_hand, unit_rate, price_source } = await (async () => {
      const stock = await getOnHandAndInventoryRate(pool, stockItemId, opts.locationId);
      const priced = await resolveLineRate(
        pool,
        stockItemId,
        1,
        priceLevelId,
        opts.locationId
      );
      return { on_hand: stock.on_hand, ...priced };
    })();
    items.push({
      stock_item_id: stockItemId,
      item_name: row.item_name as string,
      sku: row.sku as string,
      vendor_code: row.vendor_code as string,
      vendor_slug: row.vendor_slug as string,
      on_hand,
      unit_rate,
      price_source,
    });
  }
  return items;
}

export type PosBrowseVendor = {
  code: string;
  name: string;
  slug: string;
};

export async function listPosBrowseVendors(): Promise<PosBrowseVendor[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT DISTINCT cat.code, cat.name, LOWER(cat.code) AS slug
    FROM stock_categories cat
    JOIN locations loc ON loc.stock_category_id = cat.id
    JOIN inventory_snapshots inv ON inv.location_id = loc.id
    ORDER BY cat.code
  `);
  return rows as PosBrowseVendor[];
}

export async function browsePosItems(opts: {
  locationId: string;
  priceLevelId: string | null;
  customerId?: string;
  vendorCode?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: PosLookupItem[]; total: number; vendorCode: string | null; page: number }> {
  const pool = getPool();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, opts.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const priceLevelId = await effectivePriceLevelId(
    pool,
    opts.priceLevelId,
    opts.customerId
  );

  const { rows: locRows } = await pool.query(
    `SELECT cat.code AS vendor_code
     FROM locations loc
     JOIN stock_categories cat ON cat.id = loc.stock_category_id
     WHERE loc.id = $1::uuid`,
    [opts.locationId]
  );
  const locationVendor = (locRows[0]?.vendor_code as string | undefined) ?? null;
  const vendorCode = opts.vendorCode?.trim() || locationVendor;
  const pattern = opts.q?.trim() ? `%${opts.q.trim()}%` : null;

  const baseParams: (string | number)[] = [opts.locationId];
  const filterClauses: string[] = [];
  if (vendorCode) {
    baseParams.push(vendorCode);
    filterClauses.push(`cat.code = $${baseParams.length}`);
  }
  if (pattern) {
    baseParams.push(pattern);
    const p = `$${baseParams.length}`;
    filterClauses.push(
      `(si.name ILIKE ${p} OR EXISTS (
         SELECT 1 FROM stock_item_aliases sia
         WHERE sia.item_id = si.id AND sia.alias ILIKE ${p}
       ))`
    );
  }
  const whereSql = filterClauses.length ? filterClauses.join(' AND ') : 'TRUE';
  const snapCte = `WITH snap AS (
     SELECT inv.id AS snapshot_id
     FROM inventory_snapshots inv
     WHERE inv.location_id = $1::uuid
     ORDER BY inv.created_at DESC
     LIMIT 1
   )`;
  const fromSql = `FROM inventory_balances ib
     JOIN snap ON snap.snapshot_id = ib.snapshot_id
     JOIN stock_items si ON si.id = ib.stock_item_id
     JOIN stock_categories cat ON cat.id = si.category_id`;

  const { rows: countRows } = await pool.query(
    `${snapCte}
     SELECT COUNT(*)::int AS total
     ${fromSql}
     WHERE ${whereSql}`,
    baseParams
  );
  const total = Number(countRows[0]?.total ?? 0);

  const listParams = [...baseParams, pageSize, offset];
  const limitIdx = baseParams.length + 1;
  const offsetIdx = baseParams.length + 2;
  const { rows } = await pool.query(
    `${snapCte}
     SELECT
       si.id AS stock_item_id,
       si.name AS item_name,
       (
         SELECT sia.alias
         FROM stock_item_aliases sia
         WHERE sia.item_id = si.id
         ORDER BY sia.is_primary DESC NULLS LAST, sia.alias
         LIMIT 1
       ) AS sku,
       cat.code AS vendor_code,
       LOWER(cat.code) AS vendor_slug,
       COALESCE(ib.quantity, 0) AS on_hand
     ${fromSql}
     WHERE ${whereSql}
     ORDER BY si.name ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams
  );

  const items: PosLookupItem[] = [];
  for (const row of rows) {
    const stockItemId = row.stock_item_id as string;
    const priced = await resolveLineRate(pool, stockItemId, 1, priceLevelId, opts.locationId);
    items.push({
      stock_item_id: stockItemId,
      item_name: row.item_name as string,
      sku: (row.sku as string) ?? '',
      vendor_code: row.vendor_code as string,
      vendor_slug: row.vendor_slug as string,
      on_hand: Number(row.on_hand ?? 0),
      unit_rate: priced.unit_rate,
      price_source: priced.price_source,
    });
  }

  return { items, total, vendorCode, page };
}

export async function resolveCartLinePrices(
  lines: CartLineInput[],
  opts: {
    locationId: string;
    priceLevelId: string | null;
    customerId?: string;
  }
): Promise<PricedCartLine[]> {
  const pool = getPool();
  const priceLevelId = await effectivePriceLevelId(
    pool,
    opts.priceLevelId,
    opts.customerId
  );

  const result: PricedCartLine[] = [];
  for (const line of lines) {
    const { rows: meta } = await pool.query(
      `SELECT si.name AS item_name, sia.alias AS sku, cat.code AS vendor_code,
              LOWER(cat.code) AS vendor_slug
       FROM stock_items si
       JOIN stock_categories cat ON cat.id = si.category_id
       LEFT JOIN LATERAL (
         SELECT alias FROM stock_item_aliases
         WHERE item_id = si.id AND is_primary = true LIMIT 1
       ) sia ON true
       WHERE si.id = $1::uuid`,
      [line.stockItemId]
    );
    if (meta.length === 0) continue;
    const m = meta[0];
    const { on_hand } = await getOnHandAndInventoryRate(
      pool,
      line.stockItemId,
      opts.locationId
    );
    const { unit_rate, price_source } = await resolveLineRate(
      pool,
      line.stockItemId,
      line.quantity,
      priceLevelId,
      opts.locationId
    );
    result.push({
      stockItemId: line.stockItemId,
      quantity: line.quantity,
      item_name: m.item_name as string,
      sku: (m.sku as string | null) ?? '—',
      vendor_code: m.vendor_code as string,
      vendor_slug: m.vendor_slug as string,
      on_hand,
      unit_rate,
      line_total: line.quantity * unit_rate,
      price_source,
    });
  }
  return result;
}

async function nextTxnNumber(client: PoolClient, sessionId: string) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(transaction_number FROM 5) AS INT)), 0) + 1 AS n
     FROM pos_transactions
     WHERE session_id = $1::uuid AND transaction_number ~ '^TXN-[0-9]+$'`,
    [sessionId]
  );
  return `TXN-${String(rows[0].n).padStart(4, '0')}`;
}

export async function createPosTransaction(input: {
  sessionId: string;
  customerId?: string;
  paymentMethod: 'cash' | 'card' | 'account' | 'mixed';
  paymentReference?: string;
  lines: CartLineInput[];
  allowInsufficientStock?: boolean;
  actorId?: string;
}) {
  if (!input.lines.length) {
    return { ok: false as const, error: 'Cart is empty' };
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: sess } = await client.query(
      `SELECT ps.*, pr.location_id, pr.price_level_id, pr.company_id, loc.name AS location_name
       FROM pos_sessions ps
       JOIN pos_registers pr ON pr.id = ps.register_id
       JOIN locations loc ON loc.id = pr.location_id
       WHERE ps.id = $1::uuid AND ps.closed_at IS NULL`,
      [input.sessionId]
    );
    if (sess.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'No open POS session' };
    }
    const session = sess[0];
    const priceLevelId = await effectivePriceLevelId(
      client,
      session.price_level_id as string | null,
      input.customerId
    );

    const pricedLines = await resolveCartLinePrices(input.lines, {
      locationId: session.location_id as string,
      priceLevelId,
      customerId: input.customerId,
    });

    if (pricedLines.length !== input.lines.length) {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'One or more cart lines are invalid' };
    }

    const insufficient: Array<{
      stockItemId: string;
      sku: string;
      requested: number;
      on_hand: number;
    }> = [];
    for (const line of pricedLines) {
      if (line.quantity > line.on_hand) {
        insufficient.push({
          stockItemId: line.stockItemId,
          sku: line.sku,
          requested: line.quantity,
          on_hand: line.on_hand,
        });
      }
    }
    if (insufficient.length > 0 && !input.allowInsufficientStock) {
      await client.query('ROLLBACK');
      return {
        ok: false as const,
        error: 'Insufficient stock for one or more lines',
        insufficientStock: insufficient,
      };
    }

    const txnNumber = await nextTxnNumber(client, input.sessionId);
    let subtotal = 0;
    let lineNo = 1;

    const { rows: txn } = await client.query(
      `INSERT INTO pos_transactions (
         session_id, transaction_number, customer_id, payment_method,
         payment_reference, subtotal, total_amount
       ) VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $6) RETURNING *`,
      [
        input.sessionId,
        txnNumber,
        input.customerId ?? null,
        input.paymentMethod,
        input.paymentReference ?? null,
        0,
      ]
    );

    const inventoryUpdated: Array<{
      stockItemId: string;
      sku: string;
      vendorSlug: string;
      quantitySold: number;
      newQty: number;
    }> = [];

    for (const line of pricedLines) {
      subtotal += line.line_total;
      await client.query(
        `INSERT INTO pos_transaction_lines (
           transaction_id, line_no, stock_item_id, quantity, unit_rate, line_total
         ) VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6)`,
        [
          txn[0].id,
          lineNo++,
          line.stockItemId,
          line.quantity,
          line.unit_rate,
          line.line_total,
        ]
      );

      const snap = await latestSnapshot(client, session.location_id as string);
      if (!snap) continue;

      const { rows: bal } = await client.query(
        `SELECT quantity, rate FROM inventory_balances
         WHERE snapshot_id = $1::uuid AND stock_item_id = $2::uuid`,
        [snap.snapshot_id, line.stockItemId]
      );
      const prevQty = Number(bal[0]?.quantity ?? 0);
      const newQty = Math.max(0, prevQty - line.quantity);
      const rate = line.unit_rate;
      await client.query(
        `INSERT INTO inventory_balances (snapshot_id, stock_item_id, quantity, rate, value)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5)
         ON CONFLICT (snapshot_id, stock_item_id) DO UPDATE SET
           quantity = EXCLUDED.quantity,
           value = EXCLUDED.value`,
        [snap.snapshot_id, line.stockItemId, newQty, rate, newQty * rate]
      );

      await recordStockMovement(client, {
        companyId: session.company_id as string,
        locationId: session.location_id as string,
        stockItemId: line.stockItemId,
        movementType: 'sale',
        quantityDelta: -line.quantity,
        rate,
        valueDelta: -line.line_total,
        referenceType: 'pos_transaction',
        referenceId: txn[0].id as string,
        note: txnNumber,
      });

      inventoryUpdated.push({
        stockItemId: line.stockItemId,
        sku: line.sku,
        vendorSlug: line.vendor_slug,
        quantitySold: line.quantity,
        newQty,
      });
    }

    await client.query(
      `UPDATE pos_transactions SET subtotal = $2, total_amount = $2 WHERE id = $1::uuid`,
      [txn[0].id, subtotal]
    );

    const correlationId = newCorrelationId();
    await recordAuditEvent(client, {
      companyId: session.company_id as string,
      entityType: 'pos_transaction',
      entityId: txn[0].id as string,
      action: 'pos.sale_completed',
      actorId: input.actorId,
      summary: `POS sale ${txnNumber} — ${pricedLines.length} line(s), ${input.paymentMethod}`,
      recordLabel: txnNumber,
      correlationId,
      source: 'api',
      metadata: {
        transactionNumber: txnNumber,
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference ?? null,
        lineCount: pricedLines.length,
        total: subtotal,
        customerId: input.customerId ?? null,
        locationName: session.location_name,
      },
    });

    if (input.paymentReference) {
      await recordAuditEvent(client, {
        companyId: session.company_id as string,
        entityType: 'pos_transaction',
        entityId: txn[0].id as string,
        action: 'payment.mock_completed',
        actorId: input.actorId,
        summary: `Payment ${input.paymentMethod} — ${txnNumber}`,
        recordLabel: txnNumber,
        correlationId,
        source: 'api',
        metadata: {
          targetType: 'pos',
          targetId: txn[0].id as string,
          method: input.paymentMethod,
          paymentReference: input.paymentReference,
          amount: subtotal,
          transactionNumber: txnNumber,
        },
      });
    }

    await client.query('COMMIT');
    return {
      ok: true as const,
      transactionId: txn[0].id as string,
      transactionNumber: txnNumber,
      total: subtotal,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference ?? null,
      locationName: session.location_name as string,
      inventoryUpdated,
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

export type PosTransactionLine = {
  id: string;
  line_no: number;
  stock_item_id: string;
  item_name: string;
  sku: string;
  vendor_slug: string;
  quantity: string;
  unit_rate: string;
  line_total: string;
};

export type PosTransactionDocument = {
  transaction: {
    id: string;
    transaction_number: string;
    customer_id: string | null;
    customer_name: string | null;
    payment_method: string;
    payment_reference: string | null;
    subtotal: string;
    tax_amount: string;
    total_amount: string;
    created_at: Date;
  };
  register: { id: string; name: string };
  location: { id: string; name: string };
  company_id: string;
  lines: PosTransactionLine[];
};

export async function listPosTransactions(opts?: {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
}) {
  const pool = getPool();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(25, opts?.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  let where = 'WHERE 1=1';

  if (opts?.q?.trim()) {
    values.push(`%${opts.q.trim()}%`);
    const i = values.length;
    where += ` AND (pt.transaction_number ILIKE $${i} OR c.name ILIKE $${i})`;
  }
  if (opts?.dateFrom) {
    values.push(opts.dateFrom);
    where += ` AND pt.created_at >= $${values.length}::date`;
  }
  if (opts?.dateTo) {
    values.push(opts.dateTo);
    where += ` AND pt.created_at < ($${values.length}::date + interval '1 day')`;
  }
  if (opts?.customerId) {
    values.push(opts.customerId);
    where += ` AND pt.customer_id = $${values.length}::uuid`;
  }
  values.push(pageSize, offset);

  const { rows } = await pool.query(
    `SELECT
       pt.id,
       pt.transaction_number,
       pt.customer_id,
       c.name AS customer_name,
       pt.payment_method,
       pt.total_amount,
       pt.created_at,
       loc.name AS location_name,
       pr.name AS register_name,
       COUNT(ptl.id)::int AS line_count,
       COUNT(*) OVER()::int AS total_count
     FROM pos_transactions pt
     JOIN pos_sessions ps ON ps.id = pt.session_id
     JOIN pos_registers pr ON pr.id = ps.register_id
     JOIN locations loc ON loc.id = pr.location_id
     LEFT JOIN customers c ON c.id = pt.customer_id
     LEFT JOIN pos_transaction_lines ptl ON ptl.transaction_id = pt.id
     ${where}
     GROUP BY pt.id, c.name, loc.name, pr.name
     ORDER BY pt.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const items = rows.map(({ total_count: _, ...item }) => item);
  return { items, totalCount, page, pageSize };
}

export async function getPosTransactionDocument(
  id: string
): Promise<PosTransactionDocument | null> {
  const pool = getPool();
  const { rows: txns } = await pool.query(
    `SELECT
       pt.*,
       c.name AS customer_name,
       pr.id AS register_id,
       pr.name AS register_name,
       pr.company_id,
       loc.id AS location_id,
       loc.name AS location_name
     FROM pos_transactions pt
     JOIN pos_sessions ps ON ps.id = pt.session_id
     JOIN pos_registers pr ON pr.id = ps.register_id
     JOIN locations loc ON loc.id = pr.location_id
     LEFT JOIN customers c ON c.id = pt.customer_id
     WHERE pt.id = $1::uuid`,
    [id]
  );
  if (txns.length === 0) return null;

  const { rows: lines } = await pool.query(
    `SELECT
       ptl.*,
       si.name AS item_name,
       (
         SELECT sia.alias
         FROM stock_item_aliases sia
         WHERE sia.item_id = si.id
         ORDER BY sia.is_primary DESC NULLS LAST, sia.alias
         LIMIT 1
       ) AS sku,
       LOWER(cat.code) AS vendor_slug
     FROM pos_transaction_lines ptl
     JOIN stock_items si ON si.id = ptl.stock_item_id
     JOIN stock_categories cat ON cat.id = si.category_id
     WHERE ptl.transaction_id = $1::uuid
     ORDER BY ptl.line_no`,
    [id]
  );

  const t = txns[0];
  return {
    transaction: {
      id: t.id as string,
      transaction_number: t.transaction_number as string,
      customer_id: t.customer_id as string | null,
      customer_name: t.customer_name as string | null,
      payment_method: t.payment_method as string,
      payment_reference: (t.payment_reference as string | null) ?? null,
      subtotal: String(t.subtotal),
      tax_amount: String(t.tax_amount),
      total_amount: String(t.total_amount),
      created_at: t.created_at as Date,
    },
    register: { id: t.register_id as string, name: t.register_name as string },
    location: { id: t.location_id as string, name: t.location_name as string },
    company_id: t.company_id as string,
    lines: lines as PosTransactionLine[],
  };
}

export async function getSessionZReport(sessionId: string) {
  const pool = getPool();
  const { rows: session } = await pool.query(
    `SELECT opening_cash, closing_cash, opened_at, closed_at
     FROM pos_sessions WHERE id = $1::uuid`,
    [sessionId]
  );
  const { rows: txns } = await pool.query(
    `SELECT payment_method, COUNT(*)::int AS count, SUM(total_amount)::numeric AS total
     FROM pos_transactions WHERE session_id = $1::uuid
     GROUP BY payment_method`,
    [sessionId]
  );
  const { rows: summary } = await pool.query(
    `SELECT
       COUNT(*)::int AS transaction_count,
       COALESCE(SUM(total_amount), 0)::numeric AS gross_sales
     FROM pos_transactions WHERE session_id = $1::uuid`,
    [sessionId]
  );
  return {
    session: session[0] ?? null,
    byPayment: txns,
    summary: summary[0],
  };
}
