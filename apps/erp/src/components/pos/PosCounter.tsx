'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatLkr } from '@/lib/format';
import { PosCustomerPicker, type PosCustomer } from './PosCustomerPicker';
import { PosItemPicker, type PosLookupItem } from './PosItemPicker';
import { PosSessionBar, type ZReport } from './PosSessionBar';
import { PaymentGatewayModal } from '@/components/payments/PaymentGatewayModal';
import type { MockPaymentResult } from '@/lib/payments-shared';
import { PosStockWarningModal, type StockWarningLine } from './PosStockWarningModal';

export type PosRegisterClient = {
  id: string;
  name: string;
  location_id: string;
  location_name: string;
  price_level_id: string | null;
  price_level_name: string | null;
};

type CartLine = {
  stockItemId: string;
  item_name: string;
  sku: string;
  vendor_slug: string;
  quantity: number;
  unit_rate: number;
  on_hand: number;
  price_source: string;
};

type SaleSuccess = {
  transactionId: string;
  transactionNumber: string;
  total: number;
  paymentMethod: string;
  paymentReference: string | null;
  locationName: string;
  inventoryUpdated: Array<{
    stockItemId: string;
    sku: string;
    vendorSlug: string;
    quantitySold: number;
    newQty: number;
  }>;
};

type PaymentMethod = 'cash' | 'card' | 'account';

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'account', label: 'Account' },
];

