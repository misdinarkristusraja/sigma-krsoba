-- Migration 00000000000041_natal_announcements.sql
-- Tabel pengumuman penugasan misa natal dan misa besar ala portal SNBP

CREATE TABLE IF NOT EXISTS natal_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  nama_lengkap TEXT NOT NULL,
  nama_panggilan TEXT NOT NULL,
  status_tugas TEXT NOT NULL CHECK (status_tugas IN ('assigned', 'unassigned')),
  misa_name TEXT,
  tanggal_tugas DATE,
  jam_tugas TEXT,
  lokasi_tugas TEXT DEFAULT 'Gereja Paroki Kristus Raja Solo Baru',
  posisi_tugas TEXT,
  jadwal_latihan TEXT,
  catatan_khusus TEXT,
  tahun INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_natal_announcements_user_id ON natal_announcements(user_id);
CREATE INDEX IF NOT EXISTS idx_natal_announcements_panggilan ON natal_announcements(lower(nama_panggilan));
CREATE INDEX IF NOT EXISTS idx_natal_announcements_tahun ON natal_announcements(tahun);

-- RLS Policies
ALTER TABLE natal_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view natal announcements"
  ON natal_announcements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Pengurus and Admin can manage natal announcements"
  ON natal_announcements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('Administrator', 'Pengurus', 'Pendamping')
    )
  );
