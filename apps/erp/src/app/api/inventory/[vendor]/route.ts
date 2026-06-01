import { NextResponse } from 'next/server';
import {
  getGroupRollupsForVendor,
  resolveVendorCode,
  searchInventoryItems,
} from '@/lib/inventory-search';
import { parseInventorySearchParams } from '@/lib/api-params';

/** @deprecated Use /api/inventory/[vendor]/items and /groups */
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
    const [itemsResult, groups] = await Promise.all([
      searchInventoryItems(vendorMeta.code, { ...filters, pageSize: 2000 }),
      getGroupRollupsForVendor(vendorMeta.code),
    ]);
    return NextResponse.json({
      vendor: vendorMeta.code,
      items: itemsResult.items,
      groups,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Query failed' },
      { status: 500 }
    );
  }
}
