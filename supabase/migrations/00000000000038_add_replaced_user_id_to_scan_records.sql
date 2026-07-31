-- Migration 038: Add replaced_user_id to scan_records for Smart Override Substitusi Mendadak
ALTER TABLE scan_records
  ADD COLUMN IF NOT EXISTS replaced_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
