import {
  exportInventoryItems,
  resolveVendorCode,
  stockStatusLabel,
} from '@/lib/inventory-search';
import { parseInventorySearchParams } from '@/lib/api-params';

function escapeCsv(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ vendor: string }> }
) {
  const { vendor } = await params;
  const vendorMeta = await resolveVendorCode(vendor);
  if (!vendorMeta) {
    return new Response('Unknown vendor', { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const filters = parseInventorySearchParams(searchParams);

  try {
    const rows = await exportInventoryItems(vendorMeta.code, filters);
    const header = [
      'SKU',
      'Product',
      'Stock Group',
      'Quantity',
      'Unit',
      'Rate',
      'Value',
      'Status',
    ];
    const lines = [
      header.join(','),
      ...rows.map((r) => {
        const qty = Number(r.quantity ?? 0);
        return [
          escapeCsv(r.primary_sku),
          escapeCsv(r.item_name),
          escapeCsv(r.stock_group_name),
          escapeCsv(r.quantity),
          escapeCsv(r.unit_code),
          escapeCsv(r.rate),
          escapeCsv(r.value),
          escapeCsv(stockStatusLabel(qty)),
        ].join(',');
      }),
    ];

    const filename = `${vendorMeta.code.toLowerCase()}-inventory-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'Export failed', {
      status: 500,
    });
  }
}
