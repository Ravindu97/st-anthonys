import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { listImportRuns } from '@/lib/import-runs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'import:read');
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));

  const runs = await listImportRuns(limit);
  return NextResponse.json({ runs });
}
