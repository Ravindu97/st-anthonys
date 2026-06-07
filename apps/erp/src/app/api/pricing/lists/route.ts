import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { listPriceLists } from '@/lib/pricing';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'pricing:read');
  if (auth instanceof NextResponse) return auth;
  const companyId = await getDefaultCompanyId();
  const { searchParams } = new URL(request.url);
  const result = await listPriceLists(companyId, {
    page: parseInt(searchParams.get('page') ?? '1', 10),
  });
  return NextResponse.json({ lists: result.items, ...result });
}
