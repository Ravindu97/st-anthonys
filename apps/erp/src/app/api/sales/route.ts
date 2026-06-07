import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { createSalesDocument, listSalesDocuments } from '@/lib/sales';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'sales:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const result = await listSalesDocuments({
    docKind: searchParams.get('kind') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'sales:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const companyId = await getDefaultCompanyId();
  const result = await createSalesDocument({
    companyId,
    docKind: body.docKind ?? 'order',
    customerId: body.customerId,
    fulfillmentType: body.fulfillmentType,
    priceLevelId: body.priceLevelId,
    locationId: body.locationId,
    notes: body.notes,
    validUntil: body.validUntil,
    createdBy: auth.user.id !== 'api-key' ? auth.user.id : undefined,
    lines: body.lines ?? [],
  });
  return NextResponse.json(result);
}
