'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export function PricingSearchToolbar({
  levels,
  canWrite,
}: {
  levels: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeLevel = searchParams.get('level') ?? '';

  function setLevel(level: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (level) next.set('level', level);
    else next.delete('level');
    next.delete('page');
    router.push(`/pricing?${next.toString()}`);
  }

  function clearFilter() {
    router.push('/pricing');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLevel('')}
          className={`rounded-lg border px-3 py-2 text-sm ${
            !activeLevel
              ? 'border-brand-blue-500 bg-brand-blue-50 text-brand-blue-800'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          All levels
        </button>
        {levels.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLevel(l.name)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              activeLevel === l.name
                ? 'border-brand-blue-500 bg-brand-blue-50 text-brand-blue-800'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {l.name}
          </button>
        ))}
        {activeLevel && (
          <button
            type="button"
            onClick={clearFilter}
            className="px-2 py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </div>
      {canWrite && (
        <p className="text-xs text-slate-500">
          Import a Tally CSV below, or open a list to add individual price exceptions.
        </p>
      )}
    </div>
  );
}

export function PricingLevelCards({
  levels,
  activeLevel,
}: {
  levels: { name: string }[];
  activeLevel: string;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {levels.map((l) => (
        <Link
          key={l.name}
          href={activeLevel === l.name ? '/pricing' : `/pricing?level=${encodeURIComponent(l.name)}`}
          className={`rounded-xl border px-4 py-3 transition-colors ${
            activeLevel === l.name
              ? 'border-brand-blue-500 bg-brand-blue-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-xs text-slate-500">Price level</p>
          <p className="font-medium text-slate-900">{l.name}</p>
        </Link>
      ))}
    </section>
  );
}
