'use client';

import { useEffect, useState } from 'react';
import { formatLkr } from '@/lib/format';
import type { GatewayPaymentMethod, MockPaymentResult } from '@/lib/payments-shared';

type Step = 'idle' | 'processing' | 'success' | 'declined';

export function PaymentGatewayModal({
  open,
  amount,
  method,
  customerName,
  customerId,
  title,
  onSuccess,
  onCancel,
}: {
  open: boolean;
  amount: number;
  method: GatewayPaymentMethod;
  customerName?: string | null;
  customerId?: string;
  title?: string;
  onSuccess: (result: Extract<MockPaymentResult, { ok: true }>) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>('idle');
  const [cashTendered, setCashTendered] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('idle');
    setCashTendered('');
    setReference('');
    setError(null);
  }, [open, amount, method]);

  if (!open) return null;

  const tendered = Number(cashTendered) || 0;
  const change = Math.max(0, tendered - amount);

  async function runPayment(simulateDecline = false) {
    if (method === 'cash' && tendered < amount) {
      setError('Amount tendered is less than total');
      return;
    }
    if (method === 'account' && !customerId) {
      setError('Attach a customer for account payment');
      return;
    }

    setError(null);
    setStep('processing');
    try {
      const res = await fetch('/api/payments/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          method,
          customerId,
          simulateDecline,
        }),
      });
      const data = (await res.json()) as MockPaymentResult;
      if (!res.ok || !data.ok) {
        setStep('declined');
        setError(!data.ok ? data.error : 'Payment failed');
        return;
      }
      setReference(data.reference);
      setStep('success');
      setTimeout(() => onSuccess(data), 600);
    } catch {
      setStep('declined');
      setError('Could not reach payment service');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-gateway-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Mock payment gateway
            </p>
            <h2 id="payment-gateway-title" className="font-display text-lg font-semibold text-slate-900">
              {title ?? (method === 'card' ? 'Card terminal' : method === 'account' ? 'Account charge' : 'Cash payment')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={step === 'processing'}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="mt-3 text-2xl font-mono font-semibold text-slate-900">{formatLkr(amount)}</p>

        {method === 'card' && step === 'idle' && (
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
              <p className="font-medium text-slate-800">Present card to terminal</p>
              <p className="mt-1 text-xs">Simulated chip / contactless reader</p>
            </div>
            <button
              type="button"
              onClick={() => runPayment(false)}
              className="w-full rounded-lg bg-brand-blue-500 py-2.5 text-sm font-medium text-white hover:bg-brand-blue-600"
            >
              Simulate card tap
            </button>
            <button
              type="button"
              onClick={() => runPayment(true)}
              className="w-full rounded-lg border border-slate-200 py-2 text-xs text-slate-500 hover:bg-slate-50"
            >
              Simulate decline (test)
            </button>
          </div>
        )}

        {method === 'account' && step === 'idle' && (
          <div className="mt-4 space-y-3 text-sm">
            <p className="rounded-lg bg-brand-blue-50 px-3 py-2 text-brand-blue-900">
              Charge <span className="font-semibold">{formatLkr(amount)}</span> to{' '}
              <span className="font-medium">{customerName ?? 'customer account'}</span>?
            </p>
            {!customerId && (
              <p className="text-red-600 text-xs">A customer must be attached before account payment.</p>
            )}
            <button
              type="button"
              disabled={!customerId}
              onClick={() => runPayment(false)}
              className="w-full rounded-lg bg-brand-blue-500 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Approve account charge
            </button>
          </div>
        )}

        {method === 'cash' && step === 'idle' && (
          <div className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Cash tendered</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono"
                autoFocus
              />
            </label>
            {tendered >= amount && (
              <p className="text-slate-600">
                Change: <span className="font-mono font-semibold">{formatLkr(change)}</span>
              </p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              onClick={() => runPayment(false)}
              className="w-full rounded-lg bg-brand-gold-500 py-2.5 text-sm font-semibold text-slate-900"
            >
              Confirm cash received
            </button>
          </div>
        )}

        {step === 'processing' && (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-sm text-slate-600">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue-500 border-t-transparent" />
            <p>Processing payment…</p>
          </div>
        )}

        {step === 'success' && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-medium">Payment approved</p>
            <p className="mt-1 font-mono text-xs">{reference}</p>
          </div>
        )}

        {step === 'declined' && (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error ?? 'Payment declined'}
            </p>
            <button
              type="button"
              onClick={() => setStep('idle')}
              className="w-full rounded-lg border border-slate-200 py-2 text-sm hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        )}

        <p className="mt-4 text-[10px] text-slate-400 text-center">
          Demo gateway — no real card processing. Replace with live provider later.
        </p>
      </div>
    </div>
  );
}
