-- ================================================================
-- Migration 005: Dynamic PIC per slot (event_pics table)
-- Replaces fixed pic_slot_1a/1b...4a/4b columns on events table.
-- Old columns kept for backward-compat during transition, will be
-- dropped in a future migration once frontend is fully migrated.
-- ================================================================

-- ----------------------------------------------------------------
-- TABLE: event_pics
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_pics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slot       INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 10),
  nama       VARCHAR(100) NOT NULL,
  hp         VARCHAR(30),
  urutan     INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, slot, urutan)
);

CREATE INDEX IF NOT EXISTS idx_event_pics_event ON event_pics (event_id);
CREATE INDEX IF NOT EXISTS idx_event_pics_slot  ON event_pics (event_id, slot);

-- ----------------------------------------------------------------
-- TABLE: event_pelatih (ganti pelatih_slot_1/2/3 fixed columns)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_pelatih (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  nama       VARCHAR(100) NOT NULL,
  urutan     INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, urutan)
);

CREATE INDEX IF NOT EXISTS idx_event_pelatih_event ON event_pelatih (event_id);

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
ALTER TABLE event_pics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_pelatih ENABLE ROW LEVEL SECURITY;

CREATE POLICY epics_read  ON event_pics FOR SELECT USING (TRUE);
CREATE POLICY epics_write ON event_pics FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

CREATE POLICY eplt_read  ON event_pelatih FOR SELECT USING (TRUE);
CREATE POLICY eplt_write ON event_pelatih FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus','Pelatih'));

-- ----------------------------------------------------------------
-- GRANTS
-- ----------------------------------------------------------------
GRANT ALL ON event_pics    TO service_role, authenticated;
GRANT ALL ON event_pelatih TO service_role, authenticated;

-- ----------------------------------------------------------------
-- Backfill slot 1
-- ----------------------------------------------------------------
INSERT INTO event_pics (event_id, slot, nama, hp, urutan)
SELECT id, 1, pic_slot_1a, pic_hp_slot_1a, 1
FROM events WHERE pic_slot_1a IS NOT NULL AND pic_slot_1a != ''
ON CONFLICT (event_id, slot, urutan) DO NOTHING;

INSERT INTO event_pics (event_id, slot, nama, hp, urutan)
SELECT id, 1, pic_slot_1b, pic_hp_slot_1b,
  CASE WHEN pic_slot_1a IS NOT NULL AND pic_slot_1a != '' THEN 2 ELSE 1 END
FROM events WHERE pic_slot_1b IS NOT NULL AND pic_slot_1b != ''
ON CONFLICT (event_id, slot, urutan) DO NOTHING;

-- ----------------------------------------------------------------
-- Backfill slot 2
-- ----------------------------------------------------------------
INSERT INTO event_pics (event_id, slot, nama, hp, urutan)
SELECT id, 2, pic_slot_2a, pic_hp_slot_2a, 1
FROM events WHERE pic_slot_2a IS NOT NULL AND pic_slot_2a != ''
ON CONFLICT (event_id, slot, urutan) DO NOTHING;

INSERT INTO event_pics (event_id, slot, nama, hp, urutan)
SELECT id, 2, pic_slot_2b, pic_hp_slot_2b,
  CASE WHEN pic_slot_2a IS NOT NULL AND pic_slot_2a != '' THEN 2 ELSE 1 END
FROM events WHERE pic_slot_2b IS NOT NULL AND pic_slot_2b != ''
ON CONFLICT (event_id, slot, urutan) DO NOTHING;

-- ----------------------------------------------------------------
-- Backfill slot 3
-- ----------------------------------------------------------------
INSERT INTO event_pics (event_id, slot, nama, hp, urutan)
SELECT id, 3, pic_slot_3a, pic_hp_slot_3a, 1
FROM events WHERE pic_slot_3a IS NOT NULL AND pic_slot_3a != ''
ON CONFLICT (event_id, slot, urutan) DO NOTHING;

INSERT INTO event_pics (event_id, slot, nama, hp, urutan)
SELECT id, 3, pic_slot_3b, pic_hp_slot_3b,
  CASE WHEN pic_slot_3a IS NOT NULL AND pic_slot_3a != '' THEN 2 ELSE 1 END
FROM events WHERE pic_slot_3b IS NOT NULL AND pic_slot_3b != ''
ON CONFLICT (event_id, slot, urutan) DO NOTHING;

-- ----------------------------------------------------------------
-- Backfill slot 4
-- ----------------------------------------------------------------
INSERT INTO event_pics (event_id, slot, nama, hp, urutan)
SELECT id, 4, pic_slot_4a, pic_hp_slot_4a, 1
FROM events WHERE pic_slot_4a IS NOT NULL AND pic_slot_4a != ''
ON CONFLICT (event_id, slot, urutan) DO NOTHING;

INSERT INTO event_pics (event_id, slot, nama, hp, urutan)
SELECT id, 4, pic_slot_4b, pic_hp_slot_4b,
  CASE WHEN pic_slot_4a IS NOT NULL AND pic_slot_4a != '' THEN 2 ELSE 1 END
FROM events WHERE pic_slot_4b IS NOT NULL AND pic_slot_4b != ''
ON CONFLICT (event_id, slot, urutan) DO NOTHING;

-- ----------------------------------------------------------------
-- Backfill pelatih
-- ----------------------------------------------------------------
INSERT INTO event_pelatih (event_id, nama, urutan)
SELECT id, pelatih_slot_1, 1 FROM events
WHERE pelatih_slot_1 IS NOT NULL AND pelatih_slot_1 != ''
ON CONFLICT (event_id, urutan) DO NOTHING;

INSERT INTO event_pelatih (event_id, nama, urutan)
SELECT id, pelatih_slot_2, 2 FROM events
WHERE pelatih_slot_2 IS NOT NULL AND pelatih_slot_2 != ''
ON CONFLICT (event_id, urutan) DO NOTHING;

INSERT INTO event_pelatih (event_id, nama, urutan)
SELECT id, pelatih_slot_3, 3 FROM events
WHERE pelatih_slot_3 IS NOT NULL AND pelatih_slot_3 != ''
ON CONFLICT (event_id, urutan) DO NOTHING;

SELECT 'Migration 005 OK: event_pics + event_pelatih created, backfill done' AS status;
