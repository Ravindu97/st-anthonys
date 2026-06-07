'use client';

export type StockWarningLine = {
  stockItemId: string;
  sku: string;
  item_name: string;
  requested: number;
  on_hand: number;
};

export function PosStockWarningModal({
  locationName,
  lines,
  onCancel,
  onConfirm,
}: {
  locationName: string;
  lines: StockWarningLine[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="font-display text-lg font-semibold text-amber-900">
          Insufficient stock
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          The following lines exceed on-hand quantity at{' '}
          <span className="font-medium">{locationName}</span>.
        </p>
        <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm">
          {lines.map((l) => (
            <li
              key={l.stockItemId}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
            >
              <span className="font-mono text-xs">{l.sku}</span> — {l.item_name}
              <span className="mt-0.5 block text-xs text-amber-800">
                Requested {l.requested} · On hand {l.on_hand}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Proceed anyway
          </button>
        </div>
      </div>
    </div>
  );
}
