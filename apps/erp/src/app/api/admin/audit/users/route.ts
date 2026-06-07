import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { listAuditUsers } from '@/lib/audit';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'audit:read');
  if (auth instanceof NextResponse) return auth;

  const users = await listAuditUsers();
  return NextResponse.json({ users });
}
