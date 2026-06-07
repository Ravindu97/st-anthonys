import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { PurchaseOrderDocument } from '@/components/purchasing/PurchaseOrderDocument';
import { PrintPoButton } from '@/components/purchasing/PrintPoButton';
import { ReceiveGoodsForm } from '@/components/purchasing/ReceiveGoodsForm';
import { getCompanyProfile } from '@/lib/company-profile';
import { getPurchaseOrderDocument } from '@/lib/purchasing';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await getPurchaseOrderDocument(id);
  if (!document) notFound();

  const company = await getCompanyProfile(document.order.company_id);
  const { order, lines } = document;

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Purchasing', href: '/purchasing' },
          { label: order.po_number },
        ]}
      />

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <header>
          <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            {order.po_number}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {order.supplier_name} · {order.vendor_name} ·{' '}
            <span className="capitalize">{order.status}</span>
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/purchasing/${id}/print`}
            className="rounded-lg border border-brand-blue-200 bg-brand-blue-50 px-4 py-2 text-sm font-medium text-brand-blue-700 hover:bg-brand-blue-100"
          >
            Open print view
          </Link>
          <PrintPoButton />
        </div>
      </div>

      <PurchaseOrderDocument document={document} company={company} />

      {order.status !== 'received' && (
        <div className="no-print">
          <ReceiveGoodsForm
            purchaseOrderId={order.id}
            lines={lines.map((l) => ({
              id: l.id,
              item_name: l.item_name,
              primary_sku: l.primary_sku,
              quantity: Number(l.quantity),
              received_qty: Number(l.received_qty),
            }))}
          />
        </div>
      )}

      <Link
        href="/purchasing"
        className="no-print text-sm text-brand-blue-600 hover:underline"
      >
        ← All purchase orders
      </Link>
    </div>
  );
}
