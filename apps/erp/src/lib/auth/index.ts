export type { Role, Permission } from './permissions';
export { hasPermission, isAdminRole, ROLE_PERMISSIONS } from './permissions';
export { hashPassword, verifyPassword } from './password';
export {
  normalizeEmail,
  findUserByEmail,
  findUserById,
  createUser,
  type AppUser,
} from './users';
export {
  SESSION_COOKIE,
  sessionCookieOptions,
  createSession,
  destroySession,
  verifySessionToken,
  getSessionFromRequest,
  getSessionFromCookies,
  getSessionPayloadFromRequest,
  sessionExists,
  type AuthUser,
  type SessionPayload,
} from './session';
export { requireAuth, requirePermission, type AuthContext } from './guards';
