import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getPriceList, listPriceListItems } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pricing:read');
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const priceList = await getPriceList(id);
  if (!priceList) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? undefined;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10);

  const result = await listPriceListItems(id, { q, page, pageSize });

  if (searchParams.has('itemsOnly')) {
    return NextResponse.json(result);
  }

  return NextResponse.json({ priceList, ...result });
}
