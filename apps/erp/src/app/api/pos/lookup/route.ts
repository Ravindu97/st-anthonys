import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { lookupSku } from '@/lib/pos';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'pos:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q) return NextResponse.json({ items: [] });
  const items = await lookupSku(q, searchParams.get('locationId') ?? undefined);
  return NextResponse.json({ items });
}
