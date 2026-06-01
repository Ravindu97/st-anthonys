export type Role = 'admin' | 'viewer';

export type Permission =
  | 'inventory:read'
  | 'import:read'
  | 'import:write'
  | 'inventory:adjust';

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    'inventory:read',
    'import:read',
    'import:write',
    'inventory:adjust',
  ],
  viewer: ['inventory:read', 'import:read'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isAdminRole(role: Role): boolean {
  return role === 'admin';
}
