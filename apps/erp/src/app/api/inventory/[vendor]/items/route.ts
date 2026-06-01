import { NextResponse } from 'next/server';
import {
  resolveVendorCode,
  searchInventoryItems,
} from '@/lib/inventory-search';
import { parseInventorySearchParams } from '@/lib/api-params';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ vendor: string }> }
) {
  const { vendor } = await params;
  const vendorMeta = await resolveVendorCode(vendor);
  if (!vendorMeta) {
    return NextResponse.json({ error: 'Unknown vendor' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const filters = parseInventorySearchParams(searchParams);

  try {
    const result = await searchInventoryItems(vendorMeta.code, filters);
    return NextResponse.json({
      vendor: vendorMeta,
      filters,
      view: searchParams.get('view') ?? 'table',
      ...result,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Query failed' },
      { status: 500 }
    );
  }
}
