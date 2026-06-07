import Link from 'next/link';
import { reorderHubUrl } from '@/lib/reorder-url';

export function ReorderPagination({
  page,
  pageSize,
  totalCount,
  tab,
  q,
  vendor,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  tab: string;
  q?: string;
  vendor?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Showing <span className="font-mono font-semibold">{from}</span>–
        <span className="font-mono font-semibold">{to}</span> of{' '}
        <span className="font-mono font-semibold">{totalCount.toLocaleString()}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {page > 1 && (
          <Link
            href={reorderHubUrl({ tab, q, vendor, page: page - 1 })}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Previous
          </Link>
        )}
        {pages.map((p) => (
          <Link
            key={p}
            href={reorderHubUrl({ tab, q, vendor, page: p })}
            className={`min-w-9 rounded-lg px-2 py-1.5 text-center text-sm font-medium ${
              p === page
                ? 'bg-brand-blue-500 text-white'
                : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {p}
          </Link>
        ))}
        {page < totalPages && (
          <Link
            href={reorderHubUrl({ tab, q, vendor, page: page + 1 })}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
