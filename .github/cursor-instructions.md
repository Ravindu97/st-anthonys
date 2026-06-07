# Cursor agent instructions (St. Anthony's)

Project-specific guidance for AI assistants working in this repo.

## Primary rule source

Always follow rules in [`.cursor/rules/`](../.cursor/rules/), especially:

- **`verify-before-done.mdc`** — Test new functionality before marking work complete.

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
| Purchasing | Open a PO from the list and from an audit deep link; confirm attribution and admin activity panel render. |
| Reorder | Search, paginate, create PO from selection, open print view. |

If auth blocks automated checks, run the query/API path directly (e.g. call the lib function against the dev DB) and tell the user what to click to confirm in the browser.

### 4. Next.js server vs client

- **Never** import `@/lib/db`, `@/lib/audit` (server), or `pg` from `'use client'` components.
- Put shared types, constants, and pure helpers in `*-shared.ts` modules with no Node/database imports.
- Do not export utility functions from client component files if server pages need them.

## ERP conventions

- Server-only data access: `apps/erp/src/lib/*.ts` using `getPool()`.
- Client-safe shared code: `*-shared.ts` modules with no Node/database imports.
- Admin routes: `/admin/*` and `/api/admin/*` are admin-only (see `middleware.ts`).

## Reporting completion

In your final message, include a short **What I tested** section listing commands run and URLs or flows exercised. If something could not be tested, say what the user should verify.
