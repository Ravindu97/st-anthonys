import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { listGoodsReceipts } from '@/lib/purchasing';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'purchasing:read', { requireDb: true });
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const result = await listGoodsReceipts({
    purchaseOrderId: searchParams.get('purchaseOrderId') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    page: Number(searchParams.get('page') ?? 1),
    pageSize: Number(searchParams.get('pageSize') ?? 50),
  });

  return NextResponse.json(result);
}
