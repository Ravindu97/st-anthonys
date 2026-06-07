-- Audit trail enhancements: correlation, diffs, record labels, extended entity types

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS changes JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS record_label TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_events_correlation
  ON audit_events (correlation_id, created_at DESC)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_metadata
  ON audit_events USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_audit_events_record_label
  ON audit_events (record_label)
  WHERE record_label IS NOT NULL;

ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'import_run';
ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'inventory_adjustment';
ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'stock_item';
