import Link from 'next/link';

export function DashboardKpiCard({
  label,
  value,
  sub,
  href,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  tone?: 'default' | 'warn' | 'danger';
}) {
  const border =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50/40'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50/40'
        : 'border-slate-200 bg-white';

  const inner = (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${border}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition hover:opacity-90">
        {inner}
      </Link>
    );
  }
  return inner;
}
