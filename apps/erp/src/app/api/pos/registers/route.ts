import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { listRegisters } from '@/lib/pos';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'pos:read');
  if (auth instanceof NextResponse) return auth;
  const companyId = await getDefaultCompanyId();
  const registers = await listRegisters(companyId);
  return NextResponse.json({ registers });
}
