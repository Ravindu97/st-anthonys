export function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-10 flex-1 rounded bg-slate-100" />
          <div className="h-10 w-20 rounded bg-slate-100" />
          <div className="h-10 w-24 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
