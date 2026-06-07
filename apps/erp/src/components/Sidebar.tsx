'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Permission, Role } from '@/lib/auth/permissions';
import { hasPermission, isAdminRole } from '@/lib/auth/permissions';

const nav: Array<{
  href: string;
  label: string;
  short: string;
  icon: typeof HomeIcon;
  permission?: Permission;
}> = [
  { href: '/', label: 'Dashboard', short: 'Home', icon: HomeIcon },
  { href: '/inventory', label: 'Inventory hub', short: 'Stock', icon: BoxesIcon },
  { href: '/inventory/alerts', label: 'Alert center', short: 'Alerts', icon: AlertIcon },
  { href: '/inventory/reorder', label: 'Reorder', short: 'Reorder', icon: ReorderIcon },
  { href: '/pricing', label: 'Pricing', short: 'Price', icon: TagIcon, permission: 'pricing:read' },
  { href: '/customers', label: 'Customers', short: 'CRM', icon: UsersIcon },
  { href: '/orders', label: 'Sales', short: 'Sales', icon: OrdersIcon },
  { href: '/purchasing', label: 'Purchasing', short: 'PO', icon: TruckIcon },
  { href: '/pos', label: 'POS counter', short: 'POS', icon: PosIcon, permission: 'pos:read' },
];

const adminNav = [
  { href: '/import', label: 'Tally import', short: 'Import', icon: ImportIcon },
  { href: '/admin/analytics', label: 'Analytics', short: 'BI', icon: ChartIcon },
  { href: '/admin/audit', label: 'Activity log', short: 'Audit', icon: AuditIcon },
] as const;

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
  userRole?: Role;
};

function isNavItemActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/admin/audit') return pathname.startsWith('/admin/audit');
  if (href === '/admin/analytics') return pathname.startsWith('/admin/analytics');
  if (href === '/import') return pathname.startsWith('/import');
  if (href === '/inventory/alerts') return pathname.startsWith('/inventory/alerts');
  if (href === '/inventory/reorder') return pathname.startsWith('/inventory/reorder');
  if (href === '/inventory') {
    return (
      pathname === '/inventory' ||
      (pathname.startsWith('/inventory/') &&
        !pathname.startsWith('/inventory/alerts') &&
        !pathname.startsWith('/inventory/reorder'))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapse,
  userRole,
}: SidebarProps) {
  const pathname = usePathname();
  const showLabels = !collapsed || mobileOpen;
  const showAdmin = userRole ? isAdminRole(userRole) : false;
  const visibleNav = nav.filter(
    (item) => !item.permission || (userRole && hasPermission(userRole, item.permission))
  );

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-brand-blue-700 bg-slate-900 transition-[width,transform] duration-200 ease-out',
        'lg:static lg:z-auto lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        collapsed ? 'w-60 lg:w-[4.25rem]' : 'w-60',
      ].join(' ')}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-between border-b border-brand-blue-700 px-3 py-4">
        {showLabels ? (
          <p className="truncate px-1 font-display text-xs font-semibold tracking-widest text-brand-blue-100 uppercase">
            Menu
          </p>
        ) : (
          <span className="sr-only">Menu</span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white lg:inline-flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <span className="text-xl leading-none">×</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {visibleNav.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed && !mobileOpen ? item.label : undefined}
                onClick={onCloseMobile}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-blue-500 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                } ${!showLabels ? 'justify-center px-2' : ''}`}
              >
                <Icon className="h-5 w-5 shrink-0 opacity-90" />
                {showLabels && <span className="truncate">{item.label}</span>}
                {active && showLabels && (
                  <span
                    className="absolute top-1.5 bottom-1.5 right-0 w-1 rounded-l bg-brand-gold-500"
                    aria-hidden
                  />
                )}
                {active && !showLabels && (
                  <span
                    className="absolute -right-px top-1/2 h-6 w-1 -translate-y-1/2 rounded-l bg-brand-gold-500"
                    aria-hidden
                  />
                )}
              </Link>
            );
          })}
        </div>

        {showAdmin && (
          <div className="mt-4 border-t border-brand-blue-700 pt-3">
            {showLabels && (
              <p className="mb-2 px-3 font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                Admin
              </p>
            )}
            <div className="space-y-1">
              {adminNav.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed && !mobileOpen ? item.label : undefined}
                    onClick={onCloseMobile}
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-blue-500 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    } ${!showLabels ? 'justify-center px-2' : ''}`}
                  >
                    <Icon className="h-5 w-5 shrink-0 opacity-90" />
                    {showLabels && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div
        className={`border-t border-brand-blue-700 p-3 ${!showLabels ? 'text-center' : ''}`}
      >
        {showLabels ? (
          <>
            <p className="font-mono text-[10px] text-slate-500">Tally sync</p>
            <span className="mt-1 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400">Live</span>
            </span>
          </>
        ) : (
          <span
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400"
            title="Tally sync live"
          />
        )}
      </div>
    </aside>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeWidth={2}
        d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
      />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}

function BoxesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

function ReorderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v6h6M20 20v-6h-6M20 8A8 8 0 004 16" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 7h.01M3 11l8.5 8.5a2 2 0 002.83 0l6.17-6.17a2 2 0 000-2.83L12 2 3 11z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H2v-2a4 4 0 014-4h1a4 4 0 014 4v2zm4-10a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0h4m-4 0a2 2 0 11-4 0m6 0a2 2 0 11-4 0M3 16h10" />
    </svg>
  );
}

function PosIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v9a2 2 0 002 2z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0H7m8-10v10m0-10a2 2 0 012-2h2a2 2 0 012 2v10" />
    </svg>
  );
}

function ImportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
    </svg>
  );
}

function AuditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
