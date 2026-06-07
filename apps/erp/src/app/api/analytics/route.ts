import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { isAdminRole } from '@/lib/auth/permissions';
import {
  getAnalyticsDashboard,
  getAnalyticsSummary,
  getCustomerOrderGaps,
  getDeadStock,
  getMarginAnalytics,
  getVelocityAnalytics,
  listDeliverySchedules,
} from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'analytics:read');
  if (auth instanceof NextResponse) return auth;
  if (!isAdminRole(auth.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'summary';

  switch (type) {
    case 'margin':
      return NextResponse.json({ items: await getMarginAnalytics() });
    case 'dead_stock':
      return NextResponse.json({ items: await getDeadStock() });
    case 'velocity':
      return NextResponse.json({ items: await getVelocityAnalytics() });
    case 'customer_gaps':
      return NextResponse.json({ items: await getCustomerOrderGaps() });
    case 'deliveries':
      return NextResponse.json({
        items: await listDeliverySchedules({
          status: searchParams.get('status') ?? undefined,
        }),
      });
    case 'dashboard':
      return NextResponse.json({ dashboard: await getAnalyticsDashboard() });
    default:
      return NextResponse.json({ summary: await getAnalyticsSummary() });
  }
}
