'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { Sidebar } from '@/components/Sidebar';
import type { Role } from '@/lib/auth/permissions';

const STORAGE_KEY = 'erp-sidebar-collapsed';

type MeUser = { id: string; email: string; role: Role };

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<MeUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.user) setUser(data.user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }, [router]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex min-h-screen min-h-[100dvh]">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-[2px] lg:hidden"
          onClick={closeMobile}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onToggleCollapse={toggleCollapsed}
        userRole={user?.role}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-brand-blue-600 bg-brand-blue-500 px-3 py-2.5 shadow-sm sm:gap-3 sm:px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10 lg:hidden"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <div className="min-w-0 flex-1">
            <BrandLogo compact />
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm text-white/90">
            {user && (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="max-w-[10rem] truncate text-xs text-white/90">
                  {user.email}
                </span>
                <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  {user.role}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="rounded-md border border-white/25 px-2 py-1 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-60"
            >
              {signingOut ? '…' : 'Sign out'}
            </button>
            <span className="rounded-md bg-white/15 px-2 py-1 font-mono text-[10px] sm:text-xs">
              FY 26
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
