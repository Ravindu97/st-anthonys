export type ImportIssue = {
  type: string;
  lineNo?: number;
  message: string;
  alias?: string;
  tallyName?: string;
  particulars?: string;
  footer_value?: number;
  computed_total_value?: number;
  diff?: number;
};

const TYPE_LABELS: Record<string, string> = {
  footer_mismatch: 'Footer total mismatch',
  identity_conflict: 'Unit code vs product mismatch',
  alias_in_use: 'Unit code already in use',
  duplicate_line: 'Duplicate row',
  empty_row: 'Empty product row',
  missing_group: 'Missing stock group',
  missing_period: 'Missing report period',
};

export function ImportIssuesReport({
  title,
  message,
  issues = [],
  summary,
}: {
  title?: string;
  message: string;
  issues?: ImportIssue[];
  summary?: { total?: number; byType?: Record<string, number> };
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5">
      <h3 className="font-display text-base font-semibold text-red-900">
        {title ?? 'Import blocked'}
      </h3>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      {summary?.total != null && (
        <p className="mt-2 text-xs text-red-700">
          {summary.total} issue{summary.total === 1 ? '' : 's'} found. No data was saved.
        </p>
      )}
      {issues.length > 0 && (
        <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto">
          {issues.map((issue, i) => (
            <li
              key={`${issue.type}-${issue.lineNo ?? i}`}
              className="rounded-lg border border-red-100 bg-white/80 px-3 py-2 text-sm"
            >
              <p className="font-medium text-red-900">
                {TYPE_LABELS[issue.type] ?? issue.type}
                {issue.lineNo != null && (
                  <span className="ml-2 font-mono text-xs font-normal text-red-600">
                    CSV line {issue.lineNo}
                  </span>
                )}
              </p>
              <p className="mt-1 text-red-800">{issue.message}</p>
              {issue.particulars && (
                <p className="mt-1 truncate font-mono text-xs text-slate-600">
                  {issue.particulars}
                </p>
              )}
              {issue.type === 'footer_mismatch' &&
                issue.footer_value != null &&
                issue.computed_total_value != null && (
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-slate-600">
                    <dt>Tally footer</dt>
                    <dd>{issue.footer_value.toLocaleString('en-LK')}</dd>
                    <dt>Sum of lines</dt>
                    <dd>{issue.computed_total_value.toLocaleString('en-LK')}</dd>
                    {issue.diff != null && (
                      <>
                        <dt>Difference</dt>
                        <dd>{issue.diff.toLocaleString('en-LK')}</dd>
                      </>
                    )}
                  </dl>
                )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ImportSuccessSummary({
  data,
  dryRun,
}: {
  dryRun: boolean;
  data: {
    rowCounts?: Record<string, unknown>;
    report?: { itemsCreated?: number; itemsUpdated?: number; groupsCreated?: number };
    snapshotId?: string;
  };
}) {
  const rc = data.rowCounts ?? {};
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
      <h3 className="font-display text-base font-semibold text-emerald-900">
        {dryRun ? 'Preview passed' : 'Import completed'}
      </h3>
      <p className="mt-1 text-sm text-emerald-800">
        {dryRun
          ? 'No changes were saved. Uncheck dry run and click Run import to apply.'
          : 'Balances and product masters were updated.'}
      </p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-emerald-700">Products in file</dt>
          <dd className="font-mono font-semibold text-emerald-950">{String(rc.items ?? '—')}</dd>
        </div>
        <div>
          <dt className="text-emerald-700">New products</dt>
          <dd className="font-mono font-semibold text-emerald-950">
            {String(data.report?.itemsCreated ?? rc.items_created ?? 0)}
          </dd>
        </div>
        <div>
          <dt className="text-emerald-700">Updated products</dt>
          <dd className="font-mono font-semibold text-emerald-950">
            {String(data.report?.itemsUpdated ?? rc.items_updated ?? 0)}
          </dd>
        </div>
        <div>
          <dt className="text-emerald-700">Validation</dt>
          <dd className="font-semibold text-emerald-950">Passed</dd>
        </div>
        {rc.computed_total_value != null && (
          <div className="sm:col-span-2">
            <dt className="text-emerald-700">Total stock value (LKR)</dt>
            <dd className="font-mono font-semibold text-emerald-950">
              {Number(rc.computed_total_value).toLocaleString('en-LK', {
                minimumFractionDigits: 2,
              })}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
