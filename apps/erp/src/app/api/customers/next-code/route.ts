import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { nextCustomerCode } from '@/lib/customers';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'customers:read');
  if (auth instanceof NextResponse) return auth;
  const companyId = await getDefaultCompanyId();
  const code = await nextCustomerCode(companyId);
  return NextResponse.json({ code });
}
