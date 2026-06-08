import Link from 'next/link';
import { AnalyticsDataTable } from '@/components/analytics/AnalyticsDataTable';
import { AnalyticsSalesTrend } from '@/components/analytics/AnalyticsSalesTrend';
import { OperationsAttentionStrip } from '@/components/dashboard/OperationsAttentionStrip';
import { OperationsKpiStrip } from '@/components/dashboard/OperationsKpiStrip';
import { OperationsQuickActions } from '@/components/dashboard/OperationsQuickActions';
import { OperationsVendorRisk } from '@/components/dashboard/OperationsVendorRisk';
import { getSessionFromCookies, isAdminRole } from '@/lib/auth';
import { getOperationsDashboard } from '@/lib/dashboard';
import { formatLkr } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSessionFromCookies();
  const isAdmin = session ? isAdminRole(session.role) : false;

  let data: Awaited<ReturnType<typeof getOperationsDashboard>> | null = null;
  let error: string | null = null;

  try {
    data = await getOperationsDashboard();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Database unavailable';
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Operations Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Today&apos;s exceptions, sales pulse, and inventory health
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/analytics"
            className="text-sm font-medium text-brand-blue-600 hover:underline"
          >
            Full analytics →
          </Link>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-brand-gold-100 bg-brand-gold-50 px-4 py-3 text-sm text-brand-gold-700">
          {error}. Run{' '}
          <code className="font-mono text-xs">npm run db:setup</code> and imports from the
          project root.
        </div>
      )}

      {data && (
        <>
          <OperationsAttentionStrip attention={data.attention} />
          <OperationsKpiStrip kpis={data.kpis} />

          <div className="grid gap-6 lg:grid-cols-2">
            <AnalyticsSalesTrend points={data.salesTrend} days={7} />
            <AnalyticsDataTable
              title="Revenue by channel"
              subtitle="Last 7 days"
              href="/orders"
              columns={[
                { key: 'channel', header: 'Channel', render: (r) => r.channel },
                {
                  key: 'revenue',
                  header: 'Revenue',
                  align: 'right',
                  render: (r) => formatLkr(r.revenue),
                },
                {
                  key: 'orders',
                  header: 'Orders',
                  align: 'right',
                  render: (r) => r.order_count,
                },
                {
                  key: 'share',
                  header: 'Share',
                  align: 'right',
                  render: (r) => `${r.share_pct}%`,
                },
              ]}
              rows={data.channelMix}
              emptyMessage="No sales in the last 7 days."
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <OperationsVendorRisk vendors={data.topVendorRisks} />
            <AnalyticsDataTable
              title="Top customers"
              subtitle="By revenue — last 7 days"
              href="/customers"
              columns={[
                {
                  key: 'code',
                  header: 'Code',
                  render: (r) => (
                    <Link
                      href={`/customers/${r.customer_id}`}
                      className="font-mono text-xs text-brand-blue-600 hover:underline"
                    >
                      {r.code}
                    </Link>
                  ),
                },
                { key: 'name', header: 'Name', render: (r) => r.name },
                {
                  key: 'revenue',
                  header: 'Revenue',
                  align: 'right',
                  render: (r) => formatLkr(r.revenue),
                },
                {
                  key: 'orders',
                  header: 'Orders',
                  align: 'right',
                  render: (r) => r.order_count,
                },
              ]}
              rows={data.topCustomers}
              emptyMessage="No customer-linked sales in the last 7 days."
            />
          </div>

          <OperationsQuickActions />
        </>
      )}
    </div>
  );
}
