-- Phase 2: customers, sales quotes/orders, click-and-collect

CREATE TYPE sales_doc_status AS ENUM (
  'draft',
  'confirmed',
  'picking',
  'ready_for_pickup',
  'collected',
  'delivered',
  'cancelled'
);

CREATE TYPE fulfillment_type AS ENUM ('pickup', 'delivery', 'counter');

CREATE TYPE sales_doc_kind AS ENUM ('quote', 'order');

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  customer_type TEXT NOT NULL DEFAULT 'contractor',
  price_level_id UUID REFERENCES price_levels (id) ON DELETE SET NULL,
  credit_limit NUMERIC(18, 2),
  payment_terms_days INT NOT NULL DEFAULT 30,
  email TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE sales_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  doc_kind sales_doc_kind NOT NULL DEFAULT 'order',
  doc_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
  status sales_doc_status NOT NULL DEFAULT 'draft',
  fulfillment_type fulfillment_type NOT NULL DEFAULT 'pickup',
  price_level_id UUID REFERENCES price_levels (id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations (id) ON DELETE SET NULL,
  subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  valid_until DATE,
  source_quote_id UUID REFERENCES sales_documents (id) ON DELETE SET NULL,
  created_by UUID REFERENCES app_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, doc_number)
);

CREATE TABLE sales_document_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES sales_documents (id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  stock_item_id UUID NOT NULL REFERENCES stock_items (id) ON DELETE RESTRICT,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_rate NUMERIC(18, 2) NOT NULL,
  discount_pct NUMERIC(8, 4) NOT NULL DEFAULT 0,
  line_total NUMERIC(18, 2) NOT NULL,
  is_special_order BOOLEAN NOT NULL DEFAULT false,
  picked_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, line_no)
);

CREATE INDEX idx_sales_documents_status ON sales_documents (status, updated_at DESC);
CREATE INDEX idx_sales_documents_customer ON sales_documents (customer_id);
