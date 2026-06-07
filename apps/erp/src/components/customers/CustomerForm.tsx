'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  CUSTOMER_TYPES,
  defaultPriceLevelNameForType,
  type CustomerType,
} from '@/lib/customers-shared';

type PriceLevel = { id: string; name: string };

export type CustomerFormValues = {
  id?: string;
  code?: string;
  name: string;
  customerType: CustomerType;
  priceLevelId: string;
  creditLimit: string;
  paymentTermsDays: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
};

export function CustomerForm({
  mode,
  initial,
  cancelHref,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<CustomerFormValues>;
  cancelHref?: string;
}) {
  const router = useRouter();
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [nextCode, setNextCode] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(
    Boolean(initial?.email || initial?.address || initial?.creditLimit)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [customerType, setCustomerType] = useState<CustomerType>(
    (initial?.customerType as CustomerType) ?? 'contractor'
  );
  const [priceLevelId, setPriceLevelId] = useState(initial?.priceLevelId ?? '');
  const [creditLimit, setCreditLimit] = useState(initial?.creditLimit ?? '');
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    initial?.paymentTermsDays ?? '30'
  );
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  useEffect(() => {
    fetch('/api/pricing/levels')
      .then((r) => r.json())
      .then((d) => setPriceLevels(d.levels ?? []))
      .catch(() => setPriceLevels([]));
  }, []);

  useEffect(() => {
    if (mode === 'create') {
      fetch('/api/customers/next-code')
        .then((r) => r.json())
        .then((d) => setNextCode(d.code ?? null))
        .catch(() => setNextCode(null));
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'create' || priceLevels.length === 0) return;
    const levelName = defaultPriceLevelNameForType(customerType);
    if (!levelName) return;
    const match = priceLevels.find((pl) => pl.name === levelName);
    if (match) setPriceLevelId(match.id);
  }, [customerType, priceLevels, mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!phone.trim()) {
      setError('Phone is required');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name: name.trim(),
      customerType,
      priceLevelId: priceLevelId || null,
      creditLimit: creditLimit.trim() ? parseFloat(creditLimit) : undefined,
      paymentTermsDays: paymentTermsDays.trim()
        ? parseInt(paymentTermsDays, 10)
        : 30,
      email: email.trim() || undefined,
      phone: phone.trim(),
      address: address.trim() || undefined,
      ...(mode === 'edit' ? { isActive } : {}),
    };

    try {
      const url =
        mode === 'create' ? '/api/customers' : `/api/customers/${initial?.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save customer');
        return;
      }
      router.push(`/customers/${data.customer.id}`);
      router.refresh();
    } catch {
      setError('Failed to save customer');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      {mode === 'create' && nextCode && (
        <p className="text-sm text-slate-500">
          Customer code: <span className="font-mono text-slate-700">{nextCode}</span>{' '}
          <span className="text-xs">(assigned on save)</span>
        </p>
      )}
      {mode === 'edit' && initial?.code && (
        <p className="font-mono text-sm text-slate-500">{initial.code}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="cust-name" className="text-xs font-medium text-slate-500">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="cust-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g. Silva Electrical Contractors"
          />
        </div>

        <div>
          <label htmlFor="cust-phone" className="text-xs font-medium text-slate-500">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            id="cust-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="07X XXX XXXX"
          />
        </div>

        <div>
          <label htmlFor="cust-type" className="text-xs font-medium text-slate-500">
            Customer type
          </label>
          <select
            id="cust-type"
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as CustomerType)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cust-price-level" className="text-xs font-medium text-slate-500">
            Price level
          </label>
          <select
            id="cust-price-level"
            value={priceLevelId}
            onChange={(e) => setPriceLevelId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Default (none)</option>
            {priceLevels.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cust-terms" className="text-xs font-medium text-slate-500">
            Payment terms (days)
          </label>
          <input
            id="cust-terms"
            type="number"
            min={0}
            value={paymentTermsDays}
            onChange={(e) => setPaymentTermsDays(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-sm text-brand-blue-600 hover:underline"
      >
        {showMore ? 'Hide additional details' : 'More details (email, address, credit limit)'}
      </button>

      {showMore && (
        <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-100 pt-4">
          <div>
            <label htmlFor="cust-email" className="text-xs font-medium text-slate-500">
              Email
            </label>
            <input
              id="cust-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="cust-credit" className="text-xs font-medium text-slate-500">
              Credit limit (LKR)
            </label>
            <input
              id="cust-credit"
              type="number"
              min={0}
              step="0.01"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cust-address" className="text-xs font-medium text-slate-500">
              Address
            </label>
            <textarea
              id="cust-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Street, city"
            />
          </div>
          {mode === 'edit' && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="cust-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300"
              />
              <label htmlFor="cust-active" className="text-sm text-slate-700">
                Active account
              </label>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving…' : mode === 'create' ? 'Create customer' : 'Save changes'}
        </button>
        {cancelHref && (
          <a
            href={cancelHref}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </a>
        )}
      </div>
    </form>
  );
}
