import { notFound } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/PageBreadcrumbs';
import { UnitDetailView } from '@/components/inventory/UnitDetailView';
import {
  getInventoryUnitDetail,
  resolveVendorCode,
  vendorHasSnapshot,
} from '@/lib/inventory-search';
import { alertsUrl, vendorInventoryUrl } from '@/lib/inventory-url';

export const dynamic = 'force-dynamic';

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ vendor: string; unitKey: string }>;
}) {
  const { vendor: vendorSlug, unitKey } = await params;

  const vendorMeta = await resolveVendorCode(vendorSlug);
  if (!vendorMeta) notFound();

  const hasSnapshot = await vendorHasSnapshot(vendorMeta.code);
  if (!hasSnapshot) notFound();

  const unit = await getInventoryUnitDetail(vendorMeta.code, unitKey);
  if (!unit) notFound();

  const unitLabel = unit.primary_sku ?? 'Unit';

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: 'Inventory hub', href: '/inventory' },
          { label: 'Alert center', href: alertsUrl('all') },
          {
            label: vendorMeta.name,
            href: vendorInventoryUrl(vendorSlug.toLowerCase()),
          },
          { label: unitLabel },
        ]}
      />
      <UnitDetailView unit={unit} />
    </div>
  );
}
