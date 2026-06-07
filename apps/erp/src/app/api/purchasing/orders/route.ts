import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import {
  createPurchaseOrderFromSuggestion,
  createPurchaseOrderFromSuggestions,
  listPurchaseOrders,
} from '@/lib/purchasing';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'purchasing:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const result = await listPurchaseOrders({
    status: searchParams.get('status') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'purchasing:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const companyId = await getDefaultCompanyId();

  if (Array.isArray(body.suggestionIds) && body.suggestionIds.length > 0 && body.supplierId) {
    const result = await createPurchaseOrderFromSuggestions({
      companyId,
      suggestionIds: body.suggestionIds,
      supplierId: body.supplierId,
      locationId: body.locationId,
      createdBy: auth.user.id !== 'api-key' ? auth.user.id : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.suggestionId && body.supplierId) {
    const result = await createPurchaseOrderFromSuggestion({
      companyId,
      suggestionId: body.suggestionId,
      supplierId: body.supplierId,
      createdBy: auth.user.id !== 'api-key' ? auth.user.id : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: 'supplierId and suggestionId or suggestionIds required' },
    { status: 400 }
  );
}
