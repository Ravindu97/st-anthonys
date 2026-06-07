import Link from 'next/link';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { TablePagination } from '@/components/TablePagination';
import { listGoodsReceipts } from '@/lib/purchasing';

export const dynamic = 'force-dynamic';

function formatWhen(d: Date | string) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function GoodsReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const data = await listGoodsReceipts({ page, pageSize: 25 });

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Purchasing', href: '/purchasing' },
          { label: 'Goods receipts' },
        ]}
      />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
          Goods receipts
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          GRN history linked to purchase orders and inventory updates
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">GRN #</th>
              <th className="px-4 py-3">PO #</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">By</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((grn) => (
              <tr key={grn.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link
                    href={`/purchasing/receipts/${grn.id}/print`}
                    className="text-brand-blue-600 hover:underline"
                  >
                    {grn.grn_number}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  <Link
                    href={`/purchasing/${grn.purchase_order_id}`}
                    className="text-brand-blue-600 hover:underline"
                  >
                    {grn.po_number}
                  </Link>
                </td>
                <td className="px-4 py-2">{grn.supplier_name}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{grn.location_name}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{formatWhen(grn.received_at)}</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {grn.created_by_email ?? '—'}
                </td>
                <td className="px-4 py-2 text-right">{grn.line_count}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {Number(grn.total_qty).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">No goods receipts yet.</p>
        )}
        <TablePagination
          basePath="/purchasing/receipts"
          page={data.page}
          pageSize={data.pageSize}
          totalCount={data.totalCount}
        />
      </div>
    </div>
  );
}
