import { NextResponse } from 'next/server';
import { browsePosItems, listPosBrowseVendors } from '@/lib/pos';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { requirePermission } = await import('@/lib/auth');
  const auth = await requirePermission(request, 'pos:read');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json({ error: 'locationId required' }, { status: 400 });
  }

  if (searchParams.get('vendors') === '1') {
    const vendors = await listPosBrowseVendors();
    return NextResponse.json({ vendors });
  }

  const result = await browsePosItems({
    locationId,
    priceLevelId: searchParams.get('priceLevelId'),
    customerId: searchParams.get('customerId') ?? undefined,
    vendorCode: searchParams.get('vendorCode') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    page: Number(searchParams.get('page') ?? 1),
    pageSize: Number(searchParams.get('pageSize') ?? 25),
  });

  return NextResponse.json(result);
}
