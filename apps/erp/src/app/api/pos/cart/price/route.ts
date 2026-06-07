import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { resolveCartLinePrices } from '@/lib/pos';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'pos:read');
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const locationId = body.locationId as string | undefined;
  if (!locationId) {
    return NextResponse.json({ error: 'locationId required' }, { status: 400 });
  }
  const lines = await resolveCartLinePrices(body.lines ?? [], {
    locationId,
    priceLevelId: body.priceLevelId ?? null,
    customerId: body.customerId,
  });
  return NextResponse.json({ lines });
}
