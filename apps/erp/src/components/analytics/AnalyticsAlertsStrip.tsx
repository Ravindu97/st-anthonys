import Link from 'next/link';
import type { OperationalAlerts } from '@/lib/analytics-shared';

function AlertPill({
  label,
  count,
  href,
  urgent,
}: {
  label: string;
  count: number;
  href: string;
  urgent?: boolean;
}) {
  if (count === 0) return null;
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-90 ${
        urgent
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <span className="font-mono text-sm font-semibold">{count}</span>
      {label}
    </Link>
  );
}

export function AnalyticsAlertsStrip({ alerts }: { alerts: OperationalAlerts }) {
  const hasAny =
    alerts.draft_reorder_suggestions > 0 ||
    alerts.approved_reorder_suggestions > 0 ||
    alerts.open_purchase_orders > 0 ||
    alerts.awaiting_receipt_pos > 0;

  if (!hasAny) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
        No operational exceptions right now — replenishment and purchasing queues are clear.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Needs attention
      </p>
      <div className="flex flex-wrap gap-2">
        <AlertPill
          label="draft reorder lines"
          count={alerts.draft_reorder_suggestions}
          href="/inventory/reorder"
          urgent
        />
        <AlertPill
          label="approved, not PO'd"
          count={alerts.approved_reorder_suggestions}
          href="/inventory/reorder?tab=approved"
        />
        <AlertPill
          label="open purchase orders"
          count={alerts.open_purchase_orders}
          href="/purchasing"
        />
        <AlertPill
          label="awaiting receipt"
          count={alerts.awaiting_receipt_pos}
          href="/purchasing"
          urgent
        />
      </div>
    </section>
  );
}
