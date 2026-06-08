import Link from 'next/link';
import { alertsUrl } from '@/lib/inventory-url';
import type { OperationsAttention } from '@/lib/dashboard-shared';

function AttentionPill({
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

export function OperationsAttentionStrip({ attention }: { attention: OperationsAttention }) {
  const hasAny =
    attention.low_stock > 0 ||
    attention.out_of_stock > 0 ||
    attention.below_min_count > 0 ||
    attention.variance_count > 0 ||
    attention.new_outs_count > 0 ||
    attention.draft_reorder_suggestions > 0 ||
    attention.awaiting_receipt_pos > 0 ||
    attention.open_sales_to_fulfill > 0;

  if (!hasAny) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
        No exceptions right now — inventory, sales queue, and purchasing are clear.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Needs attention
      </p>
      <div className="flex flex-wrap gap-2">
        <AttentionPill
          label="low stock"
          count={attention.low_stock}
          href={alertsUrl('low')}
        />
        <AttentionPill
          label="out of stock"
          count={attention.out_of_stock}
          href={alertsUrl('out')}
          urgent
        />
        <AttentionPill
          label="below minimum"
          count={attention.below_min_count}
          href="/inventory/reorder?tab=action"
          urgent
        />
        <AttentionPill
          label="value mismatches"
          count={attention.variance_count}
          href={alertsUrl('variance')}
        />
        <AttentionPill
          label="new outs"
          count={attention.new_outs_count}
          href={alertsUrl('new_outs')}
          urgent
        />
        <AttentionPill
          label="draft reorder lines"
          count={attention.draft_reorder_suggestions}
          href="/inventory/reorder"
        />
        <AttentionPill
          label="awaiting receipt"
          count={attention.awaiting_receipt_pos}
          href="/purchasing"
          urgent
        />
        <AttentionPill
          label="sales to fulfill"
          count={attention.open_sales_to_fulfill}
          href="/orders"
        />
      </div>
    </section>
  );
}
