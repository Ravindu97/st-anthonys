'use client';

import { useState } from 'react';
import {
  ImportIssuesReport,
  ImportSuccessSummary,
  type ImportIssue,
} from './ImportIssuesReport';

const VENDORS = [
  { code: 'ORANGE', location: 'ORANGE MAIN LOCATION' },
  { code: 'SWISSTEK', location: 'SWISSTEK' },
] as const;

type ApiError = {
  error?: string;
  code?: string;
  details?: { issues?: ImportIssue[]; summary?: { total?: number; byType?: Record<string, number> } };
};

export function ImportLocationSummaryForm() {
  const [categoryCode, setCategoryCode] = useState('ORANGE');
  const [locationTallyName, setLocationTallyName] = useState('ORANGE MAIN LOCATION');
  const [dryRun, setDryRun] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ dryRun: boolean; data: Record<string, unknown> } | null>(
    null
  );
  const [failure, setFailure] = useState<ApiError | null>(null);

  const onVendorChange = (code: string) => {
    setCategoryCode(code);
    const v = VENDORS.find((x) => x.code === code);
    setLocationTallyName(v?.location ?? `${code} MAIN LOCATION`);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setFailure({ error: 'Choose a CSV file' });
      return;
    }
    setLoading(true);
    setFailure(null);
    setSuccess(null);

    const form = new FormData();
    form.set('file', file);
    form.set('categoryCode', categoryCode);
    form.set('locationTallyName', locationTallyName);
    form.set('dryRun', dryRun ? '1' : '0');

    try {
      const res = await fetch('/api/import/location-summary', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setFailure({
          error:
            res.status === 403
              ? 'Import is restricted to admin users.'
              : (data.error ?? 'Import failed'),
          code: data.code,
          details: data.details ?? data.report,
        });
        return;
      }
      const payload = data.preview ?? data;
      setSuccess({
        dryRun: Boolean(data.dryRun ?? dryRun),
        data: payload,
      });
    } catch (err) {
      setFailure({ error: err instanceof Error ? err.message : 'Request failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Vendor category</span>
          <select
            value={categoryCode}
            onChange={(e) => onVendorChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {VENDORS.map((v) => (
              <option key={v.code} value={v.code}>
                {v.code}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Location (Tally name)</span>
          <input
            type="text"
            value={locationTallyName}
            onChange={(e) => setLocationTallyName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-slate-700">Location Summary CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-slate-600"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={dryRun}
          onChange={(e) => setDryRun(e.target.checked)}
        />
        Dry run (preview only — checks the file without saving)
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600 disabled:opacity-50"
      >
        {loading ? 'Running…' : dryRun ? 'Preview import' : 'Run import'}
      </button>

      {failure && (
        <ImportIssuesReport
          message={failure.error ?? 'Import failed'}
          issues={failure.details?.issues}
          summary={failure.details?.summary}
        />
      )}

      {success && (
        <ImportSuccessSummary
          dryRun={success.dryRun}
          data={success.data as Parameters<typeof ImportSuccessSummary>[0]['data']}
        />
      )}
    </form>
  );
}
