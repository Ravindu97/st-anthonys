import Link from 'next/link';
import { formatLkr } from '@/lib/format';
import type { VendorRiskRow } from '@/lib/dashboard-shared';

export function OperationsVendorRisk({ vendors }: { vendors: VendorRiskRow[] }) {
  if (vendors.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="font-display text-sm font-semibold text-slate-900">Top vendor risks</h2>
        <p className="mt-0.5 text-xs text-slate-500">Highest at-risk inventory value by category</p>
      </header>
      <ul className="divide-y divide-slate-50">
        {vendors.map((v) => (
          <li key={v.slug}>
            <Link
              href={`/inventory/${v.slug}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{v.name}</p>
                <p className="text-xs text-slate-500">
                  {v.low_stock} low · {v.out_of_stock} out · {v.risk_pct}% at risk
                </p>
              </div>
              <span className="font-mono text-sm font-semibold text-slate-800">
                {formatLkr(v.at_risk_value)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <footer className="border-t border-slate-100 px-4 py-2">
        <Link href="/inventory" className="text-xs font-medium text-brand-blue-600 hover:underline">
          View all vendors
        </Link>
      </footer>
    </section>
  );
}
