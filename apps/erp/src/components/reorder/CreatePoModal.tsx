'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatLkr } from '@/lib/format';
import type { ReorderWorkbenchLine } from '@/lib/reorder';

type Supplier = { id: string; code: string; name: string };

type CreatedPo = { id: string; poNumber: string };

export function CreatePoModal({
  vendorCode,
  vendorName,
  lines,
  onClose,
}: {
  vendorCode: string;
  vendorName: string;
  lines: ReorderWorkbenchLine[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedPo | null>(null);

  const suggestionIds = lines
    .map((l) => l.suggestion_id)
    .filter((id): id is string => Boolean(id));
  const locationId = lines[0]?.location_id;
  const totalValue = lines.reduce((s, l) => s + l.estimated_value, 0);

  useEffect(() => {
    fetch('/api/purchasing/suppliers')
      .then((r) => r.json())
      .then((d) => {
        const list: Supplier[] = d.suppliers ?? [];
        setSuppliers(list);
        const match =
          list.find((s) => s.code.toUpperCase() === vendorCode.toUpperCase()) ??
          list.find((s) => s.name.toUpperCase().includes(vendorCode.toUpperCase())) ??
          list[0];
        if (match) setSupplierId(match.id);
      })
      .catch(() => setError('Could not load suppliers'));
  }, [vendorCode]);

  async function createPo() {
    if (!supplierId || suggestionIds.length === 0 || !locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/purchasing/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId, suggestionIds, locationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'PO creation failed');
      setCreated({ id: data.id, poNumber: data.poNumber ?? data.po_number });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PO creation failed');
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h2 className="font-display text-lg font-semibold text-emerald-900">
            {created.poNumber} created
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Print the PO for your supplier, then receive goods when the delivery arrives to
            update inventory.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={`/purchasing/${created.id}#receive`}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-700"
            >
              Receive goods
            </Link>
            <Link
              href={`/purchasing/${created.id}/print`}
              className="rounded-lg border border-brand-blue-200 bg-brand-blue-50 px-4 py-2.5 text-center text-sm font-medium text-brand-blue-700 hover:bg-brand-blue-100"
            >
              Print purchase order
            </Link>
            <Link
              href={`/purchasing/${created.id}`}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm text-slate-700 hover:bg-slate-50"
            >
              Open PO detail
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Create PO — {vendorName}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {suggestionIds.length} selected lines · {formatLkr(totalValue)}
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Supplier
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
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
            onClick={createPo}
            disabled={loading || suggestionIds.length === 0 || !supplierId}
            className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  );
}
