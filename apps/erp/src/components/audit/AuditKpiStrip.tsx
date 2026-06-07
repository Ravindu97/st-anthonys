type Kpis = {
  events_today: number;
  pos_today: number;
  imports_today: number;
  top_actor_7d: string | null;
};

export function AuditKpiStrip({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Events today" value={String(kpis.events_today)} />
      <Kpi label="POs created today" value={String(kpis.pos_today)} />
      <Kpi label="Imports today" value={String(kpis.imports_today)} />
      <Kpi label="Top actor (7d)" value={kpis.top_actor_7d ?? '—'} small />
    </div>
  );
}

function Kpi({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 font-display font-semibold text-slate-900 ${small ? 'truncate text-sm' : 'text-lg'}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
