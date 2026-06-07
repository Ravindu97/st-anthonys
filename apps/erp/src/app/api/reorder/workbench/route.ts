import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getDefaultCompanyId } from '@/lib/company';
import { getReorderWorkbench } from '@/lib/reorder';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'reorder:read');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get('tab') ?? 'action') as
    | 'action'
    | 'approved'
    | 'needs_rule'
    | 'history';
  const vendorCode = searchParams.get('vendor') ?? undefined;
  const q = searchParams.get('q') ?? undefined;

  const companyId = await getDefaultCompanyId();
  const result = await getReorderWorkbench({
    companyId,
    tab,
    vendorCode,
    q,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') ?? '50', 10),
  });
  return NextResponse.json(result);
}
