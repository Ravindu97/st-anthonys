import { NextResponse } from 'next/server';
import { getActiveVendors } from '@/lib/inventory-search';

export async function GET() {
  try {
    const vendors = await getActiveVendors();
    return NextResponse.json({ vendors });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load vendors' },
      { status: 500 }
    );
  }
}
