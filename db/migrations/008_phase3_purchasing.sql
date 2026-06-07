-- Phase 3: suppliers, purchase orders, goods receipt

CREATE TYPE po_status AS ENUM (
  'draft',
  'submitted',
  'partial',
  'received',
  'cancelled'
);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  payment_terms_days INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE stock_item_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  lead_time_days INT NOT NULL DEFAULT 0,
  last_purchase_rate NUMERIC(18, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stock_item_id, supplier_id)
);

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers (id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  status po_status NOT NULL DEFAULT 'draft',
  suggestion_id UUID REFERENCES purchase_suggestions (id) ON DELETE SET NULL,
  subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  expected_date DATE,
  created_by UUID REFERENCES app_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, po_number)
);

CREATE TABLE purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE RESTRICT,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_rate NUMERIC(18, 2) NOT NULL,
  received_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  line_total NUMERIC(18, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (purchase_order_id, line_no)
);

CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  grn_number TEXT NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders (id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID REFERENCES app_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, grn_number)
);

CREATE TABLE goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts (id) ON DELETE CASCADE,
  purchase_order_line_id UUID NOT NULL REFERENCES purchase_order_lines (id) ON DELETE RESTRICT,
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE RESTRICT,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_rate NUMERIC(18, 2) NOT NULL,
  duty_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_orders_status ON purchase_orders (status, created_at DESC);
