import { NextResponse } from 'next/server';
import type { Permission } from './permissions';
import { hasPermission } from './permissions';
import {
  getSessionFromRequest,
  type AuthUser,
} from './session';

function apiKeyIsAdmin(request: Request): boolean {
  const required = process.env.IMPORT_API_KEY;
  if (!required) return false;
  const header = request.headers.get('x-import-api-key');
  return header === required;
}

export type AuthContext = {
  user: AuthUser;
  viaApiKey: boolean;
};

export async function requireAuth(
  request: Request,
  options?: { requireDb?: boolean }
): Promise<NextResponse | AuthContext> {
  if (apiKeyIsAdmin(request)) {
    return {
      user: {
        id: 'api-key',
        email: 'api-key@system',
        role: 'admin',
        is_active: true,
        sessionId: 'api-key',
      },
      viaApiKey: true,
    };
  }

  const user = await getSessionFromRequest(request, {
    requireDb: options?.requireDb ?? false,
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { user, viaApiKey: false };
}

export async function requirePermission(
  request: Request,
  permission: Permission,
  options?: { requireDb?: boolean }
): Promise<NextResponse | AuthContext> {
  const auth = await requireAuth(request, options);
  if (auth instanceof NextResponse) return auth;

  if (!hasPermission(auth.user.role, permission)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return auth;
}
