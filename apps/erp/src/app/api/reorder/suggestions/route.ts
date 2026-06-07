import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getDefaultCompanyId } from '@/lib/company';
import {
  bulkUpdateSuggestionStatus,
  createSuggestionForItem,
  getLocationIdForItemCategory,
  listPurchaseSuggestions,
  revertSuggestionToDraft,
  syncPurchaseSuggestions,
  updatePurchaseSuggestionStatus,
  updateSuggestionQty,
} from '@/lib/reorder';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'reorder:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const result = await listPurchaseSuggestions({
    status: searchParams.get('status') ?? undefined,
    vendorCode: searchParams.get('vendor') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'reorder:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const userId = auth.user.id !== 'api-key' ? auth.user.id : undefined;
  const companyId = await getDefaultCompanyId();

  if (body.action === 'sync') {
    const result = await syncPurchaseSuggestions(body.companyId ?? companyId);
    return NextResponse.json(result);
  }

  if (body.action === 'create_for_item' && body.stockItemId) {
    const locationId =
      body.locationId ?? (await getLocationIdForItemCategory(body.stockItemId));
    if (!locationId) {
      return NextResponse.json({ error: 'No main location for item' }, { status: 400 });
    }
    const result = await createSuggestionForItem({
      companyId,
      stockItemId: body.stockItemId,
      locationId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  }

  if (body.action === 'update_status' && body.id && body.status) {
    const updated = await updatePurchaseSuggestionStatus(
      body.id,
      body.status,
      userId,
      body.dismissedNote
    );
    return NextResponse.json({ suggestion: updated });
  }

  if (body.action === 'bulk_approve' && Array.isArray(body.ids)) {
    const count = await bulkUpdateSuggestionStatus(body.ids, 'approved', userId);
    return NextResponse.json({ updated: count });
  }

  if (body.action === 'bulk_dismiss' && Array.isArray(body.ids)) {
    let count = 0;
    for (const id of body.ids) {
      await updatePurchaseSuggestionStatus(id, 'cancelled', userId, body.note ?? 'Dismissed');
      count++;
    }
    return NextResponse.json({ updated: count });
  }

  if (body.action === 'revert_to_draft' && body.id) {
    const updated = await revertSuggestionToDraft(body.id);
    if (!updated) {
      return NextResponse.json({ error: 'Not found or not approved' }, { status: 400 });
    }
    return NextResponse.json({ suggestion: updated });
  }

  if (body.action === 'update_qty' && body.id != null && body.qty != null) {
    const updated = await updateSuggestionQty(body.id, Number(body.qty));
    return NextResponse.json({ suggestion: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
