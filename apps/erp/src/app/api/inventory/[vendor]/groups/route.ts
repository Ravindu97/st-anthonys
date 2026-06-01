import { NextResponse } from 'next/server';
import {
  getGroupRollupsForVendor,
  resolveVendorCode,
} from '@/lib/inventory-search';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ vendor: string }> }
) {
  const { vendor } = await params;
  const vendorMeta = await resolveVendorCode(vendor);
  if (!vendorMeta) {
    return NextResponse.json({ error: 'Unknown vendor' }, { status: 404 });
  }

  try {
    const groups = await getGroupRollupsForVendor(vendorMeta.code);
    return NextResponse.json({ vendor: vendorMeta, groups });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Query failed' },
      { status: 500 }
    );
  }
}
