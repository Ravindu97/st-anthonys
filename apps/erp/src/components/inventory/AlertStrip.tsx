import Link from 'next/link';
import { formatLkr } from '@/lib/format';
import { alertsUrl, vendorInventoryUrl } from '@/lib/inventory-url';

type Chip = {
  href: string;
  label: string;
  tone: 'amber' | 'red' | 'slate' | 'blue';
};

function ChipLink({ href, label, tone }: Chip) {
  const styles = {
    amber:
      'border-brand-gold-200 bg-brand-gold-50 text-brand-gold-900 hover:bg-brand-gold-100',
    red: 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100',
    slate: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    blue: 'border-brand-blue-200 bg-brand-blue-50 text-brand-blue-800 hover:bg-brand-blue-100',
  };
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${styles[tone]}`}
    >
      {label}
    </Link>
  );
}

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
  const chips: Chip[] = [];
  if (lowStock > 0) {
    chips.push({
      href: alertsUrl('low'),
      label: `Low stock (${lowStock.toLocaleString()})`,
      tone: 'amber',
    });
  }
  if (outOfStock > 0) {
    chips.push({
      href: alertsUrl('out'),
      label: `Out of stock (${outOfStock.toLocaleString()})`,
      tone: 'red',
    });
  }
  if (varianceCount > 0) {
    chips.push({
      href: alertsUrl('variance'),
      label: `Qty × rate check (${varianceCount.toLocaleString()})`,
      tone: 'slate',
    });
  }
  chips.push({
    href: alertsUrl('new_outs'),
    label: 'New outs since import',
    tone: 'blue',
  });
  if (topVendor && (topVendor.low_stock > 0 || topVendor.out_of_stock > 0)) {
    chips.push({
      href: vendorInventoryUrl(topVendor.slug, {
        status:
          topVendor.out_of_stock >= topVendor.low_stock ? 'out_of_stock' : 'low_stock',
        sort: 'value_desc',
        tab: 'stock',
      }),
      label: `${topVendor.name} — highest risk`,
      tone: 'blue',
    });
  }

  if (chips.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
      aria-label="Inventory alerts"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Alerts
          </p>
          {atRiskValue > 0 && (
            <p className="mt-0.5 text-sm text-slate-600">
              <span className="font-mono font-semibold text-slate-900">
                {formatLkr(atRiskValue)}
              </span>{' '}
              on low + out lines
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-[65%] lg:justify-end">
          {chips.map((c) => (
            <ChipLink key={c.label} {...c} />
          ))}
        </div>
      </div>
    </section>
  );
}
