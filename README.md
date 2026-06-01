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
- `apps/erp/` — Next.js dashboard (brand UI from `reference/design.md`)

## Schema

- `v_group_balances` — stock group rollups per snapshot
- `v_location_summary` — leaf rows for UI / API
