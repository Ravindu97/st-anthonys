import type { PoolClient } from 'pg';
import { getPool } from './db';
import { resolveItemPrice } from './pricing';
import { recordStockMovement } from './stock-movements';

export type PosRegister = {
  id: string;
  name: string;
  location_name: string;
  price_level_name: string | null;
  is_active: boolean;
};

export async function listRegisters(companyId?: string) {
  const pool = getPool();
  const filter = companyId ? 'WHERE pr.company_id = $1' : '';
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
    `SELECT id FROM pos_sessions WHERE register_id = $1 AND closed_at IS NULL`,
    [input.registerId]
  );
  if (existing.length > 0) {
    return { ok: false as const, error: 'Register already has an open session' };
  }

  const { rows } = await pool.query(
    `INSERT INTO pos_sessions (register_id, opened_by, opening_cash)
     VALUES ($1, $2, $3) RETURNING *`,
    [input.registerId, input.openedBy, input.openingCash ?? 0]
  );
  return { ok: true as const, session: rows[0] };
}

export async function closePosSession(sessionId: string, closingCash: number) {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE pos_sessions SET closed_at = now(), closing_cash = $2
     WHERE id = $1 AND closed_at IS NULL RETURNING *`,
    [sessionId, closingCash]
  );
  return rows[0] ?? null;
}

export async function getOpenSession(registerId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ps.*, pr.name AS register_name, pr.location_id, pr.price_level_id
     FROM pos_sessions ps
     JOIN pos_registers pr ON pr.id = ps.register_id
     WHERE ps.register_id = $1 AND ps.closed_at IS NULL
     ORDER BY ps.opened_at DESC LIMIT 1`,
    [registerId]
  );
  return rows[0] ?? null;
}

export async function lookupSku(sku: string, locationId?: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       si.id AS stock_item_id,
       si.name AS item_name,
       sia.alias AS sku,
       u.code AS unit_code,
       cat.code AS vendor_code,
       ib.quantity,
       ib.rate
     FROM stock_item_aliases sia
     JOIN stock_items si ON si.id = sia.item_id
     JOIN units u ON u.id = si.base_unit_id
     JOIN stock_categories cat ON cat.id = si.category_id
     LEFT JOIN LATERAL (
       SELECT ib.quantity, ib.rate
       FROM inventory_balances ib
       JOIN inventory_snapshots inv ON inv.id = ib.snapshot_id
       WHERE ib.stock_item_id = si.id
         AND ($2::uuid IS NULL OR inv.location_id = $2)
       ORDER BY inv.created_at DESC LIMIT 1
     ) ib ON true
     WHERE sia.alias ILIKE $1 OR si.name ILIKE $1
     LIMIT 20`,
    [sku.trim(), locationId ?? null]
  );
  return rows;
}

async function nextTxnNumber(client: PoolClient, sessionId: string) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int + 1 AS n FROM pos_transactions WHERE session_id = $1`,
    [sessionId]
  );
  return `TXN-${String(rows[0].n).padStart(4, '0')}`;
}

export async function createPosTransaction(input: {
  sessionId: string;
  customerId?: string;
  paymentMethod: 'cash' | 'card' | 'account' | 'mixed';
  lines: Array<{ stockItemId: string; quantity: number; unitRate?: number }>;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: sess } = await client.query(
      `SELECT ps.*, pr.location_id, pr.price_level_id, pr.company_id
       FROM pos_sessions ps
       JOIN pos_registers pr ON pr.id = ps.register_id
       WHERE ps.id = $1 AND ps.closed_at IS NULL`,
      [input.sessionId]
    );
    if (sess.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false as const, error: 'No open POS session' };
    }
    const session = sess[0];

    let priceLevelId = session.price_level_id;
    if (input.customerId) {
      const { rows: cust } = await client.query(
        'SELECT price_level_id FROM customers WHERE id = $1',
        [input.customerId]
      );
      if (cust[0]?.price_level_id) priceLevelId = cust[0].price_level_id;
    }

    const txnNumber = await nextTxnNumber(client, input.sessionId);
    let subtotal = 0;
    let lineNo = 1;
    const lineRows: Array<{
      stockItemId: string;
      quantity: number;
      rate: number;
      total: number;
    }> = [];

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
      const { rows: bal } = await client.query(
        `SELECT ib.rate FROM inventory_balances ib
         JOIN inventory_snapshots inv ON inv.id = ib.snapshot_id
         WHERE ib.stock_item_id = $1 AND inv.location_id = $2
         ORDER BY inv.created_at DESC LIMIT 1`,
        [line.stockItemId, session.location_id]
      );
      rate = rate ?? Number(bal[0]?.rate ?? 0);
      const lineTotal = line.quantity * rate;
      subtotal += lineTotal;
      lineRows.push({
        stockItemId: line.stockItemId,
        quantity: line.quantity,
        rate,
        total: lineTotal,
      });
    }

    const { rows: txn } = await client.query(
      `INSERT INTO pos_transactions (
         session_id, transaction_number, customer_id, payment_method,
         subtotal, total_amount
       ) VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
      [
        input.sessionId,
        txnNumber,
        input.customerId ?? null,
        input.paymentMethod,
        subtotal,
      ]
    );

    for (const line of lineRows) {
      await client.query(
        `INSERT INTO pos_transaction_lines (
           transaction_id, line_no, stock_item_id, quantity, unit_rate, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          txn[0].id,
          lineNo++,
          line.stockItemId,
          line.quantity,
          line.rate,
          line.total,
        ]
      );

      const snap = await latestSnapshot(client, session.location_id);
      if (!snap) continue;

      const { rows: bal } = await client.query(
        `SELECT quantity, rate FROM inventory_balances
         WHERE snapshot_id = $1 AND stock_item_id = $2`,
        [snap.snapshot_id, line.stockItemId]
      );
      const prevQty = Number(bal[0]?.quantity ?? 0);
      const newQty = Math.max(0, prevQty - line.quantity);
      const rate = line.rate;
      await client.query(
        `INSERT INTO inventory_balances (snapshot_id, stock_item_id, quantity, rate, value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (snapshot_id, stock_item_id) DO UPDATE SET
           quantity = EXCLUDED.quantity,
           value = EXCLUDED.value`,
        [snap.snapshot_id, line.stockItemId, newQty, rate, newQty * rate]
      );

      await recordStockMovement(client, {
        companyId: session.company_id,
        locationId: session.location_id,
        stockItemId: line.stockItemId,
        movementType: 'sale',
        quantityDelta: -line.quantity,
        rate,
        valueDelta: -line.total,
        referenceType: 'pos_transaction',
        referenceId: txn[0].id,
        note: txnNumber,
      });
    }

    await client.query('COMMIT');
    return {
      ok: true as const,
      transactionId: txn[0].id as string,
      transactionNumber: txnNumber,
      total: subtotal,
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
     WHERE location_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [locationId]
  );
  return rows[0] as { snapshot_id: string } | undefined;
}

export async function getSessionZReport(sessionId: string) {
  const pool = getPool();
  const { rows: txns } = await pool.query(
    `SELECT payment_method, COUNT(*)::int AS count, SUM(total_amount) AS total
     FROM pos_transactions WHERE session_id = $1
     GROUP BY payment_method`,
    [sessionId]
  );
  const { rows: summary } = await pool.query(
    `SELECT
       COUNT(*)::int AS transaction_count,
       COALESCE(SUM(total_amount), 0) AS gross_sales
     FROM pos_transactions WHERE session_id = $1`,
    [sessionId]
  );
  return { byPayment: txns, summary: summary[0] };
}
