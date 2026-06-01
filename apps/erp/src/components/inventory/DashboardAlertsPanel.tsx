import Link from 'next/link';
import { formatLkr } from '@/lib/format';
import { alertsUrl, vendorInventoryUrl } from '@/lib/inventory-url';

type StatLinkProps = {
  href: string;
  label: string;
  count: number;
  tone: 'amber' | 'red' | 'slate' | 'blue';
};

function StatLink({ href, label, count, tone }: StatLinkProps) {
  const tones = {
    amber: 'border-brand-gold-200 bg-brand-gold-50/80 hover:bg-brand-gold-100',
    red: 'border-red-200 bg-red-50/80 hover:bg-red-100',
    slate: 'border-slate-200 bg-white hover:bg-slate-50',
    blue: 'border-brand-blue-200 bg-brand-blue-50/80 hover:bg-brand-blue-100',
  };
  const countTones = {
    amber: 'text-brand-gold-900',
    red: 'text-red-900',
    slate: 'text-slate-900',
    blue: 'text-brand-blue-900',
  };

  return (
    <Link
      href={href}
      className={`rounded-lg border px-3 py-2.5 transition-colors ${tones[tone]}`}
    >
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${countTones[tone]}`}>
        {count.toLocaleString()}
      </p>
    </Link>
  );
}

type Props = {
  lowStock: number;
  outOfStock: number;
  atRiskValue: number;
  atRiskPct: number;
  varianceCount: number;
  newOutsCount: number;
  topVendor?: {
    slug: string;
    name: string;
    at_risk_value: number;
    low_stock: number;
    out_of_stock: number;
  };
};

export function DashboardAlertsPanel({
  lowStock,
  outOfStock,
  atRiskValue,
  atRiskPct,
  varianceCount,
  newOutsCount,
  topVendor,
}: Props) {
  const hasAlerts =
    lowStock > 0 || outOfStock > 0 || varianceCount > 0 || newOutsCount > 0;

  if (!hasAlerts) return null;

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      aria-label="Inventory alerts"
    >
      <div className="bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Inventory alerts
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {atRiskValue > 0 ? (
                <>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatLkr(atRiskValue)}
                  </span>{' '}
                  on low and out-of-stock lines
                  {atRiskPct > 0 && (
                    <span className="text-slate-500"> · {atRiskPct}% of portfolio</span>
                  )}
                </>
              ) : (
                'Lines that need attention from the latest import'
              )}
            </p>
          </div>
          <Link
            href={alertsUrl('all')}
            className="shrink-0 rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600"
          >
            Open alert center
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {lowStock > 0 && (
            <StatLink
              href={alertsUrl('low')}
              label="Low stock"
              count={lowStock}
              tone="amber"
            />
          )}
          {outOfStock > 0 && (
            <StatLink
              href={alertsUrl('out')}
              label="Out of stock"
              count={outOfStock}
              tone="red"
            />
          )}
          {varianceCount > 0 && (
            <StatLink
              href={alertsUrl('variance')}
              label="Value mismatches"
              count={varianceCount}
              tone="slate"
            />
          )}
          {newOutsCount > 0 && (
            <StatLink
              href={alertsUrl('new_outs')}
              label="New outs"
              count={newOutsCount}
              tone="blue"
            />
          )}
          {topVendor &&
            (topVendor.low_stock > 0 || topVendor.out_of_stock > 0) && (
              <Link
                href={vendorInventoryUrl(topVendor.slug, { tab: 'insights' })}
                className="rounded-lg border border-brand-blue-200 bg-brand-blue-50/80 px-3 py-2.5 transition-colors hover:bg-brand-blue-100"
              >
                <p className="text-xs font-medium text-slate-600">Highest risk</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-brand-blue-900">
                  {topVendor.name}
                </p>
                <p className="mt-0.5 font-mono text-xs text-brand-blue-800">
                  {formatLkr(topVendor.at_risk_value)}
                </p>
              </Link>
            )}
        </div>
      </div>
    </section>
  );
}
