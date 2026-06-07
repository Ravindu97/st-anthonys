import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { CollectPaymentPanel } from '@/components/sales/CollectPaymentPanel';
import { PickListClient } from '@/components/sales/PickListClient';
import { PickListDocument } from '@/components/sales/PickListDocument';
import { PrintDocumentButton } from '@/components/sales/PrintDocumentButton';
import { getCompanyProfile } from '@/lib/company-profile';
import { getSalesDocument } from '@/lib/sales';

export const dynamic = 'force-dynamic';

export default async function PickListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSalesDocument(id);
  if (!data) notFound();
  const company = await getCompanyProfile(data.document.company_id);

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Sales', href: '/orders' },
          { label: data.document.doc_number, href: `/orders/${id}` },
          { label: 'Pick list' },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900">
            Pick list — {data.document.doc_number}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Click-and-collect: mark items picked, then ready for pickup
          </p>
        </div>
        <PrintDocumentButton label="Print pick list" />
      </header>

      {data.document.status === 'ready_for_pickup' && (
        <CollectPaymentPanel
          orderId={id}
          totalAmount={Number(data.document.total_amount)}
          customerName={data.document.customer_name}
          customerId={data.document.customer_id}
        />
      )}

      <div className="no-print">
        <PickListClient
        orderId={id}
        status={data.document.status}
        lines={data.lines.map((l) => ({
          id: l.id,
          primary_sku: l.primary_sku,
          item_name: l.item_name,
          quantity: Number(l.quantity),
          picked_qty: Number(l.picked_qty),
        }))}
        />
      </div>

      <div className="print-only print-document">
        <PickListDocument
          docNumber={data.document.doc_number}
          customerName={data.document.customer_name}
          locationName={data.document.location_name}
          status={data.document.status}
          lines={data.lines}
          company={company}
          printMode
        />
      </div>
    </div>
  );
}
