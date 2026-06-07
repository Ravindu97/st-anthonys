'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatLkrAmount } from '@/lib/format';
import { vendorInventoryUrl } from '@/lib/inventory-url';

export type VendorHubRow = {
  code: string;
  name: string;
  location_name: string;
  slug: string;
  sku_count: number;
  total_value: string | number;
  low_stock: number;
  out_of_stock: number;
  in_stock: number;
  at_risk_value: string | number;
  risk_pct: number;
  imported_at: string | Date;
  reorder_below_min?: number;
};

function AlertPillLink({
  count,
  tone,
  href,
  onNavigate,
}: {
  count: number;
  tone: 'amber' | 'red';
  href: string;
  onNavigate: (e: React.MouseEvent) => void;
}) {
  if (count <= 0) {
    return <span className="text-slate-300">—</span>;
  }
  const cls =
    tone === 'red'
      ? 'bg-red-50 text-red-800 border-red-100 hover:bg-red-100'
      : 'bg-brand-gold-50 text-brand-gold-700 border-brand-gold-100 hover:bg-brand-gold-100';
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`inline-flex min-w-9 justify-center rounded-full border px-2.5 py-1 font-mono text-xs font-semibold transition-colors ${cls}`}
    >
      {count.toLocaleString()}
    </Link>
  );
}

export function VendorHubTable({ vendors }: { vendors: VendorHubRow[] }) {
  const router = useRouter();

  const stopRowNav = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 font-medium text-slate-600 lg:px-6">Vendor</th>
            <th className="hidden px-4 py-3 font-medium text-slate-600 md:table-cell lg:px-6">
              Location
            </th>
            <th className="px-4 py-3 text-right font-medium text-slate-600 lg:px-6">
              SKUs
            </th>
            <th className="px-4 py-3 text-right font-medium text-slate-600 lg:px-6">
              Stock value (LKR)
            </th>
            <th className="hidden px-4 py-3 text-right font-medium text-slate-600 lg:table-cell lg:px-6">
              <span className="block">At-risk</span>
              <span className="block text-[10px] font-normal text-slate-400">
                % · value (LKR)
              </span>
            </th>
            <th className="px-4 py-3 text-center font-medium text-slate-600 lg:px-6">
              Low
            </th>
            <th className="px-4 py-3 text-center font-medium text-slate-600 lg:px-6">
              Out
            </th>
            <th className="hidden px-4 py-3 font-medium text-slate-600 md:table-cell lg:px-6">
              Updated
            </th>
            <th className="w-24 px-4 py-3 text-right font-medium text-slate-600 lg:px-6">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v, i) => {
            const href = `/inventory/${v.slug}`;
            const lowHref = vendorInventoryUrl(v.slug, {
              status: 'low_stock',
              sort: 'value_desc',
              tab: 'stock',
            });
            const outHref = vendorInventoryUrl(v.slug, {
              status: 'out_of_stock',
              sort: 'value_desc',
              tab: 'stock',
            });
            const riskHref = vendorInventoryUrl(v.slug, {
              status: 'out_of_stock',
              sort: 'value_desc',
              tab: 'stock',
            });

            return (
              <tr
                key={v.code}
                tabIndex={0}
                role="link"
                onClick={() => router.push(href)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(href);
                  }
                }}
                className={`group cursor-pointer border-b border-slate-100 transition-colors hover:bg-brand-blue-50/40 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                }`}
              >
                <td className="px-4 py-4 lg:px-6">
                  <span className="font-display text-base font-semibold text-slate-900 group-hover:text-brand-blue-700">
                    {v.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-xs text-slate-400">
                    {v.code}
                    {(v.reorder_below_min ?? 0) > 0 && (
                      <Link
                        href={`/inventory/reorder?tab=action&vendor=${v.code}`}
                        onClick={stopRowNav}
                        className="ml-2 rounded-full bg-brand-blue-50 px-2 py-0.5 text-[10px] font-semibold text-brand-blue-700 hover:bg-brand-blue-100"
                      >
                        {v.reorder_below_min} need reorder
                      </Link>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-slate-500 md:hidden">
                    {v.location_name}
                  </span>
                </td>
                <td className="hidden px-4 py-4 text-slate-600 md:table-cell lg:px-6">
                  {v.location_name}
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums text-slate-700 lg:px-6">
                  {Number(v.sku_count).toLocaleString()}
                </td>
                <td className="px-4 py-4 text-right font-mono text-sm font-semibold whitespace-nowrap tabular-nums text-slate-900 lg:px-6">
                  {formatLkrAmount(v.total_value)}
                </td>
                <td className="hidden px-4 py-4 text-right lg:table-cell lg:px-6">
                  <Link
                    href={riskHref}
                    onClick={stopRowNav}
                    className="block whitespace-nowrap"
                    title={`${v.risk_pct}% of vendor value · LKR ${formatLkrAmount(v.at_risk_value)} at risk`}
                  >
                    <span className="font-mono text-sm font-semibold text-brand-gold-800">
                      {v.risk_pct}%
                    </span>
                    <span className="mt-0.5 block font-mono text-xs tabular-nums text-slate-500">
                      {formatLkrAmount(v.at_risk_value)}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-4 text-center lg:px-6">
                  <AlertPillLink
                    count={Number(v.low_stock)}
                    tone="amber"
                    href={lowHref}
                    onNavigate={stopRowNav}
                  />
                </td>
                <td className="px-4 py-4 text-center lg:px-6">
                  <AlertPillLink
                    count={Number(v.out_of_stock)}
                    tone="red"
                    href={outHref}
                    onNavigate={stopRowNav}
                  />
                </td>
                <td className="hidden px-4 py-4 font-mono text-xs whitespace-nowrap text-slate-500 md:table-cell lg:px-6">
                  {new Date(v.imported_at).toLocaleDateString('en-GB')}
                </td>
                <td className="px-4 py-4 text-right lg:px-6">
                  <Link
                    href={href}
                    onClick={stopRowNav}
                    className="inline-flex items-center gap-1 rounded-lg border border-transparent px-3 py-1.5 text-sm font-medium text-brand-blue-600 transition group-hover:border-brand-blue-200 group-hover:bg-brand-blue-50"
                  >
                    Open
                    <span aria-hidden>→</span>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
