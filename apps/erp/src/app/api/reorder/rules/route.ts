import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import {
  listCategoryDefaults,
  listReorderRules,
  upsertCategoryDefault,
  upsertReorderRule,
} from '@/lib/reorder';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'reorder:read');
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  if (searchParams.get('defaults') === '1') {
    const defaults = await listCategoryDefaults();
    return NextResponse.json({ defaults });
  }
  const result = await listReorderRules({
    categoryCode: searchParams.get('vendor') ?? undefined,
    stockItemId: searchParams.get('stockItemId') ?? undefined,
    locationId: searchParams.get('locationId') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('pageSize') ?? '50', 10),
  });
  return NextResponse.json({
    rules: result.items,
    totalCount: result.totalCount,
    page: result.page,
    pageSize: result.pageSize,
  });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'reorder:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();

  if (body.type === 'category_default') {
    const row = await upsertCategoryDefault({
      categoryId: body.categoryId,
      locationType: body.locationType,
      defaultMinQty: Number(body.defaultMinQty),
      defaultReorderQty: Number(body.defaultReorderQty),
    });
    return NextResponse.json({ default: row });
  }

  const rule = await upsertReorderRule({
    stockItemId: body.stockItemId,
    locationId: body.locationId,
    minQty: Number(body.minQty),
    reorderQty: Number(body.reorderQty),
    leadTimeDays: body.leadTimeDays != null ? Number(body.leadTimeDays) : undefined,
  });
  return NextResponse.json({ rule });
}
