'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PaymentGatewayModal } from '@/components/payments/PaymentGatewayModal';
import { formatLkr } from '@/lib/format';
import type { GatewayPaymentMethod, MockPaymentResult } from '@/lib/payments-shared';

const METHODS: { id: GatewayPaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'account', label: 'Account' },
];

export function CollectPaymentPanel({
  orderId,
  totalAmount,
  customerName,
  customerId,
}: {
  orderId: string;
  totalAmount: number;
  customerName: string | null;
  customerId: string | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<GatewayPaymentMethod>('cash');
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeCollection(reference: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/${orderId}/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_collected',
          paymentMethod: method,
          paymentReference: reference,
        }),
      });
      if (!res.ok) throw new Error('Could not mark order collected');
      router.push(`/orders/${orderId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Collection failed');
    } finally {
      setLoading(false);
    }
  }

  function onPaymentSuccess(result: Extract<MockPaymentResult, { ok: true }>) {
    setGatewayOpen(false);
    completeCollection(result.reference);
  }

  function startCollection() {
    if (method === 'account' && !customerId) {
      setError('Customer required for account payment');
      return;
    }
    setError(null);
    setGatewayOpen(true);
  }

  return (
    <div className="rounded-xl border border-brand-gold-200 bg-brand-gold-50/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Collect payment</h3>
        <p className="text-xs text-slate-500">
          Take payment via mock gateway, then mark order collected.
        </p>
      </div>
      <p className="font-mono text-lg font-semibold">{formatLkr(totalAmount)}</p>
      <div className="flex flex-wrap gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              method === m.id
                ? 'bg-brand-gold-500 text-slate-900'
                : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        disabled={loading}
        onClick={startCollection}
        className="rounded-lg bg-brand-gold-500 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-40"
      >
        {loading ? 'Completing…' : 'Take payment & collect'}
      </button>

      <PaymentGatewayModal
        open={gatewayOpen}
        amount={totalAmount}
        method={method}
        customerName={customerName}
        customerId={customerId ?? undefined}
        title={`Collect — ${customerName ?? 'Walk-in'}`}
        onSuccess={onPaymentSuccess}
        onCancel={() => setGatewayOpen(false)}
      />
    </div>
  );
}
