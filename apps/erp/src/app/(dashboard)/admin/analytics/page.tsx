import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AnalyticsAlertsStrip } from '@/components/analytics/AnalyticsAlertsStrip';
import { AnalyticsDataTable } from '@/components/analytics/AnalyticsDataTable';
import { AnalyticsKpiStrip } from '@/components/analytics/AnalyticsKpiStrip';
import { AnalyticsSalesTrend } from '@/components/analytics/AnalyticsSalesTrend';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { isAdminRole } from '@/lib/auth/permissions';
import { getSessionFromCookies } from '@/lib/auth/session';
import { getAnalyticsDashboard } from '@/lib/analytics';
import { formatLkr, formatLkrAmount } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  const session = await getSessionFromCookies();
  if (!session || !isAdminRole(session.role)) {
    redirect('/inventory?error=forbidden');
  }

  const data = await getAnalyticsDashboard();

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Admin', href: '/admin/audit' },
          { label: 'Analytics' },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            Leadership analytics
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Revenue, inventory health, and customer signals — designed for exception-based
            decisions. Counter and office sales combined; drill down via links.
          </p>
        </div>
        <p className="text-xs text-slate-400">
          Rolling 30-day KPIs · Updated on page load
        </p>
      </header>

      <AnalyticsKpiStrip kpis={data.kpis} />
      <AnalyticsAlertsStrip alerts={data.alerts} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsSalesTrend points={data.salesTrend} />

        <AnalyticsDataTable
          title="Revenue by channel"
          subtitle="Last 30 days"
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
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsDataTable
          title="Top customers"
          subtitle="By revenue — last 30 days"
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
          emptyMessage="No customer-linked sales in the last 30 days."
        />

        <AnalyticsDataTable
          title="Inventory by category"
          subtitle="Stock value mix from latest snapshots"
          href="/inventory"
          columns={[
            {
              key: 'category',
              header: 'Category',
              render: (r) => (
                <Link
                  href={`/inventory/${r.category_code.toLowerCase()}`}
                  className="text-brand-blue-600 hover:underline"
                >
                  {r.category_name}
                </Link>
              ),
            },
            {
              key: 'value',
              header: 'Value',
              align: 'right',
              render: (r) => formatLkr(r.total_value),
            },
            {
              key: 'share',
              header: 'Share',
              align: 'right',
              render: (r) => `${r.share_pct}%`,
            },
            {
              key: 'risk',
              header: 'Low / out',
              align: 'right',
              render: (r) => (
                <span className={r.out_of_stock > 0 ? 'text-rose-600' : ''}>
                  {r.low_stock} / {r.out_of_stock}
                </span>
              ),
            },
          ]}
          rows={data.categoryMix}
        />
      </div>

      <AnalyticsDataTable
        title="Best margins"
        subtitle="Cost (snapshot) vs avg sell rate — includes POS and orders"
        columns={[
          {
            key: 'sku',
            header: 'SKU',
            render: (r) =>
              r.primary_sku ? (
                <Link
                  href={`/inventory/${r.vendor_slug}/unit/${encodeURIComponent(r.primary_sku)}`}
                  className="font-mono text-xs text-brand-blue-600 hover:underline"
                >
                  {r.primary_sku}
                </Link>
              ) : (
                '—'
              ),
          },
          { key: 'item', header: 'Item', render: (r) => r.item_name },
          { key: 'cat', header: 'Category', render: (r) => r.category_name },
          {
            key: 'cost',
            header: 'Cost',
            align: 'right',
            render: (r) => (r.cost_rate ? formatLkrAmount(r.cost_rate) : '—'),
          },
          {
            key: 'sell',
            header: 'Avg sell',
            align: 'right',
            render: (r) => (r.avg_sell_rate ? formatLkrAmount(r.avg_sell_rate) : '—'),
          },
          {
            key: 'margin',
            header: 'Margin',
            align: 'right',
            render: (r) =>
              r.margin_pct != null ? (
                <span className="font-medium text-emerald-700">{r.margin_pct}%</span>
              ) : (
                '—'
              ),
          },
        ]}
        rows={data.topMargins}
        emptyMessage="Margin data appears once items have both cost and sales history."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsDataTable
          title="Dead stock watchlist"
          subtitle="On hand with no movement in 60+ days"
          href="/inventory/alerts"
          columns={[
            {
              key: 'sku',
              header: 'SKU',
              render: (r) =>
                r.primary_sku ? (
                  <Link
                    href={`/inventory/${r.vendor_slug}/unit/${encodeURIComponent(r.primary_sku)}`}
                    className="font-mono text-xs text-brand-blue-600 hover:underline"
                  >
                    {r.primary_sku}
                  </Link>
                ) : (
                  '—'
                ),
            },
            { key: 'item', header: 'Item', render: (r) => r.item_name },
            {
              key: 'value',
              header: 'Value',
              align: 'right',
              render: (r) => (r.value ? formatLkr(r.value) : '—'),
            },
            {
              key: 'days',
              header: 'Days idle',
              align: 'right',
              render: (r) => r.days_since_movement,
            },
          ]}
          rows={data.deadStock}
        />

        <AnalyticsDataTable
          title="Fast movers"
          subtitle="Highest qty moved — last 90 days"
          columns={[
            {
              key: 'sku',
              header: 'SKU',
              render: (r) =>
                r.primary_sku ? (
                  <Link
                    href={`/inventory/${r.vendor_slug}/unit/${encodeURIComponent(r.primary_sku)}`}
                    className="font-mono text-xs text-brand-blue-600 hover:underline"
                  >
                    {r.primary_sku}
                  </Link>
                ) : (
                  '—'
                ),
            },
            { key: 'item', header: 'Item', render: (r) => r.item_name },
            {
              key: 'qty',
              header: 'Qty moved',
              align: 'right',
              render: (r) => Number(r.total_qty_moved).toLocaleString(),
            },
            {
              key: 'moves',
              header: 'Movements',
              align: 'right',
              render: (r) => r.movement_count,
            },
          ]}
          rows={data.fastMovers}
        />
      </div>

      <AnalyticsDataTable
        title="At-risk customers"
        subtitle="Active accounts with no order in 90 days — includes POS"
        href="/customers"
        columns={[
          {
            key: 'code',
            header: 'Code',
            render: (r) => (
              <Link
                href={`/customers/${r.id}`}
                className="font-mono text-xs text-brand-blue-600 hover:underline"
              >
                {r.code}
              </Link>
            ),
          },
          { key: 'name', header: 'Name', render: (r) => r.name },
          {
            key: 'lifetime',
            header: 'Lifetime rev.',
            align: 'right',
            render: (r) => formatLkr(r.lifetime_revenue),
          },
          {
            key: 'days',
            header: 'Days idle',
            align: 'right',
            render: (r) => (r.days_since_order != null ? r.days_since_order : 'Never'),
          },
        ]}
        rows={data.customerGaps}
        emptyMessage="All active customers ordered within 90 days."
      />
    </div>
  );
}
