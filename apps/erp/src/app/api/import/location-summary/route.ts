import {
  getDryRunResult,
  isDryRunComplete,
  runLocationSummaryImport,
  sha256Buffer,
  ImportValidationError,
} from '@st-anthonys/import';
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { newCorrelationId, recordAuditEvent } from '@/lib/audit';
import { requirePermission } from '@/lib/auth';
import { getDefaultCompanyId } from '@/lib/company';
import { syncPurchaseSuggestions } from '@/lib/reorder';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'import:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;

  try {
    const contentType = request.headers.get('content-type') ?? '';
    let content: string;
    let fileName = 'upload.csv';
    let categoryCode = '';
    let locationTallyName: string | null = null;
    let dryRun = false;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (!body?.content) {
        return NextResponse.json(
          { error: 'JSON body must include content and categoryCode' },
          { status: 400 }
        );
      }
      content = String(body.content);
      fileName = body.fileName ?? fileName;
      categoryCode = String(body.categoryCode ?? '').trim();
      locationTallyName = body.locationTallyName
        ? String(body.locationTallyName).trim()
        : null;
      dryRun = Boolean(body.dryRun);
    } else {
      const form = await request.formData();
      const file = form.get('file');
      categoryCode = String(form.get('categoryCode') ?? '').trim();
      locationTallyName = String(form.get('locationTallyName') ?? '').trim() || null;
      dryRun = form.get('dryRun') === 'true' || form.get('dryRun') === '1';

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
      }
      content = await file.text();
      fileName = file.name || fileName;
    }

    if (!categoryCode) {
      return NextResponse.json({ error: 'categoryCode is required' }, { status: 400 });
    }

    const fileHash = sha256Buffer(Buffer.from(content, 'utf8'));
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await runLocationSummaryImport(client, {
        content,
        fileName,
        fileHash,
        categoryCode,
        locationTallyName,
        dryRun,
      });
      await client.query('COMMIT');

      const actorId = auth.user.id !== 'api-key' ? auth.user.id : null;
      const correlationId = newCorrelationId();
      let reorderScan = null;
      if (result.companyId && result.importRunId) {
        await recordAuditEvent(pool, {
          companyId: result.companyId,
          entityType: 'import_run',
          entityId: result.importRunId,
          action: 'import.completed',
          actorId,
          summary: `Imported ${categoryCode} location summary (${fileName})`,
          recordLabel: `${categoryCode} import`,
          correlationId,
          source: 'api',
          metadata: {
            categoryCode,
            fileName,
            fileHash,
            rowCounts: result.rowCounts ?? null,
            snapshotId: result.snapshotId ?? null,
          },
        });
        reorderScan = await syncPurchaseSuggestions(result.companyId, {
          correlationId,
          source: 'system',
        });
      }
      return NextResponse.json({ ...result, dryRun: false, reorderScan });
    } catch (err) {
      if (isDryRunComplete(err)) {
        await client.query('ROLLBACK');
        const preview = getDryRunResult(err);
        let companyId = preview?.companyId;
        if (!companyId) {
          try {
            companyId = await getDefaultCompanyId();
          } catch {
            companyId = undefined;
          }
        }
        if (companyId) {
          const pool2 = getPool();
          await recordAuditEvent(pool2, {
            companyId,
            entityType: 'import_run',
            entityId: newCorrelationId(),
            action: 'import.dry_run',
            actorId: auth.user.id !== 'api-key' ? auth.user.id : null,
            summary: `Preview import ${categoryCode} (${fileName}) — no changes saved`,
            recordLabel: `${categoryCode} preview`,
            source: 'api',
            metadata: { categoryCode, fileName, fileHash, dryRun: true, rowCounts: preview?.rowCounts },
          });
        }
        return NextResponse.json({
          dryRun: true,
          preview,
        });
      }
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (e) {
    if (e instanceof ImportValidationError) {
      return NextResponse.json(
        {
          error: e.message,
          code: 'VALIDATION',
          details: e.details,
          report: e.details,
        },
        { status: 422 }
      );
    }
    const message = e instanceof Error ? e.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
