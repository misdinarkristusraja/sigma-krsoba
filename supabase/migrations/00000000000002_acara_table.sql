-- ================================================================
-- SIGMA — Tabel Acara (non-misa events)
-- Acara seperti retret, novena, ziarah, dll — terpisah dari events (misa)
-- Run di: Supabase Dashboard -> SQL Editor
-- Idempotent: aman dijalankan ulang.
-- ================================================================

-- ── Tabel acara ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acara (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        VARCHAR(200) NOT NULL,
  tipe        VARCHAR(100) NOT NULL DEFAULT 'Lainnya',
  tanggal     DATE        NOT NULL,
  jam_mulai   TIME,
  jam_selesai TIME,
  lokasi      VARCHAR(300),
  deskripsi   TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS acara_tanggal_idx ON acara (tanggal DESC);
CREATE INDEX IF NOT EXISTS acara_is_active_idx ON acara (is_active);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE acara ENABLE ROW LEVEL SECURITY;

-- Semua user login bisa baca
CREATE POLICY IF NOT EXISTS "acara_select_auth"
  ON acara FOR SELECT
  TO authenticated
  USING (true);

-- Hanya Administrator dan Pengurus yang bisa insert/update/delete
CREATE POLICY IF NOT EXISTS "acara_insert_peng"
  ON acara FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('Administrator','Pengurus')
    )
  );

CREATE POLICY IF NOT EXISTS "acara_update_peng"
  ON acara FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('Administrator','Pengurus')
    )
  );

CREATE POLICY IF NOT EXISTS "acara_delete_peng"
  ON acara FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('Administrator','Pengurus')
    )
  );

-- ── scan_records: foreign key ke acara (opsional) ────────────────
-- scan_records.acara_id: nullable FK, digunakan jika scan untuk acara
-- bukan misa (event_id tetap nullable untuk misa)
ALTER TABLE scan_records
  ADD COLUMN IF NOT EXISTS acara_id UUID REFERENCES acara(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS scan_records_acara_id_idx
  ON scan_records (acara_id)
  WHERE acara_id IS NOT NULL;
