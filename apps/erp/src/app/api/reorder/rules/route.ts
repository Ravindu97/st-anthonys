import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { listReorderRules, upsertReorderRule } from '@/lib/reorder';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'reorder:read');
  if (auth instanceof NextResponse) return auth;
  const rules = await listReorderRules();
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'reorder:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const rule = await upsertReorderRule({
    stockItemId: body.stockItemId,
    locationId: body.locationId,
    minQty: Number(body.minQty),
    reorderQty: Number(body.reorderQty),
    leadTimeDays: body.leadTimeDays != null ? Number(body.leadTimeDays) : undefined,
  });
  return NextResponse.json({ rule });
}
