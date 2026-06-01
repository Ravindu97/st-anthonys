import Link from 'next/link';
import { formatLkr } from '@/lib/format';
import { vendorInventoryUrl } from '@/lib/inventory-url';

type GroupRow = {
  group_name: string;
  total_value: string;
  item_count: number;
  share_pct: number;
};

export function PortfolioGroupMix({
  groups,
  vendors,
}: {
  groups: GroupRow[];
  vendors: { slug: string; name: string }[];
}) {
  if (groups.length === 0) return null;
  const maxShare = Math.max(...groups.map((g) => g.share_pct), 1);
  const firstVendor = vendors[0];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-base font-semibold text-slate-900">
        Top stock groups (all vendors)
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        By combined stock value across latest imports
      </p>
      <ul className="mt-4 space-y-3">
        {groups.map((g) => (
          <li key={g.group_name}>
            <div className="flex items-center justify-between gap-2 text-sm">
              {firstVendor ? (
                <Link
                  href={vendorInventoryUrl(firstVendor.slug, {
                    group: g.group_name,
                    sort: 'value_desc',
                    tab: 'stock',
                  })}
                  className="truncate font-medium text-slate-800 hover:text-brand-blue-600"
                  title={g.group_name}
                >
                  {g.group_name}
                </Link>
              ) : (
                <span className="truncate font-medium text-slate-800">{g.group_name}</span>
              )}
              <span className="shrink-0 font-mono text-xs text-slate-500">
                {g.share_pct}% · {formatLkr(g.total_value)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-blue-400"
                style={{ width: `${(g.share_pct / maxShare) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
