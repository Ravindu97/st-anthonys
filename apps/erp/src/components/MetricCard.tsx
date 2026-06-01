import { formatLkr } from '@/lib/format';

export function MetricCard({
  label,
  value,
  sub,
  accent = 'blue',
  badge,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'blue' | 'gold';
  badge?: string;
}) {
  const ribbon = accent === 'gold' ? 'bg-brand-gold-500' : 'bg-brand-blue-500';
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      {sub && (
        <p className="mt-1 font-mono text-[11px] text-slate-400">{sub}</p>
      )}
    </div>
  );
}

export function MetricCardMoney({
  label,
  amount,
  sub,
  accent = 'blue',
}: {
  label: string;
  amount: number | string;
  sub?: string;
  accent?: 'blue' | 'gold';
}) {
  return (
    <MetricCard
      label={label}
      value={formatLkr(amount)}
      sub={sub}
      accent={accent}
    />
  );
}
