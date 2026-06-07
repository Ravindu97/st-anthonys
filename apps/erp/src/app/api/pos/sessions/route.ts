import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { closePosSession, getOpenSession, openPosSession } from '@/lib/pos';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'pos:read');
  if (auth instanceof NextResponse) return auth;
  const registerId = new URL(request.url).searchParams.get('registerId');
  if (!registerId) {
    return NextResponse.json({ error: 'registerId required' }, { status: 400 });
  }
  const session = await getOpenSession(registerId);
  return NextResponse.json({ session });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'pos:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();

  if (body.action === 'open') {
    const result = await openPosSession({
      registerId: body.registerId,
      openedBy: auth.user.id,
      openingCash: body.openingCash,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.action === 'close' && body.sessionId) {
    const session = await closePosSession(
      body.sessionId,
      Number(body.closingCash ?? 0),
      auth.user.id
    );
    return NextResponse.json({ session });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
