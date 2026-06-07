export type Role = 'admin' | 'viewer' | 'purchasing' | 'sales' | 'cashier';

export type Permission =
  | 'inventory:read'
  | 'import:read'
  | 'import:write'
  | 'inventory:adjust'
  | 'reorder:read'
  | 'reorder:write'
  | 'pricing:read'
  | 'pricing:write'
  | 'customers:read'
  | 'customers:write'
  | 'sales:read'
  | 'sales:write'
  | 'purchasing:read'
  | 'purchasing:write'
  | 'pos:read'
  | 'pos:write'
  | 'analytics:read'
  | 'audit:read';

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    'inventory:read',
    'import:read',
    'import:write',
    'inventory:adjust',
    'reorder:read',
    'reorder:write',
    'pricing:read',
    'pricing:write',
    'customers:read',
    'customers:write',
    'sales:read',
    'sales:write',
    'purchasing:read',
    'purchasing:write',
    'pos:read',
    'pos:write',
    'analytics:read',
    'audit:read',
  ],
  viewer: [
    'inventory:read',
    'import:read',
    'reorder:read',
    'pricing:read',
    'customers:read',
    'sales:read',
    'purchasing:read',
    'pos:read',
    'analytics:read',
  ],
  purchasing: [
    'inventory:read',
    'reorder:read',
    'reorder:write',
    'purchasing:read',
    'purchasing:write',
    'analytics:read',
  ],
  sales: [
    'inventory:read',
    'customers:read',
    'customers:write',
    'sales:read',
    'sales:write',
    'pricing:read',
    'analytics:read',
  ],
  cashier: ['inventory:read', 'pos:read', 'pos:write', 'customers:read', 'pricing:read'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isAdminRole(role: Role): boolean {
  return role === 'admin';
}
