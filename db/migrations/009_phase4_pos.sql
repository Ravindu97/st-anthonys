-- Phase 4: POS registers, sessions, transactions

CREATE TYPE payment_method AS ENUM ('cash', 'card', 'account', 'mixed');

CREATE TABLE pos_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  price_level_id UUID REFERENCES price_levels (id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE pos_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID NOT NULL REFERENCES pos_registers (id) ON DELETE RESTRICT,
  opened_by UUID NOT NULL REFERENCES app_users (id) ON DELETE RESTRICT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC(18, 2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(18, 2),
  notes TEXT
);

CREATE TABLE pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES pos_sessions (id) ON DELETE RESTRICT,
  transaction_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  sales_document_id UUID REFERENCES sales_documents (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, transaction_number)
);

CREATE TABLE pos_transaction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES pos_transactions (id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE RESTRICT,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_rate NUMERIC(18, 2) NOT NULL,
  discount_pct NUMERIC(8, 4) NOT NULL DEFAULT 0,
  line_total NUMERIC(18, 2) NOT NULL,
  UNIQUE (transaction_id, line_no)
);

CREATE INDEX idx_pos_sessions_open ON pos_sessions (register_id) WHERE closed_at IS NULL;
