import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { createPosTransaction, getSessionZReport } from '@/lib/pos';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'pos:read');
  if (auth instanceof NextResponse) return auth;
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }
  const report = await getSessionZReport(sessionId);
  return NextResponse.json(report);
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'pos:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const result = await createPosTransaction({
    sessionId: body.sessionId,
    customerId: body.customerId,
    paymentMethod: body.paymentMethod ?? 'cash',
    lines: body.lines ?? [],
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
