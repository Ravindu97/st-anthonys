import Link from 'next/link';
import { Suspense } from 'react';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { CreateSalesDocumentForm } from '@/components/sales/CreateSalesDocumentForm';
import { TablePagination } from '@/components/TablePagination';
import { SalesHubToolbar } from '@/components/sales/SalesHubToolbar';
import { hasPermission } from '@/lib/auth/permissions';
import { getSessionFromCookies } from '@/lib/auth/session';
import { formatLkr } from '@/lib/format';
import { listFulfillmentLocations } from '@/lib/sales';
import { listSalesHub, type SalesHubChannel } from '@/lib/sales-hub';

export const dynamic = 'force-dynamic';

const CHANNELS: { id: SalesHubChannel; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'counter', label: 'Counter (POS)' },
  { id: 'pickup', label: 'Pickup' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'quote', label: 'Quotes' },
];

const DOC_STATUSES = [
  'draft',
  'confirmed',
  'picking',
  'ready_for_pickup',
  'collected',
  'delivered',
  'cancelled',
] as const;

function channelLabel(channel: string) {
  if (channel === 'counter') return 'Counter';
  if (channel === 'quote') return 'Quote';
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

function detailHref(source: string, id: string) {
  return source === 'pos' ? `/orders/pos/${id}` : `/orders/${id}`;
}

function printHref(source: string, id: string) {
  return source === 'pos' ? `/orders/pos/${id}/print` : `/orders/${id}/print`;
}

function buildQuery(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
) {
  const next = new URLSearchParams();
  const merged = { ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v && k !== 'page') next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `?${qs}` : '';
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    channel?: string;
    status?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const session = await getSessionFromCookies();
  const canSales = session ? hasPermission(session.role, 'sales:read') : false;
  const canPos = session ? hasPermission(session.role, 'pos:read') : false;

  const channel = (CHANNELS.some((c) => c.id === sp.channel)
    ? sp.channel
    : 'all') as SalesHubChannel;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  const locations = canSales ? await listFulfillmentLocations() : [];

  const result = await listSalesHub({
    channel,
    q: sp.q,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    status: sp.status,
    page,
    includeDocuments: canSales,
    includePos: canPos,
  });

  const showStatusFilters = channel !== 'counter' && canSales;
  const queryBase = {
    channel: channel !== 'all' ? channel : undefined,
    q: sp.q,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    status: sp.status,
  };

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: 'Sales' }]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            Sales &amp; receipts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Counter sales (TXN), click-and-collect orders (SO), and contractor quotes (QT)
          </p>
        </div>
        {canSales && (
          <Link
            href="#create-sales"
            className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600"
          >
            New quote / order
          </Link>
        )}
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {CHANNELS.map((c) => {
          if (c.id !== 'counter' && c.id !== 'all' && !canSales) return null;
          if (c.id === 'counter' && !canPos) return null;
          return (
            <Link
              key={c.id}
              href={`/orders${buildQuery(queryBase, { channel: c.id === 'all' ? undefined : c.id, status: undefined })}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                channel === c.id
                  ? 'bg-brand-blue-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </nav>

      <Suspense fallback={null}>
        <SalesHubToolbar />
      </Suspense>

      {showStatusFilters && (
        <nav className="flex flex-wrap gap-2">
          <Link
            href={`/orders${buildQuery(queryBase, { status: undefined })}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              !sp.status ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All statuses
          </Link>
          {DOC_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/orders${buildQuery(queryBase, { status: s })}`}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                sp.status === s ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s.replace(/_/g, ' ')}
            </Link>
          ))}
        </nav>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Doc #</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.items.map((row) => (
              <tr key={`${row.source}-${row.id}`} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link
                    href={detailHref(row.source, row.id)}
                    className="text-brand-blue-600 hover:underline"
                  >
                    {row.docNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{channelLabel(row.channel)}</td>
                <td className="px-4 py-2">{row.customerName ?? 'Walk-in'}</td>
                <td className="px-4 py-2 capitalize">{row.status.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2 capitalize">{row.paymentMethod ?? '—'}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{row.locationName ?? '—'}</td>
                <td className="px-4 py-2 text-right font-mono">{formatLkr(row.total)}</td>
                <td className="px-4 py-2 text-right">{row.lineCount}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link
                      href={detailHref(row.source, row.id)}
                      className="text-brand-blue-600 hover:underline"
                    >
                      View
                    </Link>
                    <Link
                      href={printHref(row.source, row.id)}
                      className="text-slate-600 hover:underline"
                    >
                      Print
                    </Link>
                    {row.source === 'document' &&
                      ['confirmed', 'picking', 'ready_for_pickup'].includes(row.status) && (
                        <Link
                          href={`/orders/${row.id}/pick`}
                          className="text-slate-600 hover:underline"
                        >
                          Pick
                        </Link>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {result.items.length === 0 && (
          <div className="px-4 py-8 text-sm text-slate-500 space-y-2">
            <p>No records match your filters.</p>
            {channel === 'counter' && (
              <p>
                Counter sales are created at the{' '}
                <Link href="/pos" className="text-brand-blue-600 hover:underline">
                  POS counter
                </Link>
                .
              </p>
            )}
            {(channel === 'pickup' || channel === 'delivery' || channel === 'quote') && canSales && (
              <p>
                Create a new document with the{' '}
                <a href="#create-sales" className="text-brand-blue-600 hover:underline">
                  form below
                </a>
                .
              </p>
            )}
          </div>
        )}

        <TablePagination
          basePath="/orders"
          page={result.page}
          pageSize={result.pageSize}
          totalCount={result.totalCount}
          searchParams={queryBase}
        />
      </div>

      {canSales && locations.length > 0 && (
        <CreateSalesDocumentForm locations={locations} />
      )}
    </div>
  );
}
