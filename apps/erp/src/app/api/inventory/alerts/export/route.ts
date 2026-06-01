import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { searchCrossVendorAlerts } from '@/lib/inventory-search';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'inventory:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const tabParam = searchParams.get('tab') ?? 'all';
  const tab = ['all', 'low', 'out', 'variance', 'new_outs'].includes(tabParam)
    ? (tabParam as 'all' | 'low' | 'out' | 'variance' | 'new_outs')
    : 'all';

  const { items } = await searchCrossVendorAlerts({
    tab,
    page: 1,
    pageSize: 50000,
  });

  const header =
    'Vendor,Unit code,Product,Stock group,Quantity,Unit,Line value,Status\n';
  const rows = items.map((r) =>
    [
      r.vendor_name,
      r.primary_sku ?? '',
      r.item_name,
      r.stock_group_name,
      r.quantity ?? '',
      r.unit_code,
      r.line_value,
      r.alert_status,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(',')
  );

  return new Response(header + rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventory-alerts-${tab}.csv"`,
    },
  });
}
