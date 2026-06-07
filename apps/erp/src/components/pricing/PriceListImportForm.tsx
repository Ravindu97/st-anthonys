'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PriceListImportForm({ levels }: { levels: string[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [priceLevel, setPriceLevel] = useState(levels[0] ?? 'Retail');
  const [categoryCode, setCategoryCode] = useState('ORANGE');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    const form = new FormData();
    form.append('file', file);
    form.append('priceLevel', priceLevel);
    form.append('categoryCode', categoryCode);
    try {
      const res = await fetch('/api/import/price-list', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      setResult(`Imported ${data.imported} tiers${data.errors?.length ? `, ${data.errors.length} errors` : ''}`);
      router.refresh();
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-slate-900">Import price list CSV</h2>
      <div className="flex flex-wrap gap-3">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <select
          value={priceLevel}
          onChange={(e) => setPriceLevel(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        >
          {levels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          value={categoryCode}
          onChange={(e) => setCategoryCode(e.target.value)}
          placeholder="Category code"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono w-36"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-lg bg-brand-blue-500 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Importing…' : 'Import'}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        CSV columns: sku, rate, from_qty (optional), discount_pct (optional)
      </p>
      {result && <p className="text-sm text-slate-600">{result}</p>}
    </form>
  );
}
