'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ReorderPagination } from './ReorderPagination';
import { ReorderSearchBar } from './ReorderSearchBar';

type Rule = {
  id: string;
  primary_sku?: string;
  item_name?: string;
  category_name?: string;
  location_name?: string;
  min_qty: string;
  reorder_qty: string;
  lead_time_days: number;
};

type CategoryDefault = {
  id: string;
  category_id: string;
  category_code: string;
  category_name: string;
  location_type: string;
  default_min_qty: string;
  default_reorder_qty: string;
};

export function ReorderRulesPanel({
  rules,
  defaults,
  totalCount = 0,
  page = 1,
  pageSize = 50,
  q,
  vendor,
}: {
  rules: Rule[];
  defaults: CategoryDefault[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  q?: string;
  vendor?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saveDefault(def: CategoryDefault, minQty: number, reorderQty: number) {
    setLoading(true);
    try {
      const res = await fetch('/api/reorder/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category_default',
          categoryId: def.category_id,
          locationType: def.location_type,
          defaultMinQty: minQty,
          defaultReorderQty: reorderQty,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setMessage('Category default saved');
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  async function importCsv(file: File) {
    setLoading(true);
    setMessage(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/reorder/rules/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      setMessage(`Imported ${data.imported} rules`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <ReorderSearchBar tab="rules" q={q} vendor={vendor} />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Category defaults</h3>
        <p className="mt-1 text-xs text-slate-500">
          Applied when no per-SKU rule exists (main locations only)
        </p>
        <div className="mt-4 space-y-3">
          {defaults.map((d) => (
            <CategoryDefaultRow
              key={d.id}
              def={d}
              disabled={loading}
              onSave={saveDefault}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Per-SKU rules</h3>
            <p className="text-xs text-slate-500">
              {totalCount.toLocaleString()} active rules
              {q ? ` matching “${q}”` : ''}
            </p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importCsv(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Import CSV
            </button>
          </div>
        </div>
        {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
        <p className="mt-2 text-xs text-slate-400">
          CSV columns: sku, category_code, min_qty, reorder_qty, lead_time_days
        </p>
        {rules.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4 text-right">Min</th>
                  <th className="py-2 text-right">Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4 font-mono text-xs">{r.primary_sku ?? '—'}</td>
                    <td className="py-2 pr-4">{r.item_name}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.category_name}</td>
                    <td className="py-2 pr-4 text-right font-mono">{r.min_qty}</td>
                    <td className="py-2 text-right font-mono">{r.reorder_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {totalCount > 0 && (
        <ReorderPagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          tab="rules"
          q={q}
          vendor={vendor}
        />
      )}
    </div>
  );
}

function CategoryDefaultRow({
  def,
  disabled,
  onSave,
}: {
  def: CategoryDefault;
  disabled: boolean;
  onSave: (d: CategoryDefault, min: number, reorder: number) => void;
}) {
  const [minQty, setMinQty] = useState(def.default_min_qty);
  const [reorderQty, setReorderQty] = useState(def.default_reorder_qty);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="min-w-24 font-medium text-slate-800">{def.category_name}</span>
      <label className="text-xs text-slate-500">
        Min
        <input
          type="number"
          min={0}
          value={minQty}
          onChange={(e) => setMinQty(e.target.value)}
          className="ml-1 w-16 rounded border border-slate-200 px-2 py-1 font-mono text-sm"
        />
      </label>
      <label className="text-xs text-slate-500">
        Reorder
        <input
          type="number"
          min={1}
          value={reorderQty}
          onChange={(e) => setReorderQty(e.target.value)}
          className="ml-1 w-16 rounded border border-slate-200 px-2 py-1 font-mono text-sm"
        />
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSave(def, Number(minQty), Number(reorderQty))}
        className="rounded border border-brand-blue-200 px-2 py-1 text-xs text-brand-blue-700 hover:bg-brand-blue-50 disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
