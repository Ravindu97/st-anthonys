import Link from 'next/link';
import { formatLkr } from '@/lib/format';
import { InsightLink } from '@/components/InsightLink';
import { unitDetailUrl, vendorInventoryUrl } from '@/lib/inventory-url';

type Pareto = {
  limit: number;
  total_skus: number;
  top_share_pct: number;
};

type WatchItem = {
  stock_item_id: string;
  primary_sku: string | null;
  item_name: string;
  stock_group_name: string;
  quantity: string | number | null;
  unit_code: string;
  line_value: string;
  alert_status: 'low_stock' | 'out_of_stock';
};

type GroupHealth = {
  group_name: string;
  sku_count: number;
  total_value: string;
  out_of_stock: number;
  low_stock: number;
  at_risk_value: string;
};

type GroupRollup = {
  group_name: string;
  total_value: string;
  item_count: number;
};

export function VendorInsightsPanel({
  vendorSlug,
  pareto,
  watchlist,
  groupHealth,
  groupRollups,
  varianceCount,
  snapshotDiff,
}: {
  vendorSlug: string;
  pareto: Pareto;
  watchlist: WatchItem[];
  groupHealth: GroupHealth[];
  groupRollups: GroupRollup[];
  varianceCount: number;
  snapshotDiff?: {
    hasPrevious: boolean;
    new_out_count?: number;
    restocked_count?: number;
    value_change?: number;
  };
}) {
  const maxGroupValue = Math.max(
    ...groupRollups.map((g) => Number(g.total_value)),
    1
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Value concentration
          </h2>
          <p className="mt-2 font-display text-3xl font-semibold text-slate-900">
            {pareto.top_share_pct}%
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Top {pareto.limit} SKUs of {pareto.total_skus.toLocaleString()} lines
          </p>
          <InsightLink
            href={vendorInventoryUrl(vendorSlug, { sort: 'value_desc' })}
            className="mt-3"
          >
            View by value
          </InsightLink>
        </section>

        {snapshotDiff?.hasPrevious && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Since last import
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>
                <span className="font-mono font-semibold text-red-700">
                  {snapshotDiff.new_out_count}
                </span>{' '}
                newly out of stock
              </li>
              <li>
                <span className="font-mono font-semibold text-emerald-700">
                  {snapshotDiff.restocked_count}
                </span>{' '}
                restocked from zero
              </li>
              <li>
                Value change:{' '}
                <span className="font-mono font-semibold">
                  {formatLkr(snapshotDiff.value_change ?? 0)}
                </span>
              </li>
            </ul>
            <InsightLink href={`/inventory/alerts?tab=new_outs`} className="mt-3">
              All new outs
            </InsightLink>
          </section>
        )}

        {varianceCount > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Tally reconciliation
            </h2>
            <p className="mt-2 font-display text-3xl font-semibold text-slate-900">
              {varianceCount}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Lines where value ≠ qty × rate
            </p>
            <InsightLink
              href={vendorInventoryUrl(vendorSlug, {
                dataIssues: 'variance',
                sort: 'value_desc',
              })}
              className="mt-3"
            >
              Review mismatches
            </InsightLink>
          </section>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Stock value by group
        </h2>
        <ul className="mt-4 space-y-2">
          {groupRollups.slice(0, 10).map((g) => {
            const pct = Math.round((Number(g.total_value) / maxGroupValue) * 100);
            return (
              <li key={g.group_name}>
                <Link
                  href={vendorInventoryUrl(vendorSlug, {
                    group: g.group_name,
                    sort: 'value_desc',
                  })}
                  className="flex items-center justify-between gap-2 text-sm hover:text-brand-blue-600"
                >
                  <span className="truncate font-medium">{g.group_name}</span>
                  <span className="shrink-0 font-mono text-xs">
                    {formatLkr(g.total_value)}
                  </span>
                </Link>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-blue-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Priority watchlist
            </h2>
            <InsightLink
              href={vendorInventoryUrl(vendorSlug, {
                status: 'out_of_stock',
                sort: 'value_desc',
              })}
            >
              All alerts
            </InsightLink>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Low and out lines by stock value
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="py-2 pr-2">Unit</th>
                  <th className="py-2 pr-2">Product</th>
                  <th className="py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((row) => {
                  const unitHref = unitDetailUrl(vendorSlug, {
                    stockItemId: row.stock_item_id,
                    sku: row.primary_sku,
                  });
                  return (
                    <tr
                      key={row.stock_item_id}
                      className="border-b border-slate-50"
                    >
                      <td className="py-2 pr-2">
                        <Link
                          href={unitHref}
                          className="font-mono text-brand-blue-600 hover:underline"
                        >
                          {row.primary_sku ?? '—'}
                        </Link>
                      </td>
                      <td className="max-w-[10rem] truncate py-2 pr-2">
                        <Link
                          href={unitHref}
                          className="text-slate-800 hover:text-brand-blue-600 hover:underline"
                        >
                          {row.item_name}
                        </Link>
                        <span
                          className={`ml-1 rounded px-1 text-[10px] ${
                            row.alert_status === 'out_of_stock'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-brand-gold-50 text-brand-gold-700'
                          }`}
                        >
                          {row.alert_status === 'out_of_stock' ? 'Out' : 'Low'}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono font-semibold">
                        {formatLkr(row.line_value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Health by group
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="py-2">Group</th>
                  <th className="py-2 text-center">Low</th>
                  <th className="py-2 text-center">Out</th>
                  <th className="py-2 text-right">At risk</th>
                </tr>
              </thead>
              <tbody>
                {groupHealth.slice(0, 12).map((g) => (
                  <tr key={g.group_name} className="border-b border-slate-50">
                    <td className="py-2">
                      <Link
                        href={vendorInventoryUrl(vendorSlug, {
                          group: g.group_name,
                          sort: 'value_desc',
                        })}
                        className="font-medium text-brand-blue-600 hover:underline"
                      >
                        {g.group_name}
                      </Link>
                    </td>
                    <td className="py-2 text-center font-mono">{g.low_stock}</td>
                    <td className="py-2 text-center font-mono">{g.out_of_stock}</td>
                    <td className="py-2 text-right font-mono">
                      {formatLkr(g.at_risk_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
