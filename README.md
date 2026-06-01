# St. Anthony's Smart Solutions ERP

PostgreSQL inventory (Tally Prime GOLD sync) plus a Next.js operations dashboard.

## Quick start

```bash
npm install
npm run db:up          # Postgres on localhost:5433
npm run db:setup
npm run import:location-summary
npm run import:swisstek
npm run validate:orange
npm run validate:swisstek

cp apps/erp/.env.local.example apps/erp/.env.local
npm run dev:erp        # http://localhost:3000
```

## Vendors imported

| Category | Location | Command |
|----------|----------|---------|
| ORANGE | ORANGE MAIN LOCATION | `npm run import:location-summary` |
| SWISSTEK | SWISSTEK | `npm run import:swisstek` |

Add more vendors (same Tally Location Summary layout):

```bash
node scripts/diff-import-structure.js ./reference/your-vendor.csv
node scripts/import-location-summary.js "./reference/your-vendor.csv" WATERTEC "WATERTEC MAIN LOCATION"
```

## Project layout

- `db/migrations/` — PostgreSQL schema, seeds, views
- `scripts/` — CSV import & validation
- `apps/erp/` — Next.js dashboard (brand UI spec lives in local `reference/`)

## Local reference data (not in Git)

The `reference/` folder holds Tally exports, screenshots, and design notes. It is listed in `.gitignore` and is **not pushed to GitHub**. Keep your own copy locally for imports:

```bash
npm run import:location-summary   # default: reference/orange product list 3.csv
npm run import:swisstek             # reference/swisstek items list.csv
```

## Schema

- `v_group_balances` — stock group rollups per snapshot
- `v_location_summary` — leaf rows for UI / API

## Stock item identity and imports

Each product has an internal **`stock_item_id`** (PostgreSQL UUID from `gen_random_uuid()`). It is assigned **once** when the product is first created during import and stays the same across re-imports. It is not derived from the unit code or Tally name.

**Matching on CSV import** (in order):

1. Company-wide **unit code** (`stock_item_aliases.alias`, e.g. `212-4017`)
2. **Tally name** per vendor category (`stock_items.tally_name`)
3. **Insert** new item → new UUID

Use `stock_item_id` in URLs and APIs. Use unit code / Tally name only to match rows during import.

**Guards** (shared CLI and ERP):

- Alias vs Tally mismatch → import aborts (no silent reassignment of SKUs)
- Footer total vs sum of leaf values → import blocked with a detailed report
- Unit code / Tally name conflicts → listed per CSV line (no silent fixes)
- **Dry run** → full preview, then rollback (no DB changes)

```bash
# Preview
npm run import:location-summary -- --dry-run ./reference/orange\ product\ list\ 3.csv ORANGE

# Commit when preview passes
npm run import:location-summary -- ./reference/orange\ product\ list\ 3.csv ORANGE
```

**ERP:** Dashboard → **Import**, or `POST /api/import/location-summary` (multipart CSV). Optional `IMPORT_API_KEY` in `apps/erp/.env.local` sends `x-import-api-key` on import/adjustment routes.

**Single-unit balance update** (latest vendor snapshot only; does not create new items):

```http
PATCH /api/inventory/{vendor}/units/{stockItemId}
Content-Type: application/json

{ "quantity": 100, "rate": 4181.32, "value": 418132, "note": "manual correction" }
```

Adjustments are recorded in `inventory_adjustments`.
