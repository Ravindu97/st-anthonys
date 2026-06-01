import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { ImportLocationSummaryForm } from '@/components/import/ImportLocationSummaryForm';
import { getSessionFromCookies, isAdminRole } from '@/lib/auth';
import { listImportRuns } from '@/lib/import-runs';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const session = await getSessionFromCookies();
  if (!session || !isAdminRole(session.role)) {
    redirect('/inventory?error=forbidden');
  }
  let runs: Awaited<ReturnType<typeof listImportRuns>> = [];
  try {
    runs = await listImportRuns(10);
  } catch {
    runs = [];
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Inventory hub', href: '/inventory' },
          { label: 'Import' },
        ]}
      />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
          Import Location Summary
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Upload a Tally Location Summary CSV. Items are matched by unit code (alias) then
          Tally name; new products receive a stable{' '}
          <span className="font-mono text-xs">stock_item_id</span> (UUID). Always use{' '}
          <strong>Preview</strong> first; if anything is wrong you will get a detailed
          report (conflicts, footer mismatch, duplicate rows) and nothing is saved.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <ImportLocationSummaryForm />
      </section>

      {runs.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Recent import runs
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {runs.map((run) => {
              const counts = run.row_counts as Record<string, unknown> | null;
              const validationOk = counts?.validation_ok;
              return (
                <li key={run.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      run.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-800'
                        : run.status === 'failed'
                          ? 'bg-red-50 text-red-800'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {run.status}
                  </span>
                  <span className="font-medium text-slate-800">
                    {run.file_name ?? 'import'}
                  </span>
                  <span className="text-slate-500">
                    {new Date(run.imported_at).toLocaleString('en-GB')}
                  </span>
                  {validationOk === false && (
                    <span className="text-xs text-brand-gold-700">validation mismatch</span>
                  )}
                  {run.error_summary && (
                    <span className="text-xs text-red-600">{run.error_summary}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            API: <code className="font-mono">GET /api/import/runs</code> ·{' '}
            <code className="font-mono">POST /api/import/location-summary</code>
          </p>
        </section>
      )}

      <p className="text-sm text-slate-500">
        CLI equivalent:{' '}
        <code className="rounded bg-slate-100 px-1 font-mono text-xs">
          npm run import:location-summary -- [--dry-run] [--force] file.csv ORANGE
        </code>
        . See{' '}
        <Link href="/inventory" className="text-brand-blue-600 hover:underline">
          Inventory hub
        </Link>{' '}
        after a successful import.
      </p>
    </div>
  );
}
