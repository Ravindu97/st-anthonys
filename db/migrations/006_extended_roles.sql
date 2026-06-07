-- Extended RBAC roles for hybrid ERP workflows

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'purchasing';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'cashier';
