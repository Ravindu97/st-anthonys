import Link from 'next/link';
import { formatLkr } from '@/lib/format';
import { alertsUrl, vendorInventoryUrl } from '@/lib/inventory-url';

type Props = {
  lowStock: number;
  outOfStock: number;
  atRiskValue: number;
  varianceCount?: number;
  topVendor?: { slug: string; name: string; low_stock: number; out_of_stock: number };
};

export function AlertStrip({
  lowStock,
  outOfStock,
  atRiskValue,
  varianceCount = 0,
  topVendor,
}: Props) {
  const total = lowStock + outOfStock;
  if (total === 0 && varianceCount === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-brand-gold-100 bg-brand-gold-50/80 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-brand-gold-900">
        Attention needed
        {atRiskValue > 0 && (
          <span className="ml-2 font-mono text-brand-gold-800">
            {formatLkr(atRiskValue)} at risk
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {lowStock > 0 && (
          <Link
            href={alertsUrl('low')}
            className="rounded-full border border-brand-gold-200 bg-white px-3 py-1 text-sm font-medium text-brand-gold-800 hover:bg-brand-gold-50"
          >
            Low: {lowStock.toLocaleString()}
          </Link>
        )}
        {outOfStock > 0 && (
          <Link
            href={alertsUrl('out')}
            className="rounded-full border border-red-200 bg-white px-3 py-1 text-sm font-medium text-red-800 hover:bg-red-50"
          >
            Out: {outOfStock.toLocaleString()}
          </Link>
        )}
        {varianceCount > 0 && (
          <Link
            href={alertsUrl('variance')}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Value mismatches: {varianceCount.toLocaleString()}
          </Link>
        )}
        <Link
          href={alertsUrl('new_outs')}
          className="rounded-full border border-brand-blue-200 bg-white px-3 py-1 text-sm font-medium text-brand-blue-700 hover:bg-brand-blue-50"
        >
          New outs since import
        </Link>
        {topVendor && (topVendor.low_stock > 0 || topVendor.out_of_stock > 0) && (
          <Link
            href={vendorInventoryUrl(topVendor.slug, {
              status: topVendor.out_of_stock >= topVendor.low_stock ? 'out_of_stock' : 'low_stock',
              sort: 'value_desc',
            })}
            className="text-sm text-brand-blue-600 hover:underline"
          >
            Worst: {topVendor.name}
          </Link>
        )}
      </div>
    </div>
  );
}
