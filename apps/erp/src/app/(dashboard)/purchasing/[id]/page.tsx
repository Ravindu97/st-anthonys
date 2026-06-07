import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { EntityActivityPanel } from '@/components/audit/EntityActivityPanel';
import { PurchaseOrderDocument } from '@/components/purchasing/PurchaseOrderDocument';
import { PrintPoButton } from '@/components/purchasing/PrintPoButton';
import { ReceiveGoodsForm } from '@/components/purchasing/ReceiveGoodsForm';
import { getPurchaseOrderAttribution, getRecordAuditStory } from '@/lib/audit';
import { isAdminRole } from '@/lib/auth/permissions';
import { getSessionFromCookies } from '@/lib/auth/session';
import { getCompanyProfile } from '@/lib/company-profile';
import {
  getPurchaseOrderDocument,
  getPurchaseOrderReceiptSummary,
} from '@/lib/purchasing';

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
  const session = await getSessionFromCookies();
  const isAdmin = session ? isAdminRole(session.role) : false;
  const [attribution, auditEvents, receiptSummary] = await Promise.all([
    getPurchaseOrderAttribution(id),
    isAdmin ? getRecordAuditStory('purchase_order', id) : Promise.resolve([]),
    getPurchaseOrderReceiptSummary(id),
  ]);

  const receiptLineById = new Map(receiptSummary?.lines.map((l) => [l.id, l]) ?? []);
  const showReceiptColumns =
    order.status === 'partial' ||
    lines.some((l) => Number(l.received_qty) > 0);

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
            {receiptSummary && receiptSummary.total_lines > 0 && (
              <span className="text-slate-400">
                {' '}
                · {receiptSummary.lines_fully_received}/{receiptSummary.total_lines} lines
                received
              </span>
            )}
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/purchasing/${id}/print`}
            className="rounded-lg border border-brand-blue-200 bg-brand-blue-50 px-4 py-2 text-sm font-medium text-brand-blue-700 hover:bg-brand-blue-100"
          >
            Open print view
          </Link>
          <Link
            href="/purchasing/receipts"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            GRN history
          </Link>
          <PrintPoButton />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <PurchaseOrderDocument
          document={document}
          company={company}
          showReceiptColumns={showReceiptColumns}
        />
        {attribution && (
          <EntityActivityPanel
            attribution={attribution}
            auditEvents={auditEvents}
            showFullHistory={isAdmin}
          />
        )}
      </div>

      {receiptSummary && (
        <div className="no-print">
          <ReceiveGoodsForm
            purchaseOrderId={order.id}
            poStatus={order.status}
            locationName={order.location_name}
            receiptSummary={{
              total_lines: receiptSummary.total_lines,
              lines_fully_received: receiptSummary.lines_fully_received,
              all_received: receiptSummary.all_received,
            }}
            lines={lines.map((l) => {
              const summary = receiptLineById.get(l.id);
              return {
                id: l.id,
                item_name: l.item_name,
                primary_sku: l.primary_sku,
                vendor_slug: summary?.vendor_slug ?? order.vendor_code,
                quantity: Number(l.quantity),
                received_qty: Number(l.received_qty),
              };
            })}
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
