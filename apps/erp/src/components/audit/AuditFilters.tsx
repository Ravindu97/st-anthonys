import Link from 'next/link';
import { AUDIT_PRESETS, type AuditPreset } from '@/lib/audit-shared';

type User = { id: string; email: string };

export function AuditFilters({
  users,
  params,
}: {
  users: User[];
  params: Record<string, string | undefined>;
}) {
  const view = params.view ?? 'workflows';

  function url(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) next.set(k, v);
    }
    return `/admin/audit?${next.toString()}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {AUDIT_PRESETS.map((p) => (
          <Link
            key={p.id}
            href={url({ preset: params.preset === p.id ? undefined : p.id, page: '1' })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              params.preset === p.id
                ? 'bg-brand-blue-500 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <input type="hidden" name="view" value={view} />
        {params.preset && <input type="hidden" name="preset" value={params.preset} />}

        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          Search
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="PO number, SKU, summary…"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-slate-600">
          User
          <select
            name="userId"
            defaultValue={params.userId ?? ''}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Entity
          <select
            name="entityType"
            defaultValue={params.entityType ?? ''}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All entities</option>
            <option value="purchase_order">Purchase orders</option>
            <option value="purchase_suggestion">Reorder suggestions</option>
            <option value="goods_receipt">Goods receipts</option>
            <option value="import_run">Imports</option>
            <option value="inventory_adjustment">Adjustments</option>
            <option value="reorder_scan">Reorder scans</option>
            <option value="pos_transaction">POS sales</option>
            <option value="pos_session">POS sessions</option>
            <option value="reorder_rule">Reorder rules</option>
            <option value="customer">Customers</option>
            <option value="sales_document">Sales documents</option>
            <option value="price_list">Price lists</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          From
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ''}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          To
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ''}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600"
        >
          Filter
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <Link
            href={url({ view: 'workflows', page: '1' })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              view === 'workflows'
                ? 'bg-brand-blue-500 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Workflows
          </Link>
          <Link
            href={url({ view: 'events', page: '1' })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              view === 'events'
                ? 'bg-brand-blue-500 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            All events
          </Link>
        </div>
      </div>
    </div>
  );
}

