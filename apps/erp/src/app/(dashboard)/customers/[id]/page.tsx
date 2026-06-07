import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { getCustomer } from '@/lib/customers';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Customers', href: '/customers' },
          { label: customer.name },
        ]}
      />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900">{customer.name}</h1>
        <p className="mt-1 font-mono text-sm text-slate-500">{customer.code}</p>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
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
      </dl>
    </div>
  );
}
