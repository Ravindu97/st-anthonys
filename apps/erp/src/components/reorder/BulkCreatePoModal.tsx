'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatLkr } from '@/lib/format';
import type { ReorderWorkbenchLine } from '@/lib/reorder';

type Supplier = { id: string; code: string; name: string };

type VendorGroup = {
  vendorCode: string;
  vendorName: string;
  lines: ReorderWorkbenchLine[];
  locationId: string;
};

type CreatedOrder = { id: string; poNumber: string; vendorCode: string };

export function BulkCreatePoModal({
  selectedLines,
  onClose,
}: {
  selectedLines: ReorderWorkbenchLine[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierByVendor, setSupplierByVendor] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrders, setCreatedOrders] = useState<CreatedOrder[] | null>(null);

  const vendorGroups = useMemo(() => {
    const map = new Map<string, VendorGroup>();
    for (const line of selectedLines) {
      if (!line.suggestion_id) continue;
      const key = line.category_code;
      const existing = map.get(key);
      if (existing) {
        existing.lines.push(line);
      } else {
        map.set(key, {
          vendorCode: line.category_code,
          vendorName: line.category_name,
          lines: [line],
          locationId: line.location_id,
        });
      }
    }
    return [...map.values()].sort(
      (a, b) =>
        b.lines.reduce((s, l) => s + l.estimated_value, 0) -
        a.lines.reduce((s, l) => s + l.estimated_value, 0)
    );
  }, [selectedLines]);

  useEffect(() => {
    fetch('/api/purchasing/suppliers')
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers ?? []))
      .catch(() => setError('Could not load suppliers'));
  }, []);

  useEffect(() => {
    if (suppliers.length === 0 || vendorGroups.length === 0) return;
    const defaults: Record<string, string> = {};
    for (const g of vendorGroups) {
      const match =
        suppliers.find((s) => s.code.toUpperCase() === g.vendorCode.toUpperCase()) ??
        suppliers.find((s) => s.name.toUpperCase().includes(g.vendorCode.toUpperCase())) ??
        suppliers[0];
      if (match) defaults[g.vendorCode] = match.id;
    }
    setSupplierByVendor(defaults);
  }, [suppliers, vendorGroups]);

  const grandTotal = vendorGroups.reduce(
    (s, g) => s + g.lines.reduce((t, l) => t + l.estimated_value, 0),
    0
  );

  async function createAll() {
    const batches = vendorGroups
      .map((g) => ({
        vendorCode: g.vendorCode,
        vendorName: g.vendorName,
        locationId: g.locationId,
        supplierId: supplierByVendor[g.vendorCode],
        suggestionIds: g.lines
          .map((l) => l.suggestion_id)
          .filter((id): id is string => Boolean(id)),
      }))
      .filter((b) => b.suggestionIds.length > 0 && b.supplierId);

    if (batches.length === 0) {
      setError('Select a supplier for each vendor');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/purchasing/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_by_vendor', batches, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Bulk PO creation failed');

      setCreatedOrders(
        (data.orders ?? []).map((o: { id: string; poNumber: string; vendorCode: string }) => ({
          id: o.id,
          poNumber: o.poNumber,
          vendorCode: o.vendorCode,
        }))
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk PO creation failed');
    } finally {
      setLoading(false);
    }
  }

  if (createdOrders) {
    const single = createdOrders.length === 1 ? createdOrders[0] : null;
    return (
      <ModalShell title="Purchase orders created" onClose={onClose}>
        <p className="text-sm text-slate-600">
          {createdOrders.length} PO{createdOrders.length === 1 ? '' : 's'} created. Receive goods
          when deliveries arrive to sync inventory.
        </p>
        <ul className="mt-4 space-y-2">
          {createdOrders.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="font-mono font-medium">{o.poNumber}</span>
              <div className="flex gap-2">
                <Link
                  href={`/purchasing/${o.id}#receive`}
                  className="text-emerald-700 hover:underline"
                >
                  Receive
                </Link>
                <Link
                  href={`/purchasing/${o.id}/print`}
                  className="text-brand-blue-600 hover:underline"
                >
                  Print
                </Link>
              </div>
            </li>
          ))}
        </ul>
        {single && (
          <Link
            href={`/purchasing/${single.id}#receive`}
            className="mt-4 block rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-700"
          >
            Receive goods for {single.poNumber}
          </Link>
        )}
        <Link
          href="/purchasing?filter=awaiting"
          className="mt-3 block text-center text-sm text-brand-blue-600 hover:underline"
        >
          View all awaiting receipt
        </Link>
      </ModalShell>
    );
  }

  if (selectedLines.length === 0) {
    return (
      <ModalShell title="Create purchase orders" onClose={onClose}>
        <p className="text-sm text-slate-600">
          Select lines using the checkboxes, then create POs.
        </p>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Create POs from selection"
      subtitle={`${vendorGroups.length} vendor${vendorGroups.length === 1 ? '' : 's'} · ${selectedLines.length} lines · ${formatLkr(grandTotal)}`}
      onClose={onClose}
    >
      <p className="text-sm text-slate-600">
        One purchase order per vendor from your selected lines only.
      </p>

      <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
        {vendorGroups.map((g) => {
          const sub = g.lines.reduce((s, l) => s + l.estimated_value, 0);
          return (
            <li
              key={g.vendorCode}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{g.vendorName}</p>
                  <p className="text-xs text-slate-500">
                    {g.lines.length} selected · {formatLkr(sub)}
                  </p>
                </div>
                <select
                  value={supplierByVendor[g.vendorCode] ?? ''}
                  onChange={(e) =>
                    setSupplierByVendor((prev) => ({
                      ...prev,
                      [g.vendorCode]: e.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">Supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          );
        })}
      </ul>

      <label className="mt-4 block text-sm text-slate-600">
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={createAll}
          disabled={loading}
          className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600 disabled:opacity-50"
        >
          {loading ? 'Creating…' : `Create ${vendorGroups.length} PO${vendorGroups.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-4">{children}</div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-sm text-brand-blue-600 hover:underline"
        >
          Close
        </button>
      </div>
    </div>
  );
}
