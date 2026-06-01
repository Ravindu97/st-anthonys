import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getImportRun } from '@/lib/import-runs';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'import:read');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const run = await getImportRun(id);
  if (!run) {
    return NextResponse.json({ error: 'Import run not found' }, { status: 404 });
  }
  return NextResponse.json({ run });
}
