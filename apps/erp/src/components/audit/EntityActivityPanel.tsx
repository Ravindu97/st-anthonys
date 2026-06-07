import Link from 'next/link';
import { AuditTimeline } from './AuditTimeline';
import { groupEventsIntoWorkflows, type AuditEvent } from '@/lib/audit-shared';

function formatWhen(d: Date | string) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Attribution = {
  po: {
    id?: string;
    po_number: string;
    created_at: Date;
    created_by_email: string | null;
    status: string;
  };
  grns: Array<{
    grn_number: string;
    created_at: Date;
    created_by_email: string | null;
  }>;
};

export function EntityActivityPanel({
  attribution,
  auditEvents,
  showFullHistory = false,
}: {
  attribution: Attribution;
  auditEvents?: AuditEvent[];
  showFullHistory?: boolean;
}) {
  const { po, grns } = attribution;
  const workflows =
    auditEvents && auditEvents.length > 0
      ? groupEventsIntoWorkflows(
          [...auditEvents].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        )
      : [];

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header>
        <h2 className="font-display text-sm font-semibold text-slate-900">Activity</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Purchase order lifecycle and audit story
        </p>
      </header>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Created by
          </dt>
          <dd className="mt-0.5 text-slate-800">
            {po.created_by_email ?? 'Unknown'}
            <span className="block text-xs text-slate-400">{formatWhen(po.created_at)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Status
          </dt>
          <dd className="mt-0.5 capitalize text-slate-800">{po.status}</dd>
        </div>
      </dl>

      {workflows.length > 0 && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Story: </span>
          {workflows[0].subtitle}
        </div>
      )}

      {grns.length > 0 && (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Goods receipts
          </h3>
          <ul className="mt-2 space-y-2">
            {grns.map((grn) => (
              <li
                key={grn.grn_number}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs font-medium text-slate-800">
                  {grn.grn_number}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Received by {grn.created_by_email ?? 'Unknown'} ·{' '}
                  {formatWhen(grn.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showFullHistory && auditEvents && auditEvents.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Full audit trail
            </h3>
            <Link
              href={`/admin/audit?q=${encodeURIComponent(po.po_number)}&view=workflows`}
              className="text-[10px] text-brand-blue-600 hover:underline"
            >
              Open in activity log
            </Link>
          </div>
          <AuditTimeline
            events={[...auditEvents].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )}
            compact
          />
        </div>
      )}
    </section>
  );
}
