-- Phase 2 audit: POS sessions, reorder rules, price list import source

ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'pos_session';
ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'reorder_rule';

ALTER TYPE import_source ADD VALUE IF NOT EXISTS 'tally_price_list_csv';
