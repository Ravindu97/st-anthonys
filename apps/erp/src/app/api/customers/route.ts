import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { createCustomer, listCustomers } from '@/lib/customers';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'customers:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('activeOnly') !== 'false';
  const result = await listCustomers({
    q: searchParams.get('q') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    activeOnly,
  });
  return NextResponse.json({ customers: result.items, ...result });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'customers:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const companyId = await getDefaultCompanyId();
  try {
    const customer = await createCustomer({
      companyId,
      code: body.code?.trim() || undefined,
      name: body.name.trim(),
      customerType: body.customerType,
      priceLevelId: body.priceLevelId || undefined,
      creditLimit: body.creditLimit,
      paymentTermsDays: body.paymentTermsDays,
      email: body.email?.trim() || undefined,
      phone: body.phone?.trim() || undefined,
      address: body.address?.trim() || undefined,
    });
    return NextResponse.json({ customer });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: 'A customer with this code already exists. Try again or use a different code.' },
        { status: 409 }
      );
    }
    throw err;
  }
}
