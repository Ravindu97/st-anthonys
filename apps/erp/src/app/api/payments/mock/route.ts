import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { processMockPayment } from '@/lib/payments';
import type { GatewayPaymentMethod } from '@/lib/payments-shared';

export const dynamic = 'force-dynamic';

const METHODS: GatewayPaymentMethod[] = ['cash', 'card', 'account'];

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const canPos = hasPermission(auth.user.role, 'pos:write');
  const canSales = hasPermission(auth.user.role, 'sales:write');
  if (!canPos && !canSales) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const method = body.method as GatewayPaymentMethod;
  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
  }

  const result = await processMockPayment({
    amount: Number(body.amount),
    method,
    customerId: body.customerId,
    simulateDecline: body.simulateDecline === true,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 402 });
  }

  return NextResponse.json(result);
}
