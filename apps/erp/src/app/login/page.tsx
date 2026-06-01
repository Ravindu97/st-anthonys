'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const forbidden = searchParams.get('error') === 'forbidden';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    forbidden ? 'You do not have permission to access that page.' : null
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return;
      }
      router.push(next.startsWith('/') ? next : '/');
      router.refresh();
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div
            className="grid h-10 w-10 grid-cols-2 gap-0.5"
            aria-hidden
          >
            <span className="bg-brand-blue-600" />
            <span className="bg-brand-gold-500" />
            <span className="bg-emerald-500" />
            <span className="bg-slate-200" />
          </div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            Sign in
          </h1>
          <p className="text-center text-sm text-slate-600">
            St. Anthony&apos;s ERP — inventory &amp; operations
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-blue-700 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
