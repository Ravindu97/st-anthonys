import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { searchStockItems } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'pricing:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json({ items: [] });
  const categoryId = searchParams.get('categoryId') ?? undefined;
  const items = await searchStockItems({ q, categoryId });
  return NextResponse.json({ items });
}
