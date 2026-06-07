import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PosReceiptDocument } from '@/components/sales/PosReceiptDocument';
import { PrintDocumentButton } from '@/components/sales/PrintDocumentButton';
import { getCompanyProfile } from '@/lib/company-profile';
import { getPosTransactionDocument } from '@/lib/pos';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await getPosTransactionDocument(id);
  if (!document) return { title: 'POS receipt' };
  return {
    title: `${document.transaction.transaction_number} — St. Anthony's receipt`,
  };
}

export default async function PosReceiptPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await getPosTransactionDocument(id);
  if (!document) notFound();

  const company = await getCompanyProfile(document.company_id);

  return (
    <div className="print-page min-h-screen bg-slate-200/80 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-md items-center justify-between gap-3 px-4">
        <Link
          href={`/orders/pos/${id}`}
          className="text-sm text-brand-blue-600 hover:underline"
        >
          ← Back to {document.transaction.transaction_number}
        </Link>
        <PrintDocumentButton />
      </div>
      <div className="print-document px-4 print:px-0">
        <PosReceiptDocument
          document={document}
          company={company}
          printMode
          reprintedAt={new Date()}
        />
      </div>
    </div>
  );
}
