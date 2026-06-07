import Link from 'next/link';
import type { ReactNode } from 'react';

export type AnalyticsTableColumn<T> = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
};

export function AnalyticsDataTable<T>({
  title,
  subtitle,
  href,
  hrefLabel = 'View all',
  columns,
  rows,
  emptyMessage = 'No data yet.',
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  columns: AnalyticsTableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="text-xs font-medium text-brand-blue-600 hover:underline">
            {hrefLabel}
          </Link>
        )}
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2 ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/80">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2.5 text-slate-800 ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}
