import { formatLkrAmount } from '@/lib/format';
import type { SalesTrendPoint } from '@/lib/analytics-shared';

export function AnalyticsSalesTrend({
  points,
  days = 14,
}: {
  points: SalesTrendPoint[];
  days?: number;
}) {
  const max = Math.max(...points.map((p) => p.total_revenue), 1);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-4">
        <h2 className="font-display text-sm font-semibold text-slate-900">Sales trend</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Last {days} days — counter vs office orders (LKR)
        </p>
      </header>
      <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{ minHeight: '8rem' }}>
        {points.map((p) => {
          const totalH = Math.max(4, (p.total_revenue / max) * 100);
          const counterH = p.total_revenue > 0 ? (p.counter_revenue / p.total_revenue) * totalH : 0;
          const orderH = totalH - counterH;
          const label = new Date(p.day).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
          });
          return (
            <div
              key={p.day}
              className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-1"
              title={`${label}: ${formatLkrAmount(p.total_revenue)}`}
            >
              <div className="flex w-full flex-col justify-end" style={{ height: '6rem' }}>
                {orderH > 0 && (
                  <div
                    className="w-full rounded-t bg-brand-blue-400"
                    style={{ height: `${orderH}%` }}
                  />
                )}
                {counterH > 0 && (
                  <div
                    className="w-full bg-brand-gold-400"
                    style={{ height: `${counterH}%`, borderRadius: orderH > 0 ? 0 : '4px 4px 0 0' }}
                  />
                )}
              </div>
              <span className="text-[10px] text-slate-500">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-gold-400" />
          Counter (POS)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-blue-400" />
          Pickup / delivery orders
        </span>
      </div>
    </section>
  );
}
