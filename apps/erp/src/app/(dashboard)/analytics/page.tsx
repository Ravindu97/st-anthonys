import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import {
  getAnalyticsSummary,
  getCustomerOrderGaps,
  getDeadStock,
  getMarginAnalytics,
  getVelocityAnalytics,
  listDeliverySchedules,
} from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const [summary, margin, dead, velocity, gaps, deliveries] = await Promise.all([
    getAnalyticsSummary(),
    getMarginAnalytics(15),
    getDeadStock(15),
    getVelocityAnalytics(15),
    getCustomerOrderGaps(),
    listDeliverySchedules(),
  ]);

  return (
    <div className="space-y-8">
      <PageBreadcrumbs items={[{ label: 'Analytics' }]} />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Margin, dead stock, velocity, and customer activity
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="SKUs with margin data" value={summary.skus_with_margin} />
        <StatCard
          label="Dead stock lines"
          value={summary.dead_stock_count}
          sub={`Value ${summary.dead_stock_value.toLocaleString()}`}
        />
        <StatCard label="Active velocity items" value={summary.active_velocity_items} />
        <StatCard label="Inactive customers (90d)" value={summary.inactive_customers} />
      </section>

      <AnalyticsTable
        title="Top margins"
        headers={['Item', 'Category', 'Cost', 'Avg sell', 'Margin %']}
        rows={margin.map((m) => [
          m.item_name,
          m.category_name,
          m.cost_rate ?? '—',
          m.avg_sell_rate ?? '—',
          m.margin_pct != null ? `${m.margin_pct}%` : '—',
        ])}
      />

      <AnalyticsTable
        title="Dead stock (60+ days no movement)"
        headers={['SKU', 'Item', 'Location', 'Qty', 'Value', 'Days idle']}
        rows={dead.map((d) => [
          d.primary_sku ?? '—',
          d.item_name,
          d.location_name,
          d.quantity,
          d.value ?? '—',
          d.days_since_movement,
        ])}
      />

      <AnalyticsTable
        title="Stock velocity (90 days)"
        headers={['SKU', 'Item', 'Movements', 'Qty moved']}
        rows={velocity.map((v) => [
          v.primary_sku ?? '—',
          v.item_name,
          v.movement_count,
          v.total_qty_moved,
        ])}
      />

      <AnalyticsTable
        title="Customers not ordering"
        headers={['Code', 'Name', 'Days since order']}
        rows={gaps.map((g) => [
          g.code,
          g.name,
          g.days_since_order ?? 'Never',
        ])}
      />

      {deliveries.length > 0 && (
        <AnalyticsTable
          title="Delivery schedule"
          headers={['Order', 'Customer', 'Date', 'Driver', 'Status']}
          rows={deliveries.map((d) => [
            d.doc_number,
            d.customer_name ?? '—',
            d.scheduled_date,
            d.driver_name ?? '—',
            d.status,
          ])}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function AnalyticsTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: unknown[][];
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-800 mb-2">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2">
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-4 text-sm text-slate-500">No data yet.</p>
        )}
      </div>
    </section>
  );
}
