import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getActiveVendors } from '@/lib/inventory-search';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'inventory:read');
  if (auth instanceof NextResponse) return auth;
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
