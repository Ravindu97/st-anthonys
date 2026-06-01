import { SignJWT, jwtVerify } from 'jose';
import type { Role } from './permissions';

export const SESSION_COOKIE = 'erp_session';

export type SessionPayload = {
  sub: string;
  role: Role;
  sid: string;
};

export function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set (at least 32 characters) in production');
    }
    return new TextEncoder().encode(
      'dev-only-insecure-session-secret-min-32-chars!!'
    );
  }
  return new TextEncoder().encode(secret);
}

export function sessionTtlSeconds(): number {
  const days = Number(process.env.SESSION_TTL_DAYS ?? '7');
  return Math.max(1, days) * 24 * 60 * 60;
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export async function signSessionPayload(
  payload: SessionPayload,
  exp: number
): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setJti(payload.sid)
    .setExpirationTime(exp)
    .sign(getSessionSecret());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    const sub = payload.sub;
    const sid = payload.jti;
    const role = payload.role;
    if (
      typeof sub !== 'string' ||
      typeof sid !== 'string' ||
      (role !== 'admin' && role !== 'viewer')
    ) {
      return null;
    }
    return { sub, role, sid };
  } catch {
    return null;
  }
}

export function getSessionCookieFromRequest(request: Request): string | null {
  const extended = request as Request & {
    cookies?: { get: (name: string) => { value: string } | undefined };
  };
  if (extended.cookies?.get) {
    return extended.cookies.get(SESSION_COOKIE)?.value ?? null;
  }
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export async function getSessionPayloadFromRequest(
  request: Request
): Promise<SessionPayload | null> {
  const token = getSessionCookieFromRequest(request);
  return verifySessionToken(token);
}
