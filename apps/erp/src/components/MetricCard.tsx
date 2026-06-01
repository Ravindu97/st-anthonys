import { formatLkr } from '@/lib/format';

export function MetricCard({
  label,
  value,
  sub,
  accent = 'blue',
  badge,
  className = '',
  valueClassName = '',
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'blue' | 'gold';
  badge?: string;
  className?: string;
  valueClassName?: string;
}) {
  const ribbon = accent === 'gold' ? 'bg-brand-gold-500' : 'bg-brand-blue-500';
  return (
    <div
      className={`relative flex min-h-[7.5rem] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:min-h-[8rem] sm:p-5 ${className}`}
    >
      <div className={`absolute top-0 right-0 left-0 h-1 ${ribbon}`} />
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold tracking-wider text-slate-500 uppercase">
          {label}
        </span>
        {badge && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            {badge}
          </span>
        )}
      </div>
      <p
        className={`mt-3 font-display font-semibold tracking-tight text-slate-900 ${valueClassName || 'text-3xl'}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-auto pt-2 font-mono text-[11px] leading-snug text-slate-400">
          {sub}
        </p>
      )}
    </div>
  );
}

export function MetricCardMoney({
  label,
  amount,
  sub,
  accent = 'blue',
  className,
}: {
  label: string;
  amount: number | string;
  sub?: string;
  accent?: 'blue' | 'gold';
  className?: string;
}) {
  return (
    <MetricCard
      label={label}
      value={formatLkr(amount)}
      sub={sub}
      accent={accent}
      className={className}
      valueClassName="text-xl leading-snug break-words sm:text-2xl lg:text-[1.65rem]"
    />
  );
}

export function MetricCardCount({
  label,
  count,
  sub,
  accent = 'blue',
  badge,
  className,
}: {
  label: string;
  count: number | string;
  sub?: string;
  accent?: 'blue' | 'gold';
  badge?: string;
  className?: string;
}) {
  const n = Number(count);
  return (
    <MetricCard
      label={label}
      value={Number.isFinite(n) ? n.toLocaleString() : String(count)}
      sub={sub}
      accent={accent}
      badge={badge}
      className={className}
      valueClassName="text-2xl sm:text-3xl"
    />
  );
}
