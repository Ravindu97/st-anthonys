'use client';

import { formatLkr } from '@/lib/format';

export type ZReport = {
  session: {
    opening_cash: string;
    closing_cash: string | null;
    opened_at?: string;
    closed_at?: string | null;
  } | null;
  byPayment: Array<{ payment_method: string; count: number; total: string }>;
  summary: { transaction_count: number; gross_sales: string };
};

export function PosSessionBar({
  registers,
  registerId,
  onRegisterChange,
  sessionId,
  locationName,
  openingCash,
  onOpeningCashChange,
  closingCash,
  onClosingCashChange,
  onOpenSession,
  onCloseSession,
  zReport,
  showZReport,
  onToggleZReport,
  loading,
}: {
  registers: Array<{ id: string; name: string; location_name: string }>;
  registerId: string;
  onRegisterChange: (id: string) => void;
  sessionId: string | null;
  locationName: string;
  openingCash: string;
  onOpeningCashChange: (v: string) => void;
  closingCash: string;
  onClosingCashChange: (v: string) => void;
  onOpenSession: () => void;
  onCloseSession: () => void;
  zReport: ZReport | null;
  showZReport: boolean;
  onToggleZReport: () => void;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={registerId}
          onChange={(e) => onRegisterChange(e.target.value)}
          disabled={!!sessionId}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {registers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} — {r.location_name}
            </option>
          ))}
        </select>

        {!sessionId ? (
          <>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Opening cash
              <input
                type="number"
                min={0}
                step="0.01"
                value={openingCash}
                onChange={(e) => onOpeningCashChange(e.target.value)}
                className="w-24 rounded border border-slate-200 px-2 py-1 font-mono text-sm"
              />
            </label>
            <button
              type="button"
              onClick={onOpenSession}
              disabled={loading}
              className="rounded-lg bg-brand-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue-600 disabled:opacity-50"
            >
              Open session
            </button>
          </>
        ) : (
          <>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
              Session open · {locationName}
            </span>
            <button
              type="button"
              onClick={onToggleZReport}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              {showZReport ? 'Hide Z-report' : 'Z-report'}
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Closing cash
              <input
                type="number"
                min={0}
                step="0.01"
                value={closingCash}
                onChange={(e) => onClosingCashChange(e.target.value)}
                className="w-24 rounded border border-slate-200 px-2 py-1 font-mono text-sm"
              />
            </label>
            <button
              type="button"
              onClick={onCloseSession}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Close session
            </button>
          </>
        )}
      </div>

      {showZReport && sessionId && zReport && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-800">Session summary</p>
          <dl className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              Transactions:{' '}
              <span className="font-mono font-medium text-slate-900">
                {zReport.summary.transaction_count}
              </span>
            </div>
            <div>
              Gross sales:{' '}
              <span className="font-mono font-medium text-slate-900">
                {formatLkr(zReport.summary.gross_sales)}
              </span>
            </div>
            {zReport.session && (
              <div>
                Opening cash:{' '}
                <span className="font-mono">{formatLkr(zReport.session.opening_cash)}</span>
              </div>
            )}
          </dl>
          {zReport.byPayment.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {zReport.byPayment.map((p) => (
                <li key={p.payment_method} className="flex justify-between capitalize">
                  <span>{p.payment_method}</span>
                  <span className="font-mono">
                    {p.count} · {formatLkr(p.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
