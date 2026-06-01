import { NextResponse } from 'next/server';
import { checkImportAuth } from '@/lib/import-auth';
import { listImportRuns } from '@/lib/import-runs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = checkImportAuth(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));

  const runs = await listImportRuns(limit);
  return NextResponse.json({ runs });
}
