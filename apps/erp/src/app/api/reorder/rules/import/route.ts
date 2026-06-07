import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { importReorderRulesCsv } from '@/lib/reorder-import';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'reorder:write', { requireDb: true });
  if (auth instanceof NextResponse) return auth;

  const text = await request.text();
  const fileName = request.headers.get('x-file-name') ?? 'upload.csv';
  const actorId = auth.user.id !== 'api-key' ? auth.user.id : undefined;

  const result = await importReorderRulesCsv({ content: text, fileName, actorId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ imported: result.imported, errors: result.errors });
}
