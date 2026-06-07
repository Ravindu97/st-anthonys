import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { createSupplier, listSuppliers } from '@/lib/purchasing';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'purchasing:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const suppliers = await listSuppliers({ q: searchParams.get('q') ?? undefined });
  return NextResponse.json({ suppliers });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'purchasing:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const companyId = await getDefaultCompanyId();
  const supplier = await createSupplier({
    companyId,
    code: body.code,
    name: body.name,
    email: body.email,
    phone: body.phone,
    paymentTermsDays: body.paymentTermsDays,
  });
  return NextResponse.json({ supplier });
}
