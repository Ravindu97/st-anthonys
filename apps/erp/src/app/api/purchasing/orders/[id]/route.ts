import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getPurchaseOrder } from '@/lib/purchasing';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'purchasing:read');
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const order = await getPurchaseOrder(id);
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}
