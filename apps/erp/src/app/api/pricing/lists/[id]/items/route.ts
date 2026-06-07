import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getPriceList, upsertPriceListItem } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pricing:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const priceList = await getPriceList(id);
  if (!priceList) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  if (!body.stockItemId) {
    return NextResponse.json({ error: 'stockItemId is required' }, { status: 400 });
  }
  if (body.rate === undefined || body.rate === null || Number.isNaN(Number(body.rate))) {
    return NextResponse.json({ error: 'rate is required' }, { status: 400 });
  }

  await upsertPriceListItem({
    priceListId: id,
    stockItemId: body.stockItemId,
    fromQty: body.fromQty ?? 0,
    lessThanQty: body.lessThanQty ?? null,
    rate: Number(body.rate),
    discountPct: body.discountPct ?? 0,
  });

  return NextResponse.json({ ok: true });
}
