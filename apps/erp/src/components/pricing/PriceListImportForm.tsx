'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ImportError = { line: number; sku?: string; error: string };

type ImportResult = {
  imported: number;
  errors: ImportError[];
  dryRun: boolean;
  priceListId: string | null;
};

export function PriceListImportForm({ levels }: { levels: string[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [priceLevel, setPriceLevel] = useState(levels[0] ?? 'Retail');
  const [categoryCode, setCategoryCode] = useState('ORANGE');
  const [applicableFrom, setApplicableFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  async function runImport(dryRun: boolean) {
    if (!file) return;
    setLoading(true);
    setError(null);
    if (dryRun) setPreview(null);
    else setResult(null);

    const form = new FormData();
    form.append('file', file);
    form.append('priceLevel', priceLevel);
    form.append('categoryCode', categoryCode);
    form.append('applicableFrom', applicableFrom);
    form.append('dryRun', dryRun ? 'true' : 'false');

    try {
      const res = await fetch('/api/import/price-list', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      if (dryRun) {
        setPreview(data as ImportResult);
        setShowErrors((data.errors?.length ?? 0) > 0);
      } else {
        setResult(data as ImportResult);
        setPreview(null);
        setShowErrors((data.errors?.length ?? 0) > 0);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  const errors = (result ?? preview)?.errors ?? [];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        runImport(false);
      }}
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
    >
      <h2 className="text-sm font-semibold text-slate-900">Import price list CSV</h2>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-medium text-slate-500">CSV file</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
            }}
            className="mt-1 block text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Price level</label>
          <select
            value={priceLevel}
            onChange={(e) => setPriceLevel(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          >
            {levels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Category code</label>
          <input
            value={categoryCode}
            onChange={(e) => setCategoryCode(e.target.value)}
            placeholder="ORANGE"
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono w-36"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Effective from</label>
          <input
            type="date"
            value={applicableFrom}
            onChange={(e) => setApplicableFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        CSV columns: <span className="font-mono">sku</span>,{' '}
        <span className="font-mono">rate</span>, optional{' '}
        <span className="font-mono">from_qty</span> and{' '}
        <span className="font-mono">discount_pct</span>. Category code scopes items (usually ORANGE).
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!file || loading}
          onClick={() => runImport(true)}
          className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Working…' : 'Preview import'}
        </button>
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-lg bg-brand-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Importing…' : 'Import'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {preview && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <strong>Preview:</strong> {preview.imported} tiers would import
          {preview.errors.length > 0 && `, ${preview.errors.length} errors`}.
          No changes saved.
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Imported {result.imported} tiers
          {result.errors.length > 0 && ` (${result.errors.length} rows skipped)`}.
          {result.priceListId && (
            <>
              {' '}
              <Link
                href={`/pricing/${result.priceListId}`}
                className="font-medium underline"
              >
                View price list
              </Link>
            </>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowErrors((v) => !v)}
            className="text-sm text-brand-blue-600 hover:underline"
          >
            {showErrors ? 'Hide' : 'Show'} import errors ({errors.length})
          </button>
          {showErrors && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-1">Line</th>
                    <th className="px-3 py-1">SKU</th>
                    <th className="px-3 py-1">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {errors.map((err, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1 font-mono">{err.line}</td>
                      <td className="px-3 py-1 font-mono">{err.sku ?? '—'}</td>
                      <td className="px-3 py-1">{err.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
