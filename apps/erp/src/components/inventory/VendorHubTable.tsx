'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatLkr } from '@/lib/format';
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
      className={`inline-flex min-w-8 justify-center rounded-full border px-2 py-0.5 font-mono text-xs font-semibold transition-colors ${cls}`}
    >
      {count.toLocaleString()}
    </Link>
  );
}

function shareOfTotal(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function VendorHubTable({
  vendors,
  totalValue,
}: {
  vendors: VendorHubRow[];
  totalValue?: number | string;
}) {
  const router = useRouter();
  const portfolioTotal = Number(totalValue ?? 0);

  const stopRowNav = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50/80">
          <tr className="border-b border-slate-100">
            <th className="px-4 py-3 font-medium text-slate-500">Vendor</th>
            <th className="hidden px-4 py-3 font-medium text-slate-500 md:table-cell">
              Location
            </th>
            <th className="px-4 py-3 text-right font-medium text-slate-500">
              SKUs
            </th>
            <th className="px-4 py-3 text-right font-medium text-slate-500">
              Stock value
            </th>
            {portfolioTotal > 0 && (
              <th className="hidden px-4 py-3 text-right font-medium text-slate-500 lg:table-cell">
                Share
              </th>
            )}
            <th className="hidden px-4 py-3 text-right font-medium text-slate-500 md:table-cell">
              Risk %
            </th>
            <th className="px-4 py-3 text-center font-medium text-slate-500">
              Low
            </th>
            <th className="px-4 py-3 text-center font-medium text-slate-500">
              Out
            </th>
            <th className="hidden px-4 py-3 font-medium text-slate-500 sm:table-cell">
              Updated
            </th>
            <th className="w-10 px-2 py-3" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {vendors.map((v, i) => {
            const href = `/inventory/${v.slug}`;
            const value = Number(v.total_value);
            const share = shareOfTotal(value, portfolioTotal);
            const lowHref = vendorInventoryUrl(v.slug, {
              status: 'low_stock',
              sort: 'value_desc',
            });
            const outHref = vendorInventoryUrl(v.slug, {
              status: 'out_of_stock',
              sort: 'value_desc',
            });
            const riskHref = vendorInventoryUrl(v.slug, {
              status: 'out_of_stock',
              sort: 'value_desc',
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
                className={`group cursor-pointer border-b border-slate-100 transition-colors hover:bg-brand-blue-50/50 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                }`}
              >
                <td className="px-4 py-3.5">
                  <span className="font-semibold text-slate-900 group-hover:text-brand-blue-700">
                    {v.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                    {v.code}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 md:hidden">
                    {v.location_name}
                  </span>
                </td>
                <td className="hidden px-4 py-3.5 text-slate-600 md:table-cell">
                  {v.location_name}
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                  {Number(v.sku_count).toLocaleString()}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold whitespace-nowrap tabular-nums text-slate-900">
                  {formatLkr(v.total_value)}
                </td>
                {portfolioTotal > 0 && (
                  <td className="hidden px-4 py-3.5 text-right lg:table-cell">
                    <span className="font-mono text-xs text-slate-500">
                      {share}%
                    </span>
                    <div className="mt-1 ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-blue-400"
                        style={{ width: `${Math.min(share, 100)}%` }}
                      />
                    </div>
                  </td>
                )}
                <td className="hidden px-4 py-3.5 text-right md:table-cell">
                  <Link
                    href={riskHref}
                    onClick={stopRowNav}
                    className="font-mono text-xs font-semibold text-brand-gold-700 hover:underline"
                    title={formatLkr(v.at_risk_value)}
                  >
                    {v.risk_pct}%
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <AlertPillLink
                    count={Number(v.low_stock)}
                    tone="amber"
                    href={lowHref}
                    onNavigate={stopRowNav}
                  />
                </td>
                <td className="px-4 py-3.5 text-center">
                  <AlertPillLink
                    count={Number(v.out_of_stock)}
                    tone="red"
                    href={outHref}
                    onNavigate={stopRowNav}
                  />
                </td>
                <td className="hidden px-4 py-3.5 font-mono text-xs whitespace-nowrap text-slate-500 sm:table-cell">
                  {new Date(v.imported_at).toLocaleDateString('en-GB')}
                </td>
                <td className="px-2 py-3.5 text-right">
                  <Link
                    href={href}
                    onClick={stopRowNav}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-blue-600 opacity-0 transition group-hover:opacity-100 hover:bg-brand-blue-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
                    aria-label={`Open ${v.name} inventory`}
                  >
                    →
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
