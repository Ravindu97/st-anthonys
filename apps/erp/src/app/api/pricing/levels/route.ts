import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { listPriceLevels } from '@/lib/pricing';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'pricing:read');
  if (auth instanceof NextResponse) return auth;
  const companyId = await getDefaultCompanyId();
  const levels = await listPriceLevels(companyId);
  return NextResponse.json({ levels });
}
