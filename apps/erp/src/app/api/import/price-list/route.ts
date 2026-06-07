import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getDefaultCompanyId } from '@/lib/company';
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

  try {
    const companyId = await getDefaultCompanyId();
    const result = await importPriceListCsv({
      csvPath: tmpPath,
      companyId,
      priceLevelName: priceLevel,
      categoryCode,
      applicableFrom,
      dryRun,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
