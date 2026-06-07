import { redirect } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { hasPermission } from '@/lib/auth/permissions';
import { getSessionFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function NewCustomerPage() {
  const session = await getSessionFromCookies();
  if (!session || !hasPermission(session.role, 'customers:write')) {
    redirect('/customers');
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Customers', href: '/customers' },
          { label: 'Add customer' },
        ]}
      />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
          Add customer
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Name and phone are enough to get started — code is assigned automatically.
        </p>
      </header>

      <CustomerForm mode="create" cancelHref="/customers" />
    </div>
  );
}
