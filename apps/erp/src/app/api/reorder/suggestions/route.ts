import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import {
  listPurchaseSuggestions,
  syncPurchaseSuggestions,
  updatePurchaseSuggestionStatus,
} from '@/lib/reorder';
import { getDefaultCompanyId } from '@/lib/company';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'reorder:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const result = await listPurchaseSuggestions({
    status: searchParams.get('status') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'reorder:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();

  if (body.action === 'sync') {
    const companyId = body.companyId ?? (await getDefaultCompanyId());
    const result = await syncPurchaseSuggestions(companyId);
    return NextResponse.json(result);
  }

  if (body.action === 'update_status' && body.id && body.status) {
    const updated = await updatePurchaseSuggestionStatus(
      body.id,
      body.status,
      auth.user.id !== 'api-key' ? auth.user.id : undefined
    );
    return NextResponse.json({ suggestion: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
