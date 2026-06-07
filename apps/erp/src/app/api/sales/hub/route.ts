import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { listSalesHub, type SalesHubChannel } from '@/lib/sales-hub';

export const dynamic = 'force-dynamic';

const CHANNELS: SalesHubChannel[] = ['all', 'counter', 'pickup', 'delivery', 'quote'];

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const canSales = hasPermission(auth.user.role, 'sales:read');
  const canPos = hasPermission(auth.user.role, 'pos:read');
  if (!canSales && !canPos) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const channelParam = searchParams.get('channel') ?? 'all';
  const channel = CHANNELS.includes(channelParam as SalesHubChannel)
    ? (channelParam as SalesHubChannel)
    : 'all';

  if (!canSales && channel !== 'counter' && channel !== 'all') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await listSalesHub({
    channel,
    q: searchParams.get('q') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    includeDocuments: canSales,
    includePos: canPos,
  });

  return NextResponse.json(result);
}
