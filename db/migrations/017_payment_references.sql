-- Mock/real payment gateway references on sales documents and POS transactions

ALTER TABLE pos_transactions
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE sales_documents
  ADD COLUMN IF NOT EXISTS payment_method payment_method,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;
