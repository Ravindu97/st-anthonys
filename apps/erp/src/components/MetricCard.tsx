import { formatLkrAmount } from '@/lib/format';

const labelSlotClass = 'min-h-[2.75rem] shrink-0';
const footerSlotClass = 'mt-auto min-h-[1.375rem] shrink-0 pt-2';

export function MetricCard({
  label,
  value,
  sub,
  accent = 'blue',
  badge,
  currency,
  className = '',
  valueClassName = '',
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'blue' | 'gold';
  badge?: string;
  /** Shown on a second line under the label (e.g. LKR) for aligned money cards */
  currency?: string;
  className?: string;
  valueClassName?: string;
}) {
  const ribbon = accent === 'gold' ? 'bg-brand-gold-500' : 'bg-brand-blue-500';
  return (
    <div
      className={`relative flex h-full min-h-[8.5rem] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:min-h-[9rem] sm:p-5 ${className}`}
    >
      <div className={`absolute top-0 right-0 left-0 h-1 ${ribbon}`} />
      <div className={`flex items-start justify-between gap-2 ${labelSlotClass}`}>
        <div className="min-w-0">
          <span className="block font-mono text-[11px] leading-snug font-semibold tracking-wide text-slate-500 uppercase sm:text-xs">
            {label}
          </span>
          {currency && (
            <span className="mt-1 block font-mono text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              {currency}
            </span>
          )}
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            {badge}
          </span>
        )}
      </div>
      <p
        className={`mt-2 shrink-0 font-display leading-none font-semibold tracking-tight text-slate-900 ${valueClassName || 'text-3xl'}`}
      >
        {value}
      </p>
      <div className={footerSlotClass}>
        {sub ? (
          <p className="font-mono text-[11px] leading-snug text-slate-400">{sub}</p>
        ) : null}
      </div>
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
      currency="LKR"
      value={formatLkrAmount(amount)}
      sub={sub}
      accent={accent}
      className={className}
      valueClassName="text-xl tabular-nums whitespace-nowrap sm:text-2xl lg:text-[1.65rem]"
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
      valueClassName="text-2xl tabular-nums sm:text-3xl"
    />
  );
}
