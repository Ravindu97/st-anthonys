import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintDocumentButton } from '@/components/sales/PrintDocumentButton';
import { SalesOrderDocument } from '@/components/sales/SalesOrderDocument';
import { getCompanyProfile } from '@/lib/company-profile';
import { getSalesDocument } from '@/lib/sales';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSalesDocument(id);
  if (!data) return { title: 'Sales document' };
  return {
    title: `${data.document.doc_number} — St. Anthony's`,
  };
}

export default async function SalesDocumentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSalesDocument(id);
  if (!data) notFound();

  const company = await getCompanyProfile(data.document.company_id);

  return (
    <div className="print-page min-h-screen bg-slate-200/80 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 px-4">
        <Link href={`/orders/${id}`} className="text-sm text-brand-blue-600 hover:underline">
          ← Back to {data.document.doc_number}
        </Link>
        <PrintDocumentButton />
      </div>
      <div className="print-document px-4 print:px-0">
        <SalesOrderDocument
          document={data.document}
          lines={data.lines}
          company={company}
          printMode
        />
      </div>
    </div>
  );
}
