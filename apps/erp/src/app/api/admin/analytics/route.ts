import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { isAdminRole } from '@/lib/auth/permissions';
import { getAnalyticsDashboard } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'analytics:read', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  if (!isAdminRole(auth.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get('type') === 'dashboard') {
    return NextResponse.json({ dashboard: await getAnalyticsDashboard() });
  }

  const dashboard = await getAnalyticsDashboard();
  return NextResponse.json({ kpis: dashboard.kpis });
}
