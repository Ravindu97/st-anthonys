-- Audit entity type for POS counter sales

ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'pos_transaction';
