import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { upsertReorderRule } from '@/lib/reorder';

export const dynamic = 'force-dynamic';

function parseCsvLine(line: string): string[] {
  return line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'reorder:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;

  const text = await request.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) {
    return NextResponse.json({ error: 'CSV needs header + at least one row' }, { status: 400 });
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const skuIdx = header.indexOf('sku');
  const catIdx = header.indexOf('category_code');
  const minIdx = header.indexOf('min_qty');
  const reorderIdx = header.indexOf('reorder_qty');
  const leadIdx = header.indexOf('lead_time_days');

  if (skuIdx < 0 || catIdx < 0 || minIdx < 0 || reorderIdx < 0) {
    return NextResponse.json(
      { error: 'Required columns: sku, category_code, min_qty, reorder_qty' },
      { status: 400 }
    );
  }

  const pool = getPool();
  let imported = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const sku = cols[skuIdx];
    const categoryCode = cols[catIdx];
    const minQty = Number(cols[minIdx]);
    const reorderQty = Number(cols[reorderIdx]);
    const leadTime = leadIdx >= 0 ? Number(cols[leadIdx] ?? 0) : 0;

    if (!sku || !categoryCode || !Number.isFinite(minQty) || !Number.isFinite(reorderQty)) {
      errors.push(`Row ${i + 1}: invalid data`);
      continue;
    }

    const { rows: items } = await pool.query(
      `SELECT si.id AS stock_item_id, loc.id AS location_id
       FROM stock_item_aliases a
       JOIN stock_items si ON si.id = a.item_id
       JOIN stock_categories cat ON cat.id = si.category_id
       JOIN locations loc ON loc.stock_category_id = cat.id AND loc.location_type = 'main'
       WHERE a.alias = $1 AND cat.code = $2
       LIMIT 1`,
      [sku, categoryCode]
    );

    if (items.length === 0) {
      errors.push(`Row ${i + 1}: SKU ${sku} not found for ${categoryCode}`);
      continue;
    }

    await upsertReorderRule({
      stockItemId: items[0].stock_item_id,
      locationId: items[0].location_id,
      minQty,
      reorderQty,
      leadTimeDays: leadTime,
    });
    imported++;
  }

  return NextResponse.json({ imported, errors });
}