export function PosCounter({ registers }: { registers: PosRegisterClient[] }) {
  const [registerId, setRegisterId] = useState(registers[0]?.id ?? '');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [openingCash, setOpeningCash] = useState('0');
  const [closingCash, setClosingCash] = useState('0');
  const [showZReport, setShowZReport] = useState(false);
  const [zReport, setZReport] = useState<ZReport | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [message, setMessage] = useState<string | null>(null);
  const [saleSuccess, setSaleSuccess] = useState<SaleSuccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [stockWarning, setStockWarning] = useState<StockWarningLine[] | null>(null);
  const [paymentGatewayOpen, setPaymentGatewayOpen] = useState(false);
  const [pendingInsufficientOk, setPendingInsufficientOk] = useState(false);

  const register = registers.find((r) => r.id === registerId);

  const loadSession = useCallback(() => {
    if (!registerId) return;
    fetch(`/api/pos/sessions?registerId=${registerId}`)
      .then((r) => r.json())
      .then((d) => setSessionId(d.session?.id ?? null));
  }, [registerId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const loadZReport = useCallback(() => {
    if (!sessionId) return;
    fetch(`/api/pos/transactions?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((d) => setZReport(d));
  }, [sessionId]);

  useEffect(() => {
    if (showZReport && sessionId) loadZReport();
  }, [showZReport, sessionId, loadZReport, cart.length]);

  const repriceCart = useCallback(
    async (lines: CartLine[], cust: PosCustomer | null) => {
      if (!register || lines.length === 0) return lines;
      const res = await fetch('/api/pos/cart/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: register.location_id,
          priceLevelId: register.price_level_id,
          customerId: cust?.id,
          lines: lines.map((l) => ({
            stockItemId: l.stockItemId,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return lines;
      return (data.lines ?? []).map(
        (l: {
          stockItemId: string;
          item_name: string;
          sku: string;
          vendor_slug: string;
          quantity: number;
          unit_rate: number;
          on_hand: number;
          price_source: string;
        }) => ({
          stockItemId: l.stockItemId,
          item_name: l.item_name,
          sku: l.sku,
          vendor_slug: l.vendor_slug,
          quantity: l.quantity,
          unit_rate: l.unit_rate,
          on_hand: l.on_hand,
          price_source: l.price_source,
        })
      );
    },
    [register]
  );

  useEffect(() => {
    if (cart.length === 0) return;
    repriceCart(cart, customer).then(setCart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  function addItem(item: PosLookupItem) {
    setCart((c) => {
      const existing = c.find((x) => x.stockItemId === item.stock_item_id);
      if (existing) {
        return c.map((x) =>
          x.stockItemId === item.stock_item_id
            ? { ...x, quantity: x.quantity + 1 }
            : x
        );
      }
      return [
        ...c,
        {
          stockItemId: item.stock_item_id,
          item_name: item.item_name,
          sku: item.sku,
          vendor_slug: item.vendor_slug,
          quantity: 1,
          unit_rate: item.unit_rate,
          on_hand: item.on_hand,
          price_source: item.price_source,
        },
      ];
    });
  }

  async function updateQty(stockItemId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((c) => c.filter((x) => x.stockItemId !== stockItemId));
      return;
    }
    const next = cart.map((x) =>
      x.stockItemId === stockItemId ? { ...x, quantity } : x
    );
    const repriced = await repriceCart(next, customer);
    setCart(repriced);
  }

  async function openSession() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/pos/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          registerId,
          openingCash: Number(openingCash) || 0,
        }),
      });
      const data = await res.json();
      if (data.session) {
        setSessionId(data.session.id);
      } else {
        setMessage(data.error ?? 'Could not open session');
      }
    } finally {
      setLoading(false);
    }
  }

  async function closeSession() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/pos/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          sessionId,
          closingCash: Number(closingCash) || 0,
        }),
      });
      const data = await res.json();
      if (data.session) {
        setSessionId(null);
        setCart([]);
        setSaleSuccess(null);
        setShowZReport(false);
        setMessage('Session closed');
      }
    } finally {
      setLoading(false);
    }
  }

  function beginCheckout(allowInsufficientStock = false) {
    if (!sessionId || cart.length === 0) return;
    if (paymentMethod === 'account' && !customer) {
      setMessage('Attach a customer for account payment');
      return;
    }
    setPendingInsufficientOk(allowInsufficientStock);
    setPaymentGatewayOpen(true);
  }

  async function checkout(
    allowInsufficientStock: boolean,
    paymentReference?: string
  ) {
    if (!sessionId || cart.length === 0) return;
    setLoading(true);
    setMessage(null);
    setSaleSuccess(null);
    try {
      const res = await fetch('/api/pos/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          customerId: customer?.id,
          paymentMethod,
          paymentReference,
          allowInsufficientStock,
          lines: cart.map((l) => ({
            stockItemId: l.stockItemId,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.insufficientStock?.length && !allowInsufficientStock) {
          setStockWarning(
            cart
              .filter((l) => l.quantity > l.on_hand)
              .map((l) => ({
                stockItemId: l.stockItemId,
                sku: l.sku,
                item_name: l.item_name,
                requested: l.quantity,
                on_hand: l.on_hand,
              }))
          );
          return;
        }
        throw new Error(data.error ?? 'Checkout failed');
      }
      setSaleSuccess({
        transactionId: data.transactionId,
        transactionNumber: data.transactionNumber,
        total: data.total,
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference ?? null,
        locationName: data.locationName,
        inventoryUpdated: data.inventoryUpdated ?? [],
      });
      setCart([]);
      setStockWarning(null);
      loadZReport();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  }

  const total = cart.reduce((s, l) => s + l.quantity * l.unit_rate, 0);

  function onPaymentSuccess(result: Extract<MockPaymentResult, { ok: true }>) {
    setPaymentGatewayOpen(false);
    checkout(pendingInsufficientOk, result.reference);
  }

  if (registers.length === 0) {
    return <p className="text-sm text-slate-500">No POS registers configured.</p>;
  }

  return (
    <div className="space-y-4">
      <PosSessionBar
        registers={registers}
        registerId={registerId}
        onRegisterChange={setRegisterId}
        sessionId={sessionId}
        locationName={register?.location_name ?? ''}
        openingCash={openingCash}
        onOpeningCashChange={setOpeningCash}
        closingCash={closingCash}
        onClosingCashChange={setClosingCash}
        onOpenSession={openSession}
        onCloseSession={closeSession}
        zReport={zReport}
        showZReport={showZReport}
        onToggleZReport={() => setShowZReport((v) => !v)}
        loading={loading}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <PosCustomerPicker customer={customer} onSelect={setCustomer} />

          {register && (
            <PosItemPicker
              disabled={!sessionId}
              locationId={register.location_id}
              priceLevelId={register.price_level_id}
              customerId={customer?.id}
              onAdd={addItem}
            />
          )}

          {!sessionId && (
            <p className="text-xs text-slate-500">Open a session to search and sell.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 text-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Cart</h2>
            {register?.price_level_name && (
              <span className="text-xs text-slate-500">
                {customer?.price_level_name ?? register.price_level_name}
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-slate-500">No items yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="pb-2 pr-2">Item</th>
                    <th className="pb-2 pr-2 text-right">Qty</th>
                    <th className="pb-2 pr-2 text-right">Price</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {cart.map((l) => (
                    <tr key={l.stockItemId}>
                      <td className="py-2 pr-2">
                        <span className="font-mono text-xs text-slate-400">{l.sku}</span>
                        <span className="block truncate text-slate-200 max-w-[10rem]">
                          {l.item_name}
                        </span>
                        {l.quantity > l.on_hand && (
                          <span className="text-[10px] text-amber-400">
                            Low stock ({l.on_hand} on hand)
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) =>
                            updateQty(l.stockItemId, Number(e.target.value))
                          }
                          className="w-14 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-right font-mono text-sm"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-xs text-slate-300">
                        {formatLkr(l.unit_rate)}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono">
                        {formatLkr(l.quantity * l.unit_rate)}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => updateQty(l.stockItemId, 0)}
                          className="text-xs text-slate-500 hover:text-red-400"
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-700 pt-3 flex justify-between font-semibold">
            <span>Total</span>
            <span className="font-mono">{formatLkr(total)}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaymentMethod(p.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  paymentMethod === p.id
                    ? 'bg-brand-gold-500 text-slate-900'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!sessionId || cart.length === 0 || loading}
            onClick={() => beginCheckout(false)}
            className="w-full rounded-lg bg-brand-gold-500 py-3 text-sm font-semibold text-slate-900 disabled:opacity-40"
          >
            {loading ? 'Processing…' : 'Complete sale'}
          </button>

          {message && <p className="text-xs text-red-400">{message}</p>}

          {saleSuccess && (
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 p-3 text-sm">
              <p className="font-medium text-emerald-300">
                {saleSuccess.transactionNumber} — {formatLkr(saleSuccess.total)}
              </p>
              <p className="mt-1 text-xs text-emerald-400/90 capitalize">
                {saleSuccess.paymentMethod}
                {saleSuccess.paymentReference && (
                  <span className="font-mono normal-case">
                    {' '}
                    · {saleSuccess.paymentReference}
                  </span>
                )}{' '}
                · Inventory updated at {saleSuccess.locationName}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <Link
                  href={`/orders/pos/${saleSuccess.transactionId}`}
                  className="font-medium text-emerald-300 hover:underline"
                >
                  View sale
                </Link>
                <Link
                  href={`/orders/pos/${saleSuccess.transactionId}/print`}
                  className="text-emerald-400 hover:underline"
                >
                  Print receipt
                </Link>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {saleSuccess.inventoryUpdated.map((item) => (
                  <Link
                    key={item.stockItemId}
                    href={`/inventory/${item.vendorSlug}/unit/${encodeURIComponent(item.sku)}`}
                    className="text-emerald-400 hover:underline"
                  >
                    {item.sku} (now {item.newQty})
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {stockWarning && register && (
        <PosStockWarningModal
          locationName={register.location_name}
          lines={stockWarning}
          onCancel={() => setStockWarning(null)}
          onConfirm={() => {
            setStockWarning(null);
            beginCheckout(true);
          }}
        />
      )}

      <PaymentGatewayModal
        open={paymentGatewayOpen}
        amount={total}
        method={paymentMethod}
        customerName={customer?.name}
        customerId={customer?.id}
        title="POS checkout"
        onSuccess={onPaymentSuccess}
        onCancel={() => setPaymentGatewayOpen(false)}
      />
    </div>
  );
}
