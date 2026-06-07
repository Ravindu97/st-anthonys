'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function OrderActions({
  orderId,
  status,
  docKind,
  canPick,
}: {
  orderId: string;
  status: string;
  docKind: string;
  canPick: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Update failed');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function convertQuote() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'convert_quote' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Convert failed');
      router.push(`/orders/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {docKind === 'quote' && status === 'draft' && (
        <button
          type="button"
          disabled={loading}
          onClick={convertQuote}
          className="rounded-lg bg-brand-blue-500 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Convert to order
        </button>
      )}
      {status === 'draft' && docKind === 'order' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => updateStatus('confirmed')}
          className="rounded-lg bg-brand-blue-500 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Confirm order
        </button>
      )}
      {status === 'confirmed' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => updateStatus('picking')}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Start picking
        </button>
      )}
      {canPick && (
        <Link
          href={`/orders/${orderId}/pick`}
          className="rounded-lg border border-brand-blue-200 bg-brand-blue-50 px-3 py-1.5 text-sm text-brand-blue-700"
        >
          Pick list
        </Link>
      )}
    </div>
  );
}
