import { NextResponse } from 'next/server';
import {
  destroySession,
  getSessionFromRequest,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getSessionFromRequest(request);
  if (user) {
    await destroySession(user.sessionId);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(0), maxAge: 0 });
  return response;
}
