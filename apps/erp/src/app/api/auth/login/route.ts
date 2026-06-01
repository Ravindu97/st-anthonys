import { NextResponse } from 'next/server';
import {
  createSession,
  findUserByEmail,
  normalizeEmail,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifyPassword,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = body.email ? normalizeEmail(String(body.email)) : '';
  const password = body.password ? String(body.password) : '';

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 }
    );
  }

  const user = await findUserByEmail(email);
  if (!user || !user.is_active) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  const { token, maxAge } = await createSession({
    id: user.id,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
  });

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return response;
}
