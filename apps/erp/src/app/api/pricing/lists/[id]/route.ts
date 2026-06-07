import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getPriceListItems } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pricing:read');
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const items = await getPriceListItems(id);
  return NextResponse.json({ items });
}
