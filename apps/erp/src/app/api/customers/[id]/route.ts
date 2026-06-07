import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getCustomer, updateCustomer } from '@/lib/customers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'customers:read');
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ customer });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'customers:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json();
  const customer = await updateCustomer(id, {
    name: body.name,
    customerType: body.customerType,
    priceLevelId: body.priceLevelId,
    creditLimit: body.creditLimit,
    paymentTermsDays: body.paymentTermsDays,
    email: body.email,
    phone: body.phone,
    address: body.address,
    isActive: body.isActive,
  });
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ customer });
}
