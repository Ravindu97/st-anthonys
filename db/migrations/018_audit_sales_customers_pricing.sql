-- Extend audit entity types for customers, sales documents, and price lists

ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'customer';
ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'sales_document';
ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'price_list';
