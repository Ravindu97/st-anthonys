import Link from 'next/link';

const actions: { href: string; label: string; primary?: boolean }[] = [
  { href: '/inventory', label: 'Inventory hub', primary: true },
  { href: '/inventory/alerts', label: 'Alert center' },
  { href: '/inventory/reorder', label: 'Reorder' },
  { href: '/orders', label: 'Sales' },
  { href: '/purchasing', label: 'Purchasing' },
  { href: '/pos', label: 'POS counter' },
  { href: '/customers', label: 'Customers' },
];

export function OperationsQuickActions() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
      <h2 className="font-display text-sm font-semibold text-slate-900">Quick actions</h2>
      <p className="mt-0.5 text-xs text-slate-500">Jump to daily workflows</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={
              a.primary
                ? 'rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600'
                : 'rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
            }
          >
            {a.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
