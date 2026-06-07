import type { AuditChange } from '@/lib/audit-shared';

function formatVal(v: unknown) {
  if (v == null) return '—';
  return String(v);
}

export function AuditChangeChips({ changes }: { changes: AuditChange[] }) {
  if (changes.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {changes.map((c) => (
        <span
          key={`${c.field}-${String(c.old)}-${String(c.new)}`}
          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700"
        >
          <span className="text-slate-500">{c.field}</span>
          <span>{formatVal(c.old)}</span>
          <span className="text-slate-400">→</span>
          <span className="font-medium">{formatVal(c.new)}</span>
        </span>
      ))}
    </div>
  );
}
