import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getStockMovements } from '@/lib/stock-movements';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ stockItemId: string }> }
) {
  const auth = await requirePermission(request, 'inventory:read');
  if (auth instanceof NextResponse) return auth;
  const { stockItemId } = await params;
  const { searchParams } = new URL(request.url);
  const movements = await getStockMovements(
    stockItemId,
    searchParams.get('locationId') ?? undefined
  );
  return NextResponse.json({ movements });
}
