import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { newCorrelationId, recordAuditEvent } from '@/lib/audit';
import { getDefaultCompanyId } from '@/lib/company';
import { getPool } from '@/lib/db';
import { importPriceListCsv } from '@st-anthonys/import/price-list.js';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'pricing:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;

  const form = await request.formData();
  const file = form.get('file');
  const priceLevel = (form.get('priceLevel') as string) ?? 'Retail';
  const categoryCode = (form.get('categoryCode') as string) ?? 'ORANGE';
  const dryRun = form.get('dryRun') === 'true';
  const applicableFrom = (form.get('applicableFrom') as string) || undefined;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'CSV file required' }, { status: 400 });
  }

  const tmpPath = path.join(os.tmpdir(), `price-list-${Date.now()}.csv`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tmpPath, buffer);
  const fileName = file.name || 'upload.csv';

  try {
    const companyId = await getDefaultCompanyId();
    const correlationId = newCorrelationId();
    const actorId = auth.user.id !== 'api-key' ? auth.user.id : null;
    const result = await importPriceListCsv({
      csvPath: tmpPath,
      companyId,
      priceLevelName: priceLevel,
      categoryCode,
      applicableFrom,
      dryRun,
      fileName,
    });

    if (result.priceListId || dryRun) {
      const pool = getPool();
      const entityId = dryRun
        ? randomUUID()
        : (result.importRunId ?? result.priceListId ?? randomUUID());
      const entityType = dryRun ? 'price_list' : 'import_run';
      const action = dryRun ? 'price_list.import_dry_run' : 'import.completed';
      await recordAuditEvent(pool, {
        companyId,
        entityType,
        entityId,
        action,
        actorId,
        summary: dryRun
          ? `Preview ${priceLevel} ${categoryCode} — ${result.imported} tiers`
          : `Imported ${priceLevel} ${categoryCode} — ${result.imported} tiers`,
        recordLabel: `${priceLevel} / ${categoryCode}`,
        correlationId,
        source: 'api',
        metadata: {
          priceLevel,
          categoryCode,
          applicableFrom: applicableFrom ?? null,
          imported: result.imported,
          errorCount: result.errors?.length ?? 0,
          dryRun,
          priceListId: result.priceListId ?? null,
          importRunId: result.importRunId ?? null,
          fileName: result.fileName ?? fileName,
          fileHash: result.fileHash ?? null,
        },
      });
      if (!dryRun && result.priceListId) {
        await recordAuditEvent(pool, {
          companyId,
          entityType: 'price_list',
          entityId: result.priceListId,
          action: 'price_list.imported',
          actorId,
          summary: `Price list ${priceLevel} / ${categoryCode} — ${result.imported} items`,
          recordLabel: `${priceLevel} / ${categoryCode}`,
          correlationId,
          source: 'api',
          metadata: {
            priceLevel,
            categoryCode,
            importRunId: result.importRunId ?? null,
            imported: result.imported,
          },
        });
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
