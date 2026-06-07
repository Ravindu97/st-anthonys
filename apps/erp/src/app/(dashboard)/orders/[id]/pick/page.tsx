import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { PickListClient } from '@/components/sales/PickListClient';
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

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Orders', href: '/orders' },
          { label: data.document.doc_number, href: `/orders/${id}` },
          { label: 'Pick list' },
        ]}
      />

      <header>
        <h1 className="font-display text-xl font-semibold text-slate-900">
          Pick list — {data.document.doc_number}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Click-and-collect: mark items picked, then ready for pickup
        </p>
      </header>

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
  );
}
