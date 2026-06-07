import Link from 'next/link';
import {
  AUDIT_ACTION_LABELS,
  resolveAuditRecordHref,
  type AuditEvent,
} from '@/lib/audit-shared';
import { AuditChangeChips } from './AuditChangeChips';

function formatWhen(d: Date | string) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function AuditTimeline({
  events,
  compact = false,
}: {
  events: AuditEvent[];
  compact?: boolean;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No activity recorded yet.</p>;
  }

  return (
    <ol className={`space-y-0 ${compact ? '' : 'rounded-xl border border-slate-200 bg-white'}`}>
      {events.map((event, i) => {
        const href = resolveAuditRecordHref(event);
        return (
          <li
            key={event.id}
            className={`flex gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}
          >
            <div
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-blue-400"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-blue-700">
                  {actionLabel(event.action)}
                </span>
                {event.record_label && href && (
                  <Link
                    href={href}
                    className="font-mono text-xs text-brand-blue-600 hover:underline"
                  >
                    {event.record_label}
                  </Link>
                )}
                {event.record_label && !href && (
                  <span className="font-mono text-xs text-slate-500">{event.record_label}</span>
                )}
                <time className="text-xs text-slate-400">{formatWhen(event.created_at)}</time>
                <span className="text-[10px] uppercase text-slate-300">{event.source}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-800">{event.summary}</p>
              <AuditChangeChips changes={event.changes} />
              <p className="mt-0.5 text-xs text-slate-500">
                {event.actor_email ?? 'System'}
              </p>
              {!compact && Object.keys(event.metadata).length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
                    Technical detail
                  </summary>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-50 p-2 font-mono text-[10px] text-slate-600">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
