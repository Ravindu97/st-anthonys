'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { href: '/', label: 'Dashboard', short: 'Home', icon: HomeIcon },
  { href: '/inventory', label: 'Inventory hub', short: 'Stock', icon: BoxesIcon },
  { href: '/inventory/alerts', label: 'Alert center', short: 'Alerts', icon: AlertIcon },
] as const;

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
};

function isNavItemActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/inventory/alerts') return pathname.startsWith('/inventory/alerts');
  if (href === '/inventory') {
    return (
      pathname === '/inventory' ||
      (pathname.startsWith('/inventory/') && !pathname.startsWith('/inventory/alerts'))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const showLabels = !collapsed || mobileOpen;

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
          {nav.map((item) => {
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
