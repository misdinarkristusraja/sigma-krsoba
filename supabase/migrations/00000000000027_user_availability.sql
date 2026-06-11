-- ================================================================
-- SIGMA — user_availability table
-- Allows misdinar to mark events they cannot attend (opt-out).
-- Pengurus/Admin can see this for scheduling decisions.
-- ================================================================

CREATE TABLE IF NOT EXISTS user_availability (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  available    BOOLEAN NOT NULL DEFAULT FALSE,  -- FALSE = tidak bisa hadir
  keterangan   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);

-- Index for fast lookup per user or per event
CREATE INDEX IF NOT EXISTS idx_user_availability_user    ON user_availability (user_id);
CREATE INDEX IF NOT EXISTS idx_user_availability_event   ON user_availability (event_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION touch_user_availability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_availability_updated ON user_availability;
CREATE TRIGGER trg_user_availability_updated
  BEFORE UPDATE ON user_availability
  FOR EACH ROW EXECUTE FUNCTION touch_user_availability();

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;

-- Misdinar can read/write their own rows
CREATE POLICY "user_availability_self_read" ON user_availability
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_availability_self_write" ON user_availability
  FOR ALL USING (user_id = auth.uid());

-- Pengurus/Admin/Pendamping can read all rows (for scheduling)
CREATE POLICY "user_availability_staff_read" ON user_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('Pengurus', 'Administrator', 'Pendamping')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON user_availability TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_availability TO service_role;
