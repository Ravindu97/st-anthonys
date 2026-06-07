import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getPosTransactionDocument } from '@/lib/pos';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pos:read');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const document = await getPosTransactionDocument(id);
  if (!document) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  return NextResponse.json(document);
}
