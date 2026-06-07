import Link from 'next/link';
import { AuditTimeline } from '@/components/audit/AuditTimeline';
import { groupEventsIntoWorkflows, type AuditEvent } from '@/lib/audit-shared';

export function RecordActivityPanel({
  recordLabel,
  subtitle,
  events,
}: {
  recordLabel: string;
  subtitle?: string;
  events: AuditEvent[];
}) {
  const workflows = groupEventsIntoWorkflows(
    [...events].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  );

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900">Activity</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <Link
          href={`/admin/audit?q=${encodeURIComponent(recordLabel)}&view=workflows`}
          className="text-xs text-brand-blue-600 hover:underline"
        >
          Open in activity log
        </Link>
      </header>

      {workflows[0] && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Story: </span>
          {workflows[0].subtitle}
        </div>
      )}

      <AuditTimeline
        events={[...events].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )}
        compact
      />
    </section>
  );
}
