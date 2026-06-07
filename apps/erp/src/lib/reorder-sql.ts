/** Shared SQL for per-item reorder thresholds (falls back to 10 when no rule). */

export const DEFAULT_REORDER_MIN = 10;

/** Use with v_location_summary aliased as `v`. */
export const REORDER_MIN_QTY_SQL = `COALESCE(
  (SELECT rr.min_qty FROM reorder_rules rr
   WHERE rr.stock_item_id = v.stock_item_id
     AND rr.location_id = v.location_id
     AND rr.is_active = true),
  ${DEFAULT_REORDER_MIN}
)`;

export const LOW_STOCK_LINE_SQL = `(
  COALESCE(v.quantity, 0) > 0
  AND COALESCE(v.quantity, 0) < (${REORDER_MIN_QTY_SQL})
)`;

export const AT_RISK_LINE_SQL = `(
  COALESCE(v.quantity, 0) <= 0
  OR ${LOW_STOCK_LINE_SQL}
)`;

/** Use with inventory_balances `ib` joined to snapshot `inv`. */
export const IB_REORDER_MIN_SQL = `COALESCE(rr.min_qty, ${DEFAULT_REORDER_MIN})`;

export const IB_LOW_STOCK_FILTER = `(
  COALESCE(ib.quantity, 0) > 0
  AND COALESCE(ib.quantity, 0) < ${IB_REORDER_MIN_SQL}
)`;

export const IB_AT_RISK_FILTER = `(
  COALESCE(ib.quantity, 0) <= 0 OR ${IB_LOW_STOCK_FILTER}
)`;
