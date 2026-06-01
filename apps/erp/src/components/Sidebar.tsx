'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type VendorNavItem = {
  code: string;
  name: string;
  slug: string;
};

const staticNav = [
  { href: '/', label: 'Dashboard' },
  { href: '/inventory', label: 'Inventory hub' },
];

export function Sidebar({ vendors = [] }: { vendors?: VendorNavItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-brand-blue-700 bg-slate-900">
      <div className="border-b border-brand-blue-700 px-4 py-5">
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-brand-blue-100">
          Navigation
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5">
          {staticNav.map((item) => {
            const active = pathname === item.href;
            return (
              <NavLink key={item.href} href={item.href} active={active}>
                {item.label}
              </NavLink>
            );
          })}
        </div>

        {vendors.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 px-3 font-mono text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              Vendors
            </p>
            <div className="space-y-0.5">
              {vendors.map((v) => {
                const href = `/inventory/${v.slug}`;
                const active = pathname === href;
                return (
                  <NavLink key={v.code} href={href} active={active} nested>
                    {v.name}
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </nav>
      <div className="border-t border-brand-blue-700 p-4">
        <p className="font-mono text-[10px] text-slate-500">Tally sync enabled</p>
        <span className="mt-1 inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400">Live import</span>
        </span>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  active,
  nested,
  children,
}: {
  href: string;
  active: boolean;
  nested?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`relative block rounded-lg py-2.5 text-sm font-medium transition-colors ${
        nested ? 'px-3 pl-5' : 'px-3'
      } ${
        active
          ? 'bg-brand-blue-500 text-white'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {active && (
        <span
          className="absolute top-1 bottom-1 right-0 w-1 rounded-l bg-brand-gold-500"
          aria-hidden
        />
      )}
      {children}
    </Link>
  );
}
