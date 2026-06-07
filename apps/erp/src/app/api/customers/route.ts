import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { createCustomer, listCustomers } from '@/lib/customers';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'customers:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const customers = await listCustomers({ q: searchParams.get('q') ?? undefined });
  return NextResponse.json({ customers });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'customers:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const companyId = await getDefaultCompanyId();
  const customer = await createCustomer({
    companyId,
    code: body.code,
    name: body.name,
    customerType: body.customerType,
    priceLevelId: body.priceLevelId,
    creditLimit: body.creditLimit,
    paymentTermsDays: body.paymentTermsDays,
    email: body.email,
    phone: body.phone,
    address: body.address,
  });
  return NextResponse.json({ customer });
}
