'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatLkr } from '@/lib/format';
import type { ReorderWorkbenchLine, ReorderWorkbenchSummary } from '@/lib/reorder';
import { reorderHubUrl } from '@/lib/reorder-url';
import { BulkCreatePoModal } from './BulkCreatePoModal';
import { CreatePoModal } from './CreatePoModal';
import { ReorderLineActions } from './ReorderLineActions';
import { ReorderPagination } from './ReorderPagination';
import { ReorderSearchBar } from './ReorderSearchBar';

const TABS = [
  { id: 'action', label: 'Review queue', desc: 'Below minimum — approve or dismiss before ordering' },
  { id: 'approved', label: 'Ready for PO', desc: 'Approved lines — select items, then create purchase orders' },
  { id: 'needs_rule', label: 'Needs rule', desc: 'Set min qty before they enter the queue' },
  { id: 'history', label: 'History', desc: 'Converted or cancelled suggestions' },
  { id: 'rules', label: 'Rules', desc: 'Category defaults and per-SKU thresholds' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function groupByVendor(lines: ReorderWorkbenchLine[]) {
  const map = new Map<string, { name: string; slug: string; lines: ReorderWorkbenchLine[] }>();
  for (const line of lines) {
    const key = line.category_code;
    const existing = map.get(key);
    if (existing) {
      existing.lines.push(line);
    } else {
      map.set(key, {
        name: line.category_name,
        slug: line.vendor_slug,
        lines: [line],
      });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      b.lines.reduce((s, l) => s + l.estimated_value, 0) -
      a.lines.reduce((s, l) => s + l.estimated_value, 0)
  );
}

export function ReorderWorkbench({
  lines,
  summary,
  tab,
  rulesPanel,
  totalCount = 0,
  page = 1,
  pageSize = 50,
  q,
  vendor,
}: {
  lines: ReorderWorkbenchLine[];
  summary: ReorderWorkbenchSummary;
  tab: TabId;
  rulesPanel?: React.ReactNode;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  q?: string;
  vendor?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [poVendor, setPoVendor] = useState<{
    code: string;
    name: string;
    lines: ReorderWorkbenchLine[];
  } | null>(null);
  const [showBulkPo, setShowBulkPo] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const vendors = useMemo(() => groupByVendor(lines), [lines]);

  function lineKey(line: ReorderWorkbenchLine) {
    return `${line.stock_item_id}-${line.location_id}`;
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleVendor(keys: string[]) {
    const allSelected = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (allSelected) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  async function scan() {
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await fetch('/api/reorder/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Scan failed');
      setScanMsg(
        `Scanned ${data.scanned} items — ${data.created} new, ${data.updated} updated, ${data.cancelled} cancelled`
      );
      router.refresh();
    } catch (e) {
      setScanMsg(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function bulkApprove() {
    const ids = lines
      .filter((l) => selected.has(lineKey(l)) && l.suggestion_id)
      .map((l) => l.suggestion_id!);
    if (ids.length === 0) {
      alert('Select lines with draft suggestions (run Scan first)');
      return;
    }
    const res = await fetch('/api/reorder/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_approve', ids }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? 'Bulk approve failed');
      return;
    }
    setSelected(new Set());
    router.refresh();
  }

  async function bulkDismiss() {
    const ids = lines
      .filter((l) => selected.has(lineKey(l)) && l.suggestion_id)
      .map((l) => l.suggestion_id!);
    if (ids.length === 0) return;
    const res = await fetch('/api/reorder/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_dismiss', ids }),
    });
    if (!res.ok) return;
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Below min"
          value={`${summary.items_below_min} items`}
          sub={formatLkr(summary.estimated_value_at_risk)}
        />
        <KpiCard label="Draft suggestions" value={String(summary.draft_count)} />
        <KpiCard label="Ready for PO" value={String(summary.approved_count)} />
        <KpiCard
          label="Snapshot age"
          value={
            summary.oldest_snapshot_days != null
              ? `${summary.oldest_snapshot_days}d`
              : '—'
          }
          sub={
            summary.oldest_snapshot_days != null && summary.oldest_snapshot_days > 3
              ? 'Consider re-importing'
              : summary.last_scan_at
                ? `Last scan ${new Date(summary.last_scan_at).toLocaleDateString('en-GB')}`
                : 'No scan yet'
          }
          warn={summary.oldest_snapshot_days != null && summary.oldest_snapshot_days > 3}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={reorderHubUrl({ tab: t.id, vendor })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t.id
                  ? 'bg-brand-blue-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {tab !== 'rules' && (
          <button
            type="button"
            onClick={scan}
            disabled={scanning}
            className="shrink-0 rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600 disabled:opacity-50"
          >
            {scanning ? 'Scanning…' : 'Scan below min'}
          </button>
        )}
      </div>

      {tab !== 'rules' && (
        <ReorderSearchBar tab={tab} q={q} vendor={vendor} />
      )}

      {tab === 'rules' && rulesPanel}

      {tab !== 'rules' && totalCount > 0 && (
        <p className="text-sm text-slate-600">
          {totalCount.toLocaleString()} lines
          {q ? ` matching “${q}”` : ''}
          {vendor ? ` · ${vendor}` : ''}
        </p>
      )}

      {scanMsg && <p className="text-xs text-slate-500">{scanMsg}</p>}

      {TABS.find((t) => t.id === tab)?.desc && tab !== 'rules' && (
        <p className="text-sm text-slate-600">{TABS.find((t) => t.id === tab)!.desc}</p>
      )}

      {tab === 'approved' && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBulkPo(true)}
            className="rounded-lg bg-brand-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-600"
          >
            Create POs for selected ({selected.size})
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear selection
          </button>
        </div>
      )}

      {tab !== 'rules' && tab === 'action' && selected.size > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={bulkApprove}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Approve selected ({selected.size})
          </button>
          <button
            type="button"
            onClick={bulkDismiss}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600"
          >
            Dismiss selected
          </button>
        </div>
      )}

      {tab !== 'rules' && lines.length === 0 && (
        <p className="text-sm text-slate-500">
          {tab === 'action' && 'No items waiting for review.'}
          {tab === 'approved' && 'No lines ready for PO — approve items in the review queue first.'}
          {tab === 'needs_rule' && 'No high-value items missing reorder rules.'}
          {tab === 'history' && 'No converted or cancelled suggestions yet.'}
        </p>
      )}

      {tab !== 'rules' &&
        vendors.map((vendor) => {
          const keys = vendor.lines.map(lineKey);
          const subtotal = vendor.lines.reduce((s, l) => s + l.estimated_value, 0);
          const open = expanded.has(vendor.name) || vendors.length <= 3;
          const selectedInVendor = keys.filter((k) => selected.has(k)).length;

          return (
            <section
              key={vendor.name}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(vendor.name)) next.delete(vendor.name);
                    else next.add(vendor.name);
                    return next;
                  })
                }
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div>
                  <span className="font-display font-semibold text-slate-900">
                    {vendor.name}
                  </span>
                  <span className="ml-2 text-sm text-slate-500">
                    {vendor.lines.length} lines
                  </span>
                </div>
                <span className="font-mono text-sm font-medium text-slate-700">
                  {formatLkr(subtotal)}
                </span>
              </button>

              {open && (
                <div className="border-t border-slate-100">
                  {tab === 'approved' && (
                    <div className="flex justify-end px-4 py-2">
                      <button
                        type="button"
                        disabled={selectedInVendor === 0}
                        onClick={() => {
                          const picked = vendor.lines.filter((l) =>
                            selected.has(lineKey(l))
                          );
                          setPoVendor({
                            code: vendor.lines[0]?.category_code ?? vendor.name,
                            name: vendor.name,
                            lines: picked,
                          });
                        }}
                        className="rounded-lg bg-brand-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {selectedInVendor > 0
                          ? `Create PO — ${selectedInVendor} selected`
                          : `Select lines to create PO`}
                      </button>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          {(tab === 'action' || tab === 'approved') && (
                            <th className="px-4 py-2 w-8">
                              <input
                                type="checkbox"
                                checked={keys.length > 0 && keys.every((k) => selected.has(k))}
                                onChange={() => toggleVendor(keys)}
                                aria-label="Select vendor"
                              />
                            </th>
                          )}
                          <th className="px-4 py-2">SKU</th>
                          <th className="px-4 py-2">Item</th>
                          <th className="px-4 py-2 text-right">On hand</th>
                          <th className="px-4 py-2 text-right">Min</th>
                          <th className="px-4 py-2 text-right">Suggest</th>
                          <th className="px-4 py-2 text-right">Est. value</th>
                          <th className="px-4 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vendor.lines.map((line) => {
                          const key = lineKey(line);
                          return (
                            <tr key={key} className="hover:bg-slate-50/50">
                              {(tab === 'action' || tab === 'approved') && (
                                <td className="px-4 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selected.has(key)}
                                    onChange={() => toggleSelect(key)}
                                    aria-label={`Select ${line.primary_sku ?? line.item_name}`}
                                  />
                                </td>
                              )}
                              <td className="px-4 py-2 font-mono text-xs">
                                <Link
                                  href={`/inventory/${line.vendor_slug}/unit/${encodeURIComponent(line.primary_sku ?? line.stock_item_id)}`}
                                  className="text-brand-blue-600 hover:underline"
                                >
                                  {line.primary_sku ?? '—'}
                                </Link>
                              </td>
                              <td className="px-4 py-2 max-w-xs truncate">{line.item_name}</td>
                              <td className="px-4 py-2 text-right font-mono">
                                {line.current_qty}
                              </td>
                              <td className="px-4 py-2 text-right font-mono">
                                {line.min_qty ?? '—'}
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-medium">
                                {line.suggested_qty}
                              </td>
                              <td className="px-4 py-2 text-right font-mono">
                                {formatLkr(line.estimated_value)}
                              </td>
                              <td className="px-4 py-2">
                                <ReorderLineActions line={line} tab={tab} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          );
        })}

      {tab !== 'rules' && totalCount > 0 && (
        <ReorderPagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          tab={tab}
          q={q}
          vendor={vendor}
        />
      )}

      {poVendor && (
        <CreatePoModal
          vendorCode={poVendor.code}
          vendorName={poVendor.name}
          lines={poVendor.lines}
          onClose={() => setPoVendor(null)}
        />
      )}
      {showBulkPo && (
        <BulkCreatePoModal
          selectedLines={lines.filter((l) => selected.has(lineKey(l)))}
          onClose={() => setShowBulkPo(false)}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
