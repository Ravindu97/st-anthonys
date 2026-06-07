import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GrnDocument } from '@/components/purchasing/GrnDocument';
import { PrintPoButton } from '@/components/purchasing/PrintPoButton';
import { getCompanyProfile } from '@/lib/company-profile';
import { getGoodsReceiptDocument } from '@/lib/purchasing';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await getGoodsReceiptDocument(id);
  if (!document) return { title: 'Goods receipt' };
  return {
    title: `${document.receipt.grn_number} — St. Anthony's GRN`,
  };
}

export default async function GoodsReceiptPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await getGoodsReceiptDocument(id);
  if (!document) notFound();

  const company = await getCompanyProfile(document.receipt.company_id);

  return (
    <div className="print-page min-h-screen bg-slate-200/80 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 px-4">
        <Link
          href={`/purchasing/${document.purchase_order.id}`}
          className="text-sm text-brand-blue-600 hover:underline"
        >
          ← Back to {document.purchase_order.po_number}
        </Link>
        <PrintPoButton />
      </div>
      <div className="print-document px-4 print:px-0">
        <GrnDocument document={document} company={company} printMode />
      </div>
    </div>
  );
}
