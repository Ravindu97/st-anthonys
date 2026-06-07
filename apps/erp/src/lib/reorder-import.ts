import { createHash } from 'crypto';
import { newCorrelationId, recordAuditEvent } from './audit';
import { getPool } from './db';
import { upsertReorderRule } from './reorder';

function parseCsvLine(line: string): string[] {
  return line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
}

export async function importReorderRulesCsv(input: {
  content: string;
  fileName?: string;
  actorId?: string;
}) {
  const lines = input.content.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) {
    return { ok: false as const, error: 'CSV needs header + at least one row' };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const skuIdx = header.indexOf('sku');
  const catIdx = header.indexOf('category_code');
  const minIdx = header.indexOf('min_qty');
  const reorderIdx = header.indexOf('reorder_qty');
  const leadIdx = header.indexOf('lead_time_days');

  if (skuIdx < 0 || catIdx < 0 || minIdx < 0 || reorderIdx < 0) {
    return {
      ok: false as const,
      error: 'Required columns: sku, category_code, min_qty, reorder_qty',
    };
  }

  const pool = getPool();
  let imported = 0;
  const errors: string[] = [];
  let companyId: string | null = null;
  const correlationId = newCorrelationId();

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
      `SELECT si.id AS stock_item_id, loc.id AS location_id, loc.company_id
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

    companyId = items[0].company_id as string;
    await upsertReorderRule({
      stockItemId: items[0].stock_item_id,
      locationId: items[0].location_id,
      minQty,
      reorderQty,
      leadTimeDays: leadTime,
      skipAudit: true,
    });
    imported++;
  }

  if (companyId && imported > 0) {
    const fileHash = createHash('sha256').update(input.content, 'utf8').digest('hex');
    await recordAuditEvent(pool, {
      companyId,
      entityType: 'reorder_rule',
      entityId: correlationId,
      action: 'reorder.rules_imported',
      actorId: input.actorId,
      summary: `Imported ${imported} reorder rule(s) from ${input.fileName ?? 'CSV'}`,
      recordLabel: `Rules import ×${imported}`,
      correlationId,
      source: 'api',
      metadata: {
        fileName: input.fileName ?? null,
        fileHash,
        imported,
        errorCount: errors.length,
      },
    });
  }

  return { ok: true as const, imported, errors };
}
