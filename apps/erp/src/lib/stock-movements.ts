import type { PoolClient } from 'pg';
import { getPool } from './db';

export type StockMovementType =
  | 'adjustment'
  | 'import'
  | 'sale'
  | 'purchase_receipt'
  | 'transfer';

export async function recordStockMovement(
  client: PoolClient,
  input: {
    companyId: string;
    locationId: string;
    stockItemId: string;
    movementType: StockMovementType;
    quantityDelta: number;
    rate?: number | null;
    valueDelta?: number | null;
    referenceType?: string;
    referenceId?: string;
    note?: string;
  }
) {
  await client.query(
    `INSERT INTO stock_movements (
       company_id, location_id, stock_item_id, movement_type,
       quantity_delta, rate, value_delta, reference_type, reference_id, note
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.companyId,
      input.locationId,
      input.stockItemId,
      input.movementType,
      input.quantityDelta,
      input.rate ?? null,
      input.valueDelta ?? null,
      input.referenceType ?? null,
      input.referenceId ?? null,
      input.note ?? null,
    ]
  );
}

export async function getStockMovements(
  stockItemId: string,
  locationId?: string,
  limit = 50
) {
  const pool = getPool();
  const values: unknown[] = [stockItemId];
  let locationFilter = '';
  if (locationId) {
    values.push(locationId);
    locationFilter = ` AND sm.location_id = $${values.length}`;
  }
  values.push(limit);

  const { rows } = await pool.query(
    `SELECT
       sm.id,
       sm.movement_type,
       sm.quantity_delta,
       sm.rate,
       sm.value_delta,
       sm.reference_type,
       sm.reference_id,
       sm.note,
       sm.created_at,
       loc.name AS location_name
     FROM stock_movements sm
     JOIN locations loc ON loc.id = sm.location_id
     WHERE sm.stock_item_id = $1${locationFilter}
     ORDER BY sm.created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return rows;
}
