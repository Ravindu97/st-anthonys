import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import {
  convertQuoteToOrder,
  getSalesDocument,
  updateSalesStatus,
} from '@/lib/sales';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'sales:read');
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const doc = await getSalesDocument(id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'sales:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json();

  if (body.action === 'convert_quote') {
    const result = await convertQuoteToOrder(
      id,
      auth.user.id !== 'api-key' ? auth.user.id : undefined
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.status) {
    const doc = await updateSalesStatus(
      id,
      body.status,
      auth.user.id !== 'api-key' ? auth.user.id : undefined,
      body.paymentMethod && body.paymentReference
        ? {
            method: body.paymentMethod as 'cash' | 'card' | 'account',
            reference: String(body.paymentReference),
          }
        : undefined
    );
    return NextResponse.json({ document: doc });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
