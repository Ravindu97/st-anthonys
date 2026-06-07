'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuditTimeline } from './AuditTimeline';
import type { AuditWorkflow } from '@/lib/audit-shared';

function formatWhen(d: Date | string) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditWorkflowGroup({ workflow }: { workflow: AuditWorkflow }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            {workflow.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{workflow.subtitle}</p>
          <p className="mt-1 text-xs text-slate-400">
            {workflow.actor_email ?? 'System'} · {formatWhen(workflow.started_at)} ·{' '}
            {workflow.event_count} event{workflow.event_count === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {workflow.primary_href && (
            <Link
              href={workflow.primary_href}
              className="rounded-lg border border-brand-blue-200 bg-brand-blue-50 px-3 py-1.5 text-xs font-medium text-brand-blue-700 hover:bg-brand-blue-100"
            >
              Open record
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {open ? 'Hide events' : `Show ${workflow.event_count} events`}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100">
          <AuditTimeline events={workflow.events} compact />
        </div>
      )}
    </article>
  );
}
