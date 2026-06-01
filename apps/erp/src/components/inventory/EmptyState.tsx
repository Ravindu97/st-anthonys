export function EmptyState({
  title,
  description,
  onClear,
}: {
  title: string;
  description: string;
  onClear?: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-8 py-16 text-center">
      <p className="font-display text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mt-6 rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
