import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatLkr } from '@/lib/format';
import type { InventoryUnitDetail } from '@/lib/inventory-search';
import { alertsUrl, vendorInventoryUrl } from '@/lib/inventory-url';

function formatQty(value: string | number | null) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('en-LK', { maximumFractionDigits: 4 })
    : String(value);
}

function formatPeriod(start: string | Date, end: string | Date) {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  return `${fmt(new Date(start))} – ${fmt(new Date(end))}`;
}

function StatusBadges({ unit }: { unit: InventoryUnitDetail }) {
  const badges: { label: string; className: string }[] = [];
  if (unit.has_variance_alert) {
    badges.push({
      label: 'Value mismatch',
      className: 'bg-slate-100 text-slate-700',
    });
  }
  if (unit.stock_status === 'out_of_stock') {
    badges.push({ label: 'Out of stock', className: 'bg-red-50 text-red-800' });
  } else if (unit.stock_status === 'low_stock') {
    badges.push({ label: 'Low stock', className: 'bg-brand-gold-50 text-brand-gold-800' });
  } else {
    badges.push({ label: 'In stock', className: 'bg-emerald-50 text-emerald-800' });
  }
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <span
          key={b.label}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${b.className}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="font-display text-sm font-semibold text-slate-900">{title}</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-sm text-slate-900 ${mono ? 'font-mono tabular-nums' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

type Movement = {
  movement_type: string;
  quantity_delta: string;
  rate: string | null;
  note: string | null;
  created_at: Date;
  location_name: string;
};

export function UnitDetailView({
  unit,
  movements = [],
}: {
  unit: InventoryUnitDetail;
  movements?: Movement[];
}) {
  const slug = unit.vendor_slug;
  const sku = unit.primary_sku;
  const importedAt = new Date(unit.imported_at);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="font-mono text-sm text-slate-500">{unit.vendor_name}</p>
        <h1 className="mt-1 font-mono text-2xl font-semibold text-slate-900 sm:text-3xl">
          {sku ?? unit.stock_item_id.slice(0, 8)}
        </h1>
        <p className="mt-2 text-lg text-slate-800">{unit.item_name}</p>
        {unit.tally_name && unit.tally_name !== unit.item_name && (
          <p className="mt-1 text-sm text-slate-500">Tally: {unit.tally_name}</p>
        )}
        <div className="mt-4">
          <StatusBadges unit={unit} />
        </div>
        {unit.previous_quantity != null &&
          unit.stock_status === 'out_of_stock' &&
          unit.previous_quantity > 0 && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              Newly out since previous import: was{' '}
              <span className="font-mono font-semibold">
                {formatQty(unit.previous_quantity)}
              </span>{' '}
              {unit.unit_code}, now {formatQty(unit.quantity)}.
            </p>
          )}
      </header>

      <DetailCard title="Stock and value">
        <DetailRow label="Quantity" value={formatQty(unit.quantity)} mono />
        <DetailRow label="Unit" value={unit.unit_code} />
        <DetailRow label="Rate" value={formatLkr(unit.rate)} mono />
        <DetailRow label="Reported value (Tally)" value={formatLkr(unit.value)} mono />
        <DetailRow
          label="Qty × rate"
          value={formatLkr(unit.computed_value)}
          mono
        />
        <DetailRow label="Line value used" value={formatLkr(unit.line_value)} mono />
      </DetailCard>

      {unit.has_variance_alert && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Value mismatch</p>
          <p className="mt-1 text-amber-900">
            Tally reported {formatLkr(unit.value)} but quantity × rate is{' '}
            {formatLkr(unit.computed_value)}. The import stores both figures as in the
            source file.
          </p>
        </section>
      )}

      <DetailCard title="Catalog">
        <DetailRow label="Stock group" value={unit.stock_group_name} />
        <DetailRow label="Category" value={unit.category_name} />
        <DetailRow label="Stock item ID" value={unit.stock_item_id} mono />
      </DetailCard>

      <DetailCard title="Import context">
        <DetailRow label="Location" value={unit.location_name} />
        <DetailRow
          label="Period"
          value={formatPeriod(unit.period_starts_on, unit.period_ends_on)}
        />
        <DetailRow
          label="Last imported"
          value={importedAt.toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        />
      </DetailCard>

      {movements.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Stock movement ledger
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {movements.map((m, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="capitalize text-slate-600">
                  {String(m.movement_type).replace(/_/g, ' ')}
                </span>
                <span className="font-mono">
                  {Number(m.quantity_delta) > 0 ? '+' : ''}
                  {m.quantity_delta}
                </span>
                <span className="text-xs text-slate-400 w-full">
                  {m.location_name} ·{' '}
                  {new Date(m.created_at).toLocaleString('en-GB')}
                  {m.note ? ` · ${m.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="flex flex-wrap gap-2">
        <Link
          href={vendorInventoryUrl(slug, {
            q: sku ?? undefined,
            tab: 'stock',
          })}
          className="rounded-lg border border-brand-blue-200 bg-brand-blue-50 px-4 py-2 text-sm font-medium text-brand-blue-700 hover:bg-brand-blue-100"
        >
          View in stock list
        </Link>
        <Link
          href={vendorInventoryUrl(slug, {
            group: unit.stock_group_name,
            tab: 'stock',
          })}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          All in this group
        </Link>
        <Link
          href={vendorInventoryUrl(slug, { tab: 'stock' })}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {unit.vendor_name} inventory
        </Link>
        <Link
          href={alertsUrl('all')}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to alerts
        </Link>
      </nav>
    </div>
  );
}
