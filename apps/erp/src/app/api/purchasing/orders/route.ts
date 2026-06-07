import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { createPurchaseOrderFromSuggestion, listPurchaseOrders } from '@/lib/purchasing';
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

  return NextResponse.json({ error: 'suggestionId and supplierId required' }, { status: 400 });
}
