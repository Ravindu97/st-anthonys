import type { PoolClient } from 'pg';
import { getPool } from './db';
import { resolveVendorCode } from './inventory-search';
import { recordStockMovement } from './stock-movements';

const VARIANCE_ABS = 0.01;

export type PatchUnitBalanceInput = {
  quantity?: number | null;
  rate?: number | null;
  value?: number | null;
  note?: string;
  allowVariance?: boolean;
};

export async function patchUnitBalance(
  vendorSlug: string,
  stockItemId: string,
  input: PatchUnitBalanceInput
) {
  const vendor = await resolveVendorCode(vendorSlug);
  if (!vendor) {
    return { ok: false as const, status: 404, error: 'Vendor not found' };
  }

  const hasField =
    input.quantity !== undefined ||
    input.rate !== undefined ||
    input.value !== undefined;
  if (!hasField) {
    return {
      ok: false as const,
      status: 400,
      error: 'Provide at least one of quantity, rate, or value',
    };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: items } = await client.query(
      `SELECT si.id
       FROM stock_items si
       JOIN stock_categories cat ON cat.id = si.category_id
       WHERE si.id = $1::uuid AND cat.code = $2`,
      [stockItemId, vendor.code]
    );
    if (items.length === 0) {
      await client.query('ROLLBACK');
      return {
        ok: false as const,
        status: 404,
        error: 'Stock item not found for this vendor',
      };
    }

    const snap = await latestSnapshot(client, vendor.code);
    if (!snap) {
      await client.query('ROLLBACK');
      return {
        ok: false as const,
        status: 404,
        error: 'No inventory snapshot for this vendor. Import a Location Summary first.',
      };
    }

    const { snapshotId, locationId, companyId } = snap;

    const { rows: balRows } = await client.query(
      `SELECT quantity, rate, value FROM inventory_balances
       WHERE snapshot_id = $1 AND stock_item_id = $2`,
      [snapshotId, stockItemId]
    );

    const prev = balRows[0] ?? { quantity: null, rate: null, value: null };
    const quantity =
      input.quantity !== undefined ? input.quantity : prev.quantity;
    const rate = input.rate !== undefined ? input.rate : prev.rate;
    const value = input.value !== undefined ? input.value : prev.value;

    const q = quantity != null ? Number(quantity) : null;
    const r = rate != null ? Number(rate) : null;
    const v = value != null ? Number(value) : null;

    if (q != null && r != null && v != null && !input.allowVariance) {
      const computed = q * r;
      if (Math.abs(v - computed) > VARIANCE_ABS) {
        await client.query('ROLLBACK');
        return {
          ok: false as const,
          status: 422,
          error: `Value ${v} does not match quantity × rate (${computed}). Pass allowVariance to override.`,
        };
      }
    }

    await client.query(
      `INSERT INTO inventory_balances (snapshot_id, stock_item_id, quantity, rate, value)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (snapshot_id, stock_item_id) DO UPDATE SET
         quantity = EXCLUDED.quantity,
         rate = EXCLUDED.rate,
         value = EXCLUDED.value`,
      [snapshotId, stockItemId, quantity, rate, value]
    );

    await client.query(
      `INSERT INTO item_location_stats (
         stock_item_id, location_id, last_snapshot_id, last_qty, last_rate, last_value, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (stock_item_id, location_id) DO UPDATE SET
         last_snapshot_id = EXCLUDED.last_snapshot_id,
         last_qty = EXCLUDED.last_qty,
         last_rate = EXCLUDED.last_rate,
         last_value = EXCLUDED.last_value,
         updated_at = now()`,
      [stockItemId, locationId, snapshotId, quantity, rate, value]
    );

    const { rows: adj } = await client.query(
      `INSERT INTO inventory_adjustments (
         company_id, location_id, snapshot_id, stock_item_id,
         quantity, rate, value, previous_quantity, previous_rate, previous_value, note
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, created_at`,
      [
        companyId,
        locationId,
        snapshotId,
        stockItemId,
        quantity,
        rate,
        value,
        prev.quantity,
        prev.rate,
        prev.value,
        input.note ?? null,
      ]
    );

    const prevQty = prev.quantity != null ? Number(prev.quantity) : 0;
    const newQty = quantity != null ? Number(quantity) : 0;
    const qtyDelta = newQty - prevQty;
    if (qtyDelta !== 0) {
      await recordStockMovement(client, {
        companyId,
        locationId,
        stockItemId,
        movementType: 'adjustment',
        quantityDelta: qtyDelta,
        rate: rate != null ? Number(rate) : null,
        valueDelta:
          value != null && prev.value != null
            ? Number(value) - Number(prev.value)
            : null,
        referenceType: 'inventory_adjustment',
        referenceId: adj[0].id as string,
        note: input.note ?? 'Manual balance adjustment',
      });
    }

    await client.query('COMMIT');

    return {
      ok: true as const,
      adjustmentId: adj[0].id as string,
      snapshotId,
      quantity,
      rate,
      value,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function latestSnapshot(client: PoolClient, categoryCode: string) {
  const { rows } = await client.query(
    `
    SELECT inv.id AS snapshot_id, inv.location_id, loc.company_id
    FROM inventory_snapshots inv
    JOIN locations loc ON loc.id = inv.location_id
    JOIN stock_categories cat ON cat.id = loc.stock_category_id
    WHERE cat.code = $1
    ORDER BY inv.created_at DESC
    LIMIT 1
    `,
    [categoryCode]
  );
  if (rows.length === 0) return null;
  return {
    snapshotId: rows[0].snapshot_id as string,
    locationId: rows[0].location_id as string,
    companyId: rows[0].company_id as string,
  };
}
