'use client';

import { useCallback, useEffect, useState } from 'react';

type Register = {
  id: string;
  name: string;
  location_name: string;
  price_level_name: string | null;
};

type CartLine = {
  stock_item_id: string;
  item_name: string;
  sku: string;
  quantity: number;
  unit_rate: number;
};

export function PosCounter({ registers }: { registers: Register[] }) {
  const [registerId, setRegisterId] = useState(registers[0]?.id ?? '');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    Array<{
      stock_item_id: string;
      item_name: string;
      sku: string;
      quantity: string;
      rate: string;
    }>
  >([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const register = registers.find((r) => r.id === registerId);

  useEffect(() => {
    if (!registerId) return;
    fetch(`/api/pos/sessions?registerId=${registerId}`)
      .then((r) => r.json())
      .then((d) => setSessionId(d.session?.id ?? null));
  }, [registerId]);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    const res = await fetch(`/api/pos/lookup?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.items ?? []);
  }, [query]);

  async function openSession() {
    const res = await fetch('/api/pos/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open', registerId, openingCash: 0 }),
    });
    const data = await res.json();
    if (data.session) setSessionId(data.session.id);
    else setMessage(data.error ?? 'Could not open session');
  }

  function addToCart(item: (typeof results)[0]) {
    const rate = Number(item.rate ?? 0);
    setCart((c) => {
      const existing = c.find((x) => x.stock_item_id === item.stock_item_id);
      if (existing) {
        return c.map((x) =>
          x.stock_item_id === item.stock_item_id
            ? { ...x, quantity: x.quantity + 1 }
            : x
        );
      }
      return [
        ...c,
        {
          stock_item_id: item.stock_item_id,
          item_name: item.item_name,
          sku: item.sku,
          quantity: 1,
          unit_rate: rate,
        },
      ];
    });
    setQuery('');
    setResults([]);
  }

  async function checkout() {
    if (!sessionId || cart.length === 0) return;
    const res = await fetch('/api/pos/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        paymentMethod: 'cash',
        lines: cart.map((l) => ({
          stockItemId: l.stock_item_id,
          quantity: l.quantity,
          unitRate: l.unit_rate,
        })),
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setMessage(`Sale ${data.transactionNumber} — ${data.total.toLocaleString()}`);
      setCart([]);
    } else {
      setMessage(data.error ?? 'Checkout failed');
    }
  }

  const total = cart.reduce((s, l) => s + l.quantity * l.unit_rate, 0);

  if (registers.length === 0) {
    return <p className="text-sm text-slate-500">No POS registers configured.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={registerId}
            onChange={(e) => setRegisterId(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {registers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.location_name}
              </option>
            ))}
          </select>
          {!sessionId ? (
            <button
              type="button"
              onClick={openSession}
              className="rounded-lg bg-brand-blue-500 px-3 py-2 text-sm text-white"
            >
              Open session
            </button>
          ) : (
            <span className="text-xs text-emerald-600">Session open</span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="SKU or item name…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            autoFocus
          />
          <button
            type="button"
            onClick={search}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
          >
            Search
          </button>
        </div>

        {results.length > 0 && (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {results.map((r) => (
              <li key={r.stock_item_id}>
                <button
                  type="button"
                  onClick={() => addToCart(r)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-mono text-xs text-slate-500">{r.sku}</span>{' '}
                  {r.item_name}
                  <span className="float-right font-mono">
                    Stock {r.quantity} · {r.rate}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 text-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Cart</h2>
        <ul className="space-y-2 text-sm">
          {cart.map((l) => (
            <li key={l.stock_item_id} className="flex justify-between gap-2">
              <span>
                {l.sku} × {l.quantity}
              </span>
              <span className="font-mono">
                {(l.quantity * l.unit_rate).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-700 pt-3 flex justify-between font-semibold">
          <span>Total</span>
          <span className="font-mono">{total.toLocaleString()}</span>
        </div>
        <button
          type="button"
          disabled={!sessionId || cart.length === 0}
          onClick={checkout}
          className="w-full rounded-lg bg-brand-gold-500 py-3 text-sm font-semibold text-slate-900 disabled:opacity-40"
        >
          Complete sale
        </button>
        {message && <p className="text-xs text-slate-400">{message}</p>}
        {register?.price_level_name && (
          <p className="text-xs text-slate-500">Price list: {register.price_level_name}</p>
        )}
      </div>
    </div>
  );
}
