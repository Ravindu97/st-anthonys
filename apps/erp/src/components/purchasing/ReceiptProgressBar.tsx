export function ReceiptProgressBar({
  linesFullyReceived,
  totalLines,
  label,
}: {
  linesFullyReceived: number;
  totalLines: number;
  label?: string;
}) {
  const pct = totalLines > 0 ? Math.round((linesFullyReceived / totalLines) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{label ?? 'Receipt progress'}</span>
        <span className="font-mono tabular-nums">
          {linesFullyReceived}/{totalLines} lines ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
