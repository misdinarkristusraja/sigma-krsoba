-- Migration 035: Personal Growth & Quality Analytics Schema
-- 1. Upgrade scan_records to include direct event_id / latihan_id links
ALTER TABLE scan_records 
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latihan_id UUID REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scan_records_event ON scan_records(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_records_latihan ON scan_records(latihan_id);

-- 2. Create user_badges table
CREATE TABLE IF NOT EXISTS user_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key   VARCHAR(50) NOT NULL,
  title       VARCHAR(100) NOT NULL,
  description TEXT,
  icon_name   VARCHAR(50),
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_badges_select ON user_badges FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')
  ));

CREATE POLICY user_badges_insert ON user_badges FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')
  ));

-- 3. Create user_evaluations table
CREATE TABLE IF NOT EXISTS user_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evaluator_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  periode         VARCHAR(20) NOT NULL,
  skor_sikap      INTEGER CHECK (skor_sikap BETWEEN 1 AND 5),
  skor_kerapian   INTEGER CHECK (skor_kerapian BETWEEN 1 AND 5),
  catatan_pribadi TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_evaluations_user ON user_evaluations(user_id);
ALTER TABLE user_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_evaluations_select ON user_evaluations FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')
  ));

CREATE POLICY user_evaluations_insert ON user_evaluations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')
  ));
