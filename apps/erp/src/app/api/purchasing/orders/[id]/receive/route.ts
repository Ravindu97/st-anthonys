import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { receiveGoods } from '@/lib/purchasing';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'purchasing:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json();
  const companyId = await getDefaultCompanyId();
  const result = await receiveGoods({
    companyId,
    purchaseOrderId: id,
    lines: body.lines ?? [],
    createdBy: auth.user.id !== 'api-key' ? auth.user.id : undefined,
    notes: body.notes,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    grnNumber: result.grnNumber,
    grnId: result.grnId,
    poStatus: result.poStatus,
    linesReceived: result.linesReceived,
    inventoryUpdated: result.inventoryUpdated,
    locationName: result.locationName,
  });
}
