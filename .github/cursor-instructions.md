# Cursor agent instructions (St. Anthony's)

Project-specific guidance for AI assistants working in this repo.

## Primary rule source

Always follow rules in [`.cursor/rules/`](../.cursor/rules/), especially:

- **`verify-before-done.mdc`** — Test new functionality before marking work complete.
- **`plan-mode-research.mdc`** — Research best practices before proposing new features.

## Plan mode (new features)

Before proposing a **new feature** in Plan mode:

1. Do brief market/domain research (2–3 authoritative sources).
2. Document in the plan: industry practice → **applicable now** vs **deferred**.
3. Keep Phase 1 scoped to this codebase (desktop-first, Tally snapshots, distributor workflows).

## Verification checklist

**Do not say work is done until you have run the checks below yourself** (not only described them).

### 1. Static checks

- `cd apps/erp && npx tsc --noEmit` when TypeScript changed.
- Fix new linter errors in files you edited.
- `npm run build` in `apps/erp` for route/UI changes (catches server/client boundary issues).

### 2. Database

- `npm run db:migrate` from the repo root when SQL migrations were added.
- Cast UUID query parameters as `$n::uuid` when comparing to UUID columns (see `apps/erp/src/lib/purchasing.ts`, `audit.ts`).

### 3. Interactive UI testing (required for features with links, forms, or navigation)

Loading a page once is not enough. Exercise the full user path:

| Area | Minimum manual or scripted checks |
|------|-----------------------------------|
| Audit log | Open `/admin/audit`, toggle workflows/events, apply a filter, click **Open record** on a workflow, confirm the target page loads (e.g. PO detail with activity panel). |
| Purchasing / GRN | Create PO from reorder → **Receive goods** (partial then complete) → confirm PO status, `/purchasing/receipts` list, GRN print, inventory unit ledger shows `GRN GRN-xxxxx`. |
| Purchasing list | **Awaiting receipt** filter, receipt progress column, `#receive` anchor on partial POs. |
| Reorder | Search, paginate, create PO from selection, success modal with receive CTA, history tab PO/receipt badge. |
| POS counter | Open session → search SKU → attach customer → reprice cart → **mock payment gateway** (card tap / cash tender / account charge) → complete sale → insufficient-stock confirm → View sale / Print receipt → Z-report → close session. |
| Sales hub (`/orders`) | **Counter (POS)** tab lists TXN rows → print receipt; **Quotes** → create/print; SO workflow: confirm → pick → **mock payment on collect** (cash/card/account) → collected; search/date filters. |
| Customers | `/customers` search by name/code/phone → **Add customer** (auto `CUST-#####` code) → detail shows address, terms, sales summary, recent SO/TXN links → **Edit customer**; POS picker shows price tier + office link when no match (no cashier create). |

If auth blocks automated checks, run the query/API path directly (e.g. call the lib function against the dev DB) and tell the user what to click to confirm in the browser.

### 4. Next.js server vs client

- **Never** import `@/lib/db`, `@/lib/audit` (server), or `pg` from `'use client'` components.
- Put shared types, constants, and pure helpers in `*-shared.ts` modules with no Node/database imports.
- Do not export utility functions from client component files if server pages need them.

## ERP conventions

- Server-only data access: `apps/erp/src/lib/*.ts` using `getPool()`.
- Client-safe shared code: `*-shared.ts` modules with no Node/database imports.
- Admin routes: `/admin/*` and `/api/admin/*` are admin-only (see `middleware.ts`).
- GRN posts to latest `inventory_snapshots` balance + `stock_movements` (`purchase_receipt`); strict block on over-receipt.
- POS uses `resolveItemPrice` per register/customer price level; sales post `stock_movements` (`sale`); `/pos` requires `pos:read`.

## Reporting completion

In your final message, include a short **What I tested** section listing commands run and URLs or flows exercised. If something could not be tested, say what the user should verify.
