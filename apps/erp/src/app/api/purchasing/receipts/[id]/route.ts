import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getGoodsReceiptDocument } from '@/lib/purchasing';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'purchasing:read', { requireDb: true });
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const document = await getGoodsReceiptDocument(id);
  if (!document) {
    return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
  }
  return NextResponse.json(document);
}
