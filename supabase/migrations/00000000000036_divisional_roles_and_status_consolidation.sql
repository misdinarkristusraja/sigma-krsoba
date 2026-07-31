-- Migration 036: Divisional Roles and Status Consolidation
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS divisi VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status_jadwal VARCHAR(30) DEFAULT 'Siap_Bertugas';

-- 1. Sekretaris Notula
CREATE TABLE IF NOT EXISTS pengurus_sekre_notula (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul        VARCHAR(200) NOT NULL,
  tanggal      DATE NOT NULL,
  peserta      TEXT,
  isi_notula   TEXT NOT NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sekretaris Surat
CREATE TABLE IF NOT EXISTS pengurus_sekre_surat (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_surat  VARCHAR(100) NOT NULL,
  tipe         VARCHAR(20) CHECK (tipe IN ('Masuk', 'Keluar')),
  perihal      VARCHAR(200) NOT NULL,
  tanggal      DATE NOT NULL,
  file_url     TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Bendahara Kas
CREATE TABLE IF NOT EXISTS pengurus_kas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe         VARCHAR(10) CHECK (tipe IN ('Pemasukan', 'Pengeluaran')),
  kategori     VARCHAR(50) NOT NULL,
  jumlah       DECIMAL(12,2) NOT NULL,
  keterangan   TEXT NOT NULL,
  bukti_url    TEXT,
  tanggal      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Multimedia Content Pipeline
CREATE TABLE IF NOT EXISTS pengurus_multimedia_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul         VARCHAR(200) NOT NULL,
  platform      VARCHAR(50) NOT NULL,
  target_date   DATE NOT NULL,
  status        VARCHAR(30) CHECK (status IN ('Draft', 'Desain', 'Revisi', 'Published')),
  link_preview  TEXT,
  pj_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Putsankris Equipment Checklists
CREATE TABLE IF NOT EXISTS pengurus_putsankris_checklists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  checked_items JSONB NOT NULL,
  catatan       TEXT,
  checked_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS & Access Policies
ALTER TABLE pengurus_sekre_notula ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_sekre_surat ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_multimedia_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_putsankris_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY pengurus_suite_access ON pengurus_sekre_notula FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')));

CREATE POLICY pengurus_surat_access ON pengurus_sekre_surat FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')));

CREATE POLICY pengurus_kas_access ON pengurus_kas FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')));

CREATE POLICY pengurus_content_access ON pengurus_multimedia_content FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')));

CREATE POLICY pengurus_putsankris_access ON pengurus_putsankris_checklists FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')));
