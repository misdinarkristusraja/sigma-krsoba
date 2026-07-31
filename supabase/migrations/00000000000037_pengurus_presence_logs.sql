-- Migration 037: Dedicated Pengurus & PIC Presence Logs
CREATE TABLE IF NOT EXISTS pengurus_presence_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  tipe         VARCHAR(50) DEFAULT 'PIC_Sakristan',
  foto_url     TEXT,
  keterangan   TEXT,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pengurus_presence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY pengurus_presence_access ON pengurus_presence_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping','Pelatih')));
