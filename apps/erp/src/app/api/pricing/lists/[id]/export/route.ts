import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { exportPriceListItems, recordPriceListExportAudit } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

function escapeCsv(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pricing:read', { requireDb: true });
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const { rows, meta } = await exportPriceListItems(id);
    const header = ['sku', 'item_name', 'from_qty', 'less_than_qty', 'rate', 'discount_pct'];
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [
          escapeCsv(r.primary_sku),
          escapeCsv(r.item_name),
          escapeCsv(r.from_qty),
          escapeCsv(r.less_than_qty),
          escapeCsv(r.rate),
          escapeCsv(r.discount_pct),
        ].join(',')
      ),
    ];

    const actorId = auth.user.id !== 'api-key' ? auth.user.id : null;
    await recordPriceListExportAudit({
      priceListId: id,
      actorId,
      rowCount: rows.length,
    });

    const slug = meta.scopeLabel.replace(/\s+/g, '-').toLowerCase();
    const filename = `${meta.priceLevelName.toLowerCase()}-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Export failed';
    return new Response(message, { status: e instanceof Error && message.includes('not found') ? 404 : 500 });
  }
}
