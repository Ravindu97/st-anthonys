import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { RecordActivityPanel } from '@/components/audit/RecordActivityPanel';
import { CustomerEditPanel } from '@/components/customers/CustomerEditPanel';
import { getRecordAuditStory } from '@/lib/audit';
import { hasPermission, isAdminRole } from '@/lib/auth/permissions';
import { getSessionFromCookies } from '@/lib/auth/session';
import { formatLkr } from '@/lib/format';
import {
  getCustomer,
  getCustomerRecentSales,
  getCustomerSalesSummary,
} from '@/lib/customers';

export const dynamic = 'force-dynamic';

function saleHref(source: string, id: string) {
  return source === 'pos' ? `/orders/pos/${id}` : `/orders/${id}`;
}

function channelLabel(channel: string) {
  if (channel === 'counter') return 'Counter';
  if (channel === 'quote') return 'Quote';
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionFromCookies();
  const canWrite = session ? hasPermission(session.role, 'customers:write') : false;
  const isAdmin = session ? isAdminRole(session.role) : false;

  const [customer, recentSales, summary, auditEvents] = await Promise.all([
    getCustomer(id),
    getCustomerRecentSales(id, 10),
    getCustomerSalesSummary(id),
    isAdmin ? getRecordAuditStory('customer', id) : Promise.resolve([]),
  ]);
  if (!customer) notFound();

  const formInitial = {
    id: customer.id,
    code: customer.code,
    name: customer.name,
    customerType: customer.customer_type as 'contractor' | 'builder' | 'retail',
    priceLevelId: customer.price_level_id ?? '',
    creditLimit: customer.credit_limit ? String(customer.credit_limit) : '',
    paymentTermsDays: String(customer.payment_terms_days),
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    address: customer.address ?? '',
    isActive: customer.is_active,
  };

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Customers', href: '/customers' },
          { label: customer.name },
        ]}
      />

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-semibold text-slate-900">
            {customer.name}
          </h1>
          {!customer.is_active && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Inactive
            </span>
          )}
        </div>
        <p className="mt-1 font-mono text-sm text-slate-500">{customer.code}</p>
      </header>

      <CustomerEditPanel customer={formInitial} canWrite={canWrite} />

      <div className="grid gap-6 lg:grid-cols-3">
        <dl className="lg:col-span-2 grid gap-4 sm:grid-cols-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div>
            <dt className="text-slate-500">Type</dt>
            <dd className="font-medium capitalize">{customer.customer_type}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Price level</dt>
            <dd className="font-medium">{customer.price_level_name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Credit limit</dt>
            <dd className="font-mono">
              {customer.credit_limit ? Number(customer.credit_limit).toLocaleString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Payment terms</dt>
            <dd>{customer.payment_terms_days} days</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd>{customer.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Phone</dt>
            <dd>{customer.phone ?? '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Address</dt>
            <dd className="whitespace-pre-wrap">{customer.address ?? '—'}</dd>
          </div>
          {customer.updated_at && (
            <div className="sm:col-span-2 text-xs text-slate-400">
              Last updated {new Date(customer.updated_at).toLocaleString()}
            </div>
          )}
        </dl>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-display font-semibold text-slate-900">Sales summary</h2>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-500">Total orders</dt>
              <dd className="font-mono font-medium">{summary.orderCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Last sale</dt>
              <dd>
                {summary.lastSaleAt
                  ? new Date(summary.lastSaleAt).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-4 py-3 font-display font-semibold text-slate-900">
          Recent activity
        </h2>
        {recentSales.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No sales linked to this customer yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2">Document</th>
                  <th className="px-4 py-2">Channel</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSales.map((sale) => (
                  <tr key={`${sale.source}-${sale.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link
                        href={saleHref(sale.source, sale.id)}
                        className="font-mono text-xs text-brand-blue-600 hover:underline"
                      >
                        {sale.docNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 capitalize">{channelLabel(sale.channel)}</td>
                    <td className="px-4 py-2 capitalize text-slate-600">{sale.status}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatLkr(sale.total)}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAdmin && auditEvents.length > 0 && (
        <RecordActivityPanel
          recordLabel={customer.code}
          subtitle="Customer create and update history"
          events={auditEvents}
        />
      )}
    </div>
  );
}
