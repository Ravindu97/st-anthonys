import { NextResponse } from 'next/server';

/** Optional API key for import/adjustment routes (set IMPORT_API_KEY in .env.local). */
export function checkImportAuth(request: Request): NextResponse | null {
  const required = process.env.IMPORT_API_KEY;
  if (!required) return null;

  const header = request.headers.get('x-import-api-key');
  if (header === required) return null;

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
