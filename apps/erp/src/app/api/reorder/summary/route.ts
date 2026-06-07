import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getDefaultCompanyId } from '@/lib/company';
import {
  getReorderCountsByVendor,
  getReorderWorkbenchSummary,
} from '@/lib/reorder';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'reorder:read');
  if (auth instanceof NextResponse) return auth;

  const companyId = await getDefaultCompanyId();
  const [summary, byVendor] = await Promise.all([
    getReorderWorkbenchSummary(companyId),
    getReorderCountsByVendor(companyId),
  ]);
  return NextResponse.json({ summary, byVendor });
}
