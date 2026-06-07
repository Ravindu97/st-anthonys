import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { updatePickProgress, updateSalesStatus } from '@/lib/sales';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'sales:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json();

  if (body.action === 'update_pick' && body.lineId != null) {
    const line = await updatePickProgress(id, body.lineId, Number(body.pickedQty));
    return NextResponse.json({ line });
  }

  if (body.action === 'mark_ready') {
    const doc = await updateSalesStatus(id, 'ready_for_pickup');
    return NextResponse.json({ document: doc });
  }

  if (body.action === 'mark_collected') {
    const payment =
      body.paymentMethod && body.paymentReference
        ? {
            method: body.paymentMethod as 'cash' | 'card' | 'account',
            reference: String(body.paymentReference),
          }
        : undefined;
    const doc = await updateSalesStatus(
      id,
      'collected',
      auth.user.id !== 'api-key' ? auth.user.id : undefined,
      payment
    );
    return NextResponse.json({ document: doc });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
