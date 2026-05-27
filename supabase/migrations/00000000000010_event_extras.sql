-- ================================================================
-- SIGMA — event extras: jumlah_petugas + tanpa_latihan flag
-- ================================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS jumlah_petugas  INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS tanpa_latihan   BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN events.jumlah_petugas IS 'Jumlah petugas per slot untuk event ini (default 8)';
COMMENT ON COLUMN events.tanpa_latihan   IS 'TRUE = tidak ada sesi latihan sebelum misa ini';
