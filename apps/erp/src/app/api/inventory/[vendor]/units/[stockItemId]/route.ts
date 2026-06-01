import { NextResponse } from 'next/server';
import { checkImportAuth } from '@/lib/import-auth';
import { patchUnitBalance } from '@/lib/inventory-adjustments';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ vendor: string; stockItemId: string }> }
) {
  const denied = checkImportAuth(request);
  if (denied) return denied;

  const { vendor, stockItemId } = await params;

  let body: {
    quantity?: number | null;
    rate?: number | null;
    value?: number | null;
    note?: string;
    allowVariance?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const result = await patchUnitBalance(vendor, stockItemId, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
