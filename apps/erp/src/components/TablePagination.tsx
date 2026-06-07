import Link from 'next/link';

export function tablePageHref(
  basePath: string,
  page: number,
  searchParams: Record<string, string | undefined> = {}
) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v && k !== 'page') next.set(k, v);
  }
  if (page > 1) next.set('page', String(page));
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function TablePagination({
  basePath,
  page,
  pageSize,
  totalCount,
  searchParams = {},
}: {
  basePath: string;
  page: number;
  pageSize: number;
  totalCount: number;
  searchParams?: Record<string, string | undefined>;
}) {
  if (totalCount === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-600 sm:text-sm">
        Showing <span className="font-mono font-semibold">{from}</span>–
        <span className="font-mono font-semibold">{to}</span> of{' '}
        <span className="font-mono font-semibold">{totalCount.toLocaleString()}</span>
        {totalPages > 1 && (
          <span className="text-slate-400">
            {' '}
            · Page {page} of {totalPages}
          </span>
        )}
      </p>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          {page > 1 && (
            <Link
              href={tablePageHref(basePath, page - 1, searchParams)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Previous
            </Link>
          )}
          {pages.map((p) => (
            <Link
              key={p}
              href={tablePageHref(basePath, p, searchParams)}
              className={`min-w-9 rounded-lg px-2 py-1.5 text-center text-sm font-medium ${
                p === page
                  ? 'bg-brand-blue-500 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </Link>
          ))}
          {page < totalPages && (
            <Link
              href={tablePageHref(basePath, page + 1, searchParams)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
