-- ================================================================
-- SIGMA — Sistem Informasi Penjadwalan & Manajemen Misdinar
-- Paroki Kristus Raja Solo Baru
--
-- CONSOLIDATED MIGRATION — replaces 001..023
--
-- Run di: Supabase Dashboard -> SQL Editor
-- Idempotent: aman dijalankan ulang.
-- ================================================================

-- ----------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- ----------------------------------------------------------------
-- DROP TABEL LAMA YANG REDUNDAN (jika ada dari migrasi sebelumnya)
-- ----------------------------------------------------------------
-- `re_registrations` (migration 004_new_features) di-supersede oleh
-- `reregistrations` (migration 004_feature_additions). Frontend hanya
-- memakai `reregistrations`, jadi yang lain di-drop.
DROP TABLE IF EXISTS re_registrations CASCADE;

-- ----------------------------------------------------------------
-- ENUM TYPES (idempotent via DO blocks)
-- ----------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM
    ('Administrator','Pengurus','Pelatih','Misdinar_Aktif','Misdinar_Retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('Active','Pending','Retired','Suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM
    ('Mingguan','Jumper','Sabtu_Imam','Misa_Khusus','Misa_Harian','Latihan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('Akan_Datang','Berlangsung','Sudah_Lewat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scan_type_enum AS ENUM
    ('tugas','latihan','walkin_tugas','walkin_latihan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE swap_status AS ENUM
    ('Pending','Approved_PIC','Rejected_PIC','Replaced','Offered','Expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE optin_status AS ENUM ('Bisa','Tidak_Bisa','Pas_Libur');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qr_version AS ENUM ('legacy','new');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE alasan_absen_enum AS ENUM (
    'sakit','tugas_sekolah','acara_keluarga_urgent',
    'acara_keluarga_non_urgent','lupa','tidak_ada_transportasi','alasan_lain'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- TABLE: users
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nickname             VARCHAR(50)  NOT NULL UNIQUE,
  myid                 VARCHAR(10)  NOT NULL UNIQUE,
  nama_lengkap         VARCHAR(200) NOT NULL,
  nama_panggilan       VARCHAR(100) NOT NULL,
  tanggal_lahir        DATE,
  pendidikan           VARCHAR(10) CHECK (pendidikan IN ('SD','SMP','SMA','SMK','Lulus')),
  sekolah              VARCHAR(200),
  is_tarakanita        BOOLEAN NOT NULL DEFAULT FALSE,
  wilayah              VARCHAR(100),
  lingkungan           VARCHAR(100) NOT NULL DEFAULT '',
  email                VARCHAR(200) NOT NULL UNIQUE,
  password_hash        VARCHAR(255),
  hp_anak              TEXT,
  hp_ortu              TEXT,
  nama_ayah            VARCHAR(200),
  nama_ibu             VARCHAR(200),
  alamat               VARCHAR(500),
  alasan_masuk         TEXT,
  sampai_kapan         TEXT,
  role                 user_role   NOT NULL DEFAULT 'Misdinar_Aktif',
  status               user_status NOT NULL DEFAULT 'Pending',
  is_suspended         BOOLEAN NOT NULL DEFAULT FALSE,
  suspended_until      DATE,
  surat_pernyataan_url TEXT,
  foto_url             TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_nickname    ON users (nickname);
CREATE INDEX IF NOT EXISTS idx_users_myid        ON users (myid);
CREATE INDEX IF NOT EXISTS idx_users_lingkungan  ON users (lingkungan);
CREATE INDEX IF NOT EXISTS idx_users_status      ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_role        ON users (role);

-- ----------------------------------------------------------------
-- TABLE: registrations (pending sign-ups)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nickname             VARCHAR(50)  NOT NULL UNIQUE,
  nama_lengkap         VARCHAR(200) NOT NULL,
  tanggal_lahir        DATE,
  alamat               VARCHAR(500),
  lingkungan           VARCHAR(100),
  wilayah              VARCHAR(100),
  pendidikan           VARCHAR(10),
  sekolah              VARCHAR(200),
  is_tarakanita        BOOLEAN NOT NULL DEFAULT FALSE,
  hp_anak              TEXT,
  hp_ortu              TEXT,
  hp_milik             VARCHAR(20),
  nama_ayah            VARCHAR(200),
  nama_ibu             VARCHAR(200),
  alasan_masuk         TEXT,
  sampai_kapan         TEXT,
  surat_pernyataan_url TEXT,
  email                VARCHAR(200),
  status               VARCHAR(20) NOT NULL DEFAULT 'Pending',
  approved_at          TIMESTAMPTZ,
  rejected_at          TIMESTAMPTZ,
  reject_reason        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE: events
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama_event           VARCHAR(200) NOT NULL,
  tipe_event           event_type   NOT NULL,
  tanggal_tugas        DATE         NOT NULL,
  tanggal_latihan      DATE,
  hari                 VARCHAR(10),
  perayaan             VARCHAR(300),
  warna_liturgi        VARCHAR(20) CHECK (warna_liturgi IN ('Hijau','Merah','Putih','Ungu','MerahMuda','Hitam')),
  jumlah_misa          INTEGER NOT NULL DEFAULT 4,
  status_event         event_status NOT NULL DEFAULT 'Akan_Datang',
  pic_slot_1a          VARCHAR(50), pic_slot_1b VARCHAR(50),
  pic_hp_slot_1a       VARCHAR(20), pic_hp_slot_1b VARCHAR(20),
  pic_slot_2a          VARCHAR(50), pic_slot_2b VARCHAR(50),
  pic_hp_slot_2a       VARCHAR(20), pic_hp_slot_2b VARCHAR(20),
  pic_slot_3a          VARCHAR(50), pic_slot_3b VARCHAR(50),
  pic_hp_slot_3a       VARCHAR(20), pic_hp_slot_3b VARCHAR(20),
  pic_slot_4a          VARCHAR(50), pic_slot_4b VARCHAR(50),
  pic_hp_slot_4a       VARCHAR(20), pic_hp_slot_4b VARCHAR(20),
  pic_harian           VARCHAR(50),
  pelatih_slot_1       VARCHAR(50),
  pelatih_slot_2       VARCHAR(50),
  pelatih_slot_3       VARCHAR(50),
  gcatholic_fetched    BOOLEAN NOT NULL DEFAULT FALSE,
  is_draft             BOOLEAN NOT NULL DEFAULT TRUE,
  published_at         TIMESTAMPTZ,
  published_by         UUID REFERENCES users(id),
  draft_note           TEXT,
  is_misa_besar        BOOLEAN NOT NULL DEFAULT FALSE,
  latihan_times        TEXT[],
  latihan_notes        TEXT,
  mode_latihan         VARCHAR(10) NOT NULL DEFAULT 'gabung'
                         CHECK (mode_latihan IN ('terpisah','gabung')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_tanggal ON events (tanggal_tugas);
CREATE INDEX IF NOT EXISTS idx_events_tipe    ON events (tipe_event);
CREATE INDEX IF NOT EXISTS idx_events_status  ON events (status_event);
CREATE INDEX IF NOT EXISTS idx_events_draft   ON events (is_draft);

-- ----------------------------------------------------------------
-- TABLE: assignments
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  slot_number  INTEGER CHECK (slot_number BETWEEN 1 AND 4),
  position     INTEGER DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_event ON assignments (event_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user  ON assignments (user_id);

-- ----------------------------------------------------------------
-- TABLE: misa_harian_availability
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS misa_harian_availability (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tahun               INTEGER NOT NULL,
  bulan               INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  status              optin_status NOT NULL DEFAULT 'Tidak_Bisa',
  tanggal_tidak_bisa  TEXT[],
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tahun, bulan)
);

-- ----------------------------------------------------------------
-- TABLE: event_latihan (sesi latihan misa besar)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_latihan (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tanggal      DATE NOT NULL,
  jam          VARCHAR(10) NOT NULL DEFAULT '07.00',
  lokasi       TEXT,
  catatan      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_latihan_event   ON event_latihan(event_id);
CREATE INDEX IF NOT EXISTS idx_event_latihan_tanggal ON event_latihan(tanggal);

-- ----------------------------------------------------------------
-- TABLE: scan_records
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id         UUID REFERENCES events(id) ON DELETE SET NULL,
  scanner_user_id  UUID NOT NULL REFERENCES users(id),
  scan_type        scan_type_enum NOT NULL,
  is_walk_in       BOOLEAN NOT NULL DEFAULT FALSE,
  walkin_reason    VARCHAR(100),
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qr_version       qr_version NOT NULL DEFAULT 'new',
  raw_qr_value     TEXT,
  is_anomaly       BOOLEAN NOT NULL DEFAULT FALSE,
  anomaly_reason   TEXT,
  latihan_id       UUID REFERENCES event_latihan(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_user      ON scan_records (user_id);
CREATE INDEX IF NOT EXISTS idx_scan_timestamp ON scan_records (timestamp);
CREATE INDEX IF NOT EXISTS idx_scan_event     ON scan_records (event_id);
CREATE INDEX IF NOT EXISTS idx_scan_type      ON scan_records (scan_type);
CREATE INDEX IF NOT EXISTS idx_scan_walkin    ON scan_records (is_walk_in);
CREATE INDEX IF NOT EXISTS idx_scan_latihan   ON scan_records (latihan_id) WHERE latihan_id IS NOT NULL;

-- ----------------------------------------------------------------
-- TABLE: event_latihan_attendance
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_latihan_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latihan_id      UUID NOT NULL REFERENCES event_latihan(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hadir           BOOLEAN NOT NULL DEFAULT TRUE,
  scan_record_id  UUID REFERENCES scan_records(id),
  marked_by       UUID REFERENCES users(id),
  marked_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(latihan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ela_latihan ON event_latihan_attendance(latihan_id);
CREATE INDEX IF NOT EXISTS idx_ela_user    ON event_latihan_attendance(user_id);

-- ----------------------------------------------------------------
-- TABLE: event_latihan_absence (self-report ketidakhadiran)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_latihan_absence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latihan_id      UUID NOT NULL REFERENCES event_latihan(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alasan          alasan_absen_enum NOT NULL DEFAULT 'alasan_lain',
  keterangan      TEXT,
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(latihan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ela_abs_latihan ON event_latihan_absence(latihan_id);
CREATE INDEX IF NOT EXISTS idx_ela_abs_user    ON event_latihan_absence(user_id);

-- ----------------------------------------------------------------
-- TABLE: latihan_threshold_notified
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS latihan_threshold_notified (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ DEFAULT NOW(),
  reason      TEXT,
  UNIQUE(event_id, user_id)
);

-- ----------------------------------------------------------------
-- TABLE: swap_requests
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS swap_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  alasan          TEXT NOT NULL,
  pic_user_id     UUID REFERENCES users(id),
  pic_wa_link     TEXT,
  status          swap_status NOT NULL DEFAULT 'Pending',
  pengganti_id    UUID REFERENCES users(id),
  pic_approved_at TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL,
  is_penawaran    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swap_requester ON swap_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_swap_status    ON swap_requests (status);
CREATE INDEX IF NOT EXISTS idx_swap_penawaran ON swap_requests (is_penawaran) WHERE is_penawaran = TRUE;

-- ----------------------------------------------------------------
-- TABLE: rekap_poin_mingguan
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rekap_poin_mingguan (
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start        DATE NOT NULL,
  week_end          DATE NOT NULL,
  is_dijadwalkan    BOOLEAN NOT NULL DEFAULT FALSE,
  is_hadir_tugas    BOOLEAN NOT NULL DEFAULT FALSE,
  is_hadir_latihan  BOOLEAN NOT NULL DEFAULT FALSE,
  is_walk_in        BOOLEAN NOT NULL DEFAULT FALSE,
  poin              INTEGER NOT NULL DEFAULT 0,
  kondisi           VARCHAR(5),
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_rekap_user ON rekap_poin_mingguan (user_id);
CREATE INDEX IF NOT EXISTS idx_rekap_week ON rekap_poin_mingguan (week_start);

-- ----------------------------------------------------------------
-- TABLE: rekap_poin_harian
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rekap_poin_harian (
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bulan              INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun              INTEGER NOT NULL,
  count_hadir_harian INTEGER NOT NULL DEFAULT 0,
  poin_harian        INTEGER NOT NULL DEFAULT 0,
  last_updated       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tahun, bulan)
);

-- ----------------------------------------------------------------
-- TABLE: reregistrations (daftar ulang)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reregistrations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tahun           INTEGER NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_snapshot   JSONB,
  verified_by     UUID REFERENCES users(id),
  verified_at     TIMESTAMPTZ,
  UNIQUE (user_id, tahun)
);

CREATE INDEX IF NOT EXISTS idx_rereg_user  ON reregistrations (user_id);
CREATE INDEX IF NOT EXISTS idx_rereg_tahun ON reregistrations (tahun);

-- ----------------------------------------------------------------
-- TABLE: notifications
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(50) NOT NULL,
  title        VARCHAR(200) NOT NULL,
  body         TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  link         VARCHAR(200),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at DESC);

-- ----------------------------------------------------------------
-- TABLE: streaks
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS streaks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_k1_week     DATE,
  streak_broken_at DATE,
  is_published     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE: system_config
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_config (
  key          VARCHAR(100) PRIMARY KEY,
  value        TEXT NOT NULL,
  description  VARCHAR(300),
  updated_by   UUID REFERENCES users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_config (key, value, description) VALUES
  ('window_optin_harian_start', '10',  'Tanggal mulai window opt-in Misa Harian per bulan'),
  ('window_optin_harian_end',   '20',  'Tanggal akhir window opt-in'),
  ('max_absen_before_suspend',  '3',   'Absen berturut sebelum suspend'),
  ('suspend_duration_days',     '30',  'Durasi suspend dalam hari'),
  ('prioritas_sma_smk_interval','3',   'Setiap N bulan ada 1 minggu prioritas SMA/SMK'),
  ('swap_expire_hours',         '24',  'Jam deadline PIC approve request tukar'),
  ('gcatholic_url',             'https://gcatholic.org/calendar/{YEAR}/ID-id', 'URL gcatholic.org'),
  ('max_hari_tanpa_jadwal',     '60',  'Maks hari tanpa jadwal sebelum wajib masuk bulan berikutnya'),
  ('rereg_open_date',           '2026-07-01', 'Tanggal buka daftar ulang (YYYY-MM-DD)'),
  ('rereg_close_date',          '2026-07-31', 'Tanggal tutup daftar ulang'),
  ('rereg_tahun',               '2026', 'Tahun periode daftar ulang aktif')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------
-- TABLE: audit_logs
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id   UUID REFERENCES users(id),
  action     VARCHAR(50) NOT NULL,
  target_id  UUID,
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_time   ON audit_logs (created_at);

-- ----------------------------------------------------------------
-- TRIGGER updated_at
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated  ON users;
DROP TRIGGER IF EXISTS trg_events_updated ON events;
CREATE TRIGGER trg_users_updated  BEFORE UPDATE ON users  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================================
-- FUNCTIONS
-- ================================================================

-- ----------------------------------------------------------------
-- get_current_user_role — bypass RLS recursion
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role::TEXT FROM users WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated;

-- ----------------------------------------------------------------
-- get_my_profile — return full profile as jsonb
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row users%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_row FROM users WHERE id = v_uid LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_profile() TO authenticated, anon;

-- ----------------------------------------------------------------
-- get_email_by_nickname — untuk login pakai username
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_email_by_nickname(p_nickname TEXT)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM users
  WHERE LOWER(nickname) = LOWER(p_nickname)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_email_by_nickname(TEXT) TO authenticated, anon;

-- ----------------------------------------------------------------
-- is_rereg_open — apakah window daftar ulang terbuka
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_rereg_open()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CURRENT_DATE BETWEEN
    (SELECT value::DATE FROM system_config WHERE key = 'rereg_open_date')
    AND
    (SELECT value::DATE FROM system_config WHERE key = 'rereg_close_date');
$$;

GRANT EXECUTE ON FUNCTION is_rereg_open() TO authenticated, anon;

-- ----------------------------------------------------------------
-- hitung_poin_kondisi — formula 6 kondisi
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION hitung_poin_kondisi(
  p_dijadwalkan BOOLEAN,
  p_hadir_tugas BOOLEAN,
  p_hadir_latihan BOOLEAN,
  p_walk_in BOOLEAN
) RETURNS TABLE(poin INTEGER, kondisi VARCHAR) AS $$
BEGIN
  IF p_dijadwalkan AND p_hadir_tugas AND p_hadir_latihan THEN
    RETURN QUERY SELECT 2, 'K1'::VARCHAR;
  ELSIF NOT p_dijadwalkan AND p_walk_in AND p_hadir_latihan THEN
    RETURN QUERY SELECT 3, 'K2'::VARCHAR;
  ELSIF p_dijadwalkan AND p_hadir_tugas AND NOT p_hadir_latihan THEN
    RETURN QUERY SELECT 1, 'K3'::VARCHAR;
  ELSIF NOT p_dijadwalkan AND p_walk_in AND NOT p_hadir_latihan THEN
    RETURN QUERY SELECT 2, 'K4'::VARCHAR;
  ELSIF NOT p_dijadwalkan AND NOT p_walk_in AND p_hadir_latihan THEN
    RETURN QUERY SELECT 1, 'K5'::VARCHAR;
  ELSIF p_dijadwalkan AND NOT p_hadir_tugas THEN
    RETURN QUERY SELECT -1, 'K6'::VARCHAR;
  ELSE
    RETURN QUERY SELECT 0, NULL::VARCHAR;
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION hitung_poin_kondisi(BOOLEAN,BOOLEAN,BOOLEAN,BOOLEAN)
  TO authenticated, service_role;

-- ----------------------------------------------------------------
-- update_rekap_poin — cron daily
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_rekap_poin()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r               RECORD;
  v_dow           INTEGER;
  v_hour_wib      INTEGER;
  v_week_start    DATE;
  v_week_end      DATE;
  v_poin          INTEGER;
  v_kondisi       VARCHAR(5);
  v_dijadwalkan   BOOLEAN;
  v_hadir_tugas   BOOLEAN;
  v_hadir_latihan BOOLEAN;
  v_walk_in       BOOLEAN;
  v_threshold     INTEGER := 3;
  v_processed     INTEGER := 0;
BEGIN
  SELECT COALESCE(value::INTEGER, 3) INTO v_threshold
  FROM system_config WHERE key = 'max_absen_before_suspend' LIMIT 1;
  IF v_threshold IS NULL THEN v_threshold := 3; END IF;

  FOR r IN
    -- (A) User dengan scan records 2 hari terakhir
    SELECT DISTINCT
      sr.user_id,
      (sr.timestamp AT TIME ZONE 'Asia/Jakarta')::DATE AS ref_date,
      EXTRACT(DOW  FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER AS dow,
      EXTRACT(HOUR FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER AS hour_wib
    FROM scan_records sr
    WHERE sr.timestamp >= NOW() - INTERVAL '2 days'
    UNION
    -- (B) User dijadwalkan 7 hari terakhir (K6 candidates)
    SELECT DISTINCT
      a.user_id,
      e.tanggal_tugas AS ref_date,
      EXTRACT(DOW  FROM e.tanggal_tugas::TIMESTAMPTZ AT TIME ZONE 'Asia/Jakarta')::INTEGER AS dow,
      7 AS hour_wib
    FROM assignments a
    JOIN events e ON a.event_id = e.id
    WHERE e.tanggal_tugas >= (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE - 7
      AND e.tanggal_tugas <= (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
      AND e.tipe_event::TEXT != 'Misa_Harian'
  LOOP
    v_dow := r.dow;
    v_hour_wib := r.hour_wib;

    IF v_dow = 6 AND v_hour_wib >= 7 THEN
      v_week_start := r.ref_date;
    ELSIF v_dow = 6 AND v_hour_wib < 7 THEN
      v_week_start := r.ref_date - 7;
    ELSE
      v_week_start := r.ref_date - CASE v_dow
        WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 3
        WHEN 3 THEN 4 WHEN 4 THEN 5 WHEN 5 THEN 6
        ELSE 7
      END;
    END IF;
    v_week_end := v_week_start + 6;

    SELECT EXISTS (
      SELECT 1 FROM assignments a
      JOIN events e ON a.event_id = e.id
      WHERE a.user_id = r.user_id
        AND e.tanggal_tugas BETWEEN v_week_start AND (v_week_start + 7)
        AND e.tipe_event::TEXT != 'Misa_Harian'
    ) INTO v_dijadwalkan;

    SELECT EXISTS (
      SELECT 1 FROM scan_records
      WHERE user_id = r.user_id
        AND scan_type::TEXT IN ('tugas','walkin_tugas')
        AND (timestamp AT TIME ZONE 'Asia/Jakarta')::DATE BETWEEN v_week_start AND v_week_end
    ) INTO v_hadir_tugas;

    SELECT EXISTS (
      SELECT 1 FROM scan_records
      WHERE user_id = r.user_id
        AND scan_type::TEXT IN ('latihan','walkin_latihan')
        AND (timestamp AT TIME ZONE 'Asia/Jakarta')::DATE BETWEEN v_week_start AND v_week_end
    ) INTO v_hadir_latihan;

    SELECT EXISTS (
      SELECT 1 FROM scan_records
      WHERE user_id = r.user_id
        AND is_walk_in = TRUE
        AND (timestamp AT TIME ZONE 'Asia/Jakarta')::DATE BETWEEN v_week_start AND v_week_end
    ) INTO v_walk_in;

    SELECT p.poin, p.kondisi INTO v_poin, v_kondisi
    FROM hitung_poin_kondisi(v_dijadwalkan, v_hadir_tugas, v_hadir_latihan, v_walk_in) p;

    INSERT INTO rekap_poin_mingguan (
      user_id, week_start, week_end,
      is_dijadwalkan, is_hadir_tugas, is_hadir_latihan, is_walk_in,
      poin, kondisi, last_updated
    ) VALUES (
      r.user_id, v_week_start, v_week_end,
      COALESCE(v_dijadwalkan,FALSE),
      COALESCE(v_hadir_tugas,FALSE),
      COALESCE(v_hadir_latihan,FALSE),
      COALESCE(v_walk_in,FALSE),
      COALESCE(v_poin, 0), v_kondisi, NOW()
    )
    ON CONFLICT (user_id, week_start) DO UPDATE SET
      week_end          = EXCLUDED.week_end,
      is_dijadwalkan    = EXCLUDED.is_dijadwalkan,
      is_hadir_tugas    = EXCLUDED.is_hadir_tugas,
      is_hadir_latihan  = EXCLUDED.is_hadir_latihan,
      is_walk_in        = EXCLUDED.is_walk_in,
      poin              = EXCLUDED.poin,
      kondisi           = EXCLUDED.kondisi,
      last_updated      = NOW();

    v_processed := v_processed + 1;
  END LOOP;

  -- Rekap harian (Misa Harian)
  BEGIN
    INSERT INTO rekap_poin_harian (
      user_id, tahun, bulan, count_hadir_harian, poin_harian, last_updated
    )
    SELECT
      sr.user_id,
      EXTRACT(YEAR  FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER,
      EXTRACT(MONTH FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER,
      COUNT(*), COUNT(*), NOW()
    FROM scan_records sr
    JOIN events e ON sr.event_id = e.id
    WHERE e.tipe_event::TEXT = 'Misa_Harian'
      AND sr.scan_type::TEXT IN ('tugas','walkin_tugas')
      AND sr.timestamp >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Jakarta')
    GROUP BY sr.user_id,
      EXTRACT(YEAR  FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta'),
      EXTRACT(MONTH FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')
    ON CONFLICT (user_id, tahun, bulan) DO UPDATE SET
      count_hadir_harian = EXCLUDED.count_hadir_harian,
      poin_harian        = EXCLUDED.poin_harian,
      last_updated       = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rekap harian skip: %', SQLERRM;
  END;

  -- Suspend check: SEMUA v_threshold minggu terakhir K6
  BEGIN
    UPDATE users u
    SET is_suspended = TRUE,
        suspended_until = (NOW() + INTERVAL '30 days')::DATE
    WHERE u.is_suspended = FALSE
      AND u.status = 'Active'
      AND (
        SELECT COUNT(*) FROM (
          SELECT 1 FROM rekap_poin_mingguan rpm
          WHERE rpm.user_id = u.id AND rpm.kondisi = 'K6'
          ORDER BY rpm.week_start DESC
          LIMIT v_threshold
        ) sub
      ) = v_threshold;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'suspend check skip: %', SQLERRM;
  END;

  -- Auto-unsuspend
  UPDATE users
  SET is_suspended = FALSE, suspended_until = NULL
  WHERE is_suspended = TRUE
    AND suspended_until IS NOT NULL
    AND suspended_until < CURRENT_DATE;

  -- Expire pending swap_requests
  UPDATE swap_requests
  SET status = 'Expired'
  WHERE status = 'Pending'
    AND expires_at < NOW();

  RETURN jsonb_build_object(
    'ok', TRUE,
    'processed', v_processed,
    'threshold', v_threshold,
    'timestamp', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', FALSE,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION update_rekap_poin() TO authenticated, service_role;

-- ----------------------------------------------------------------
-- recalculate_streaks — hitung streak K1/K2/K3 mingguan
-- FIX: hilangkan referensi `tanggal_tugas` yang TIDAK ADA di rekap_poin_mingguan
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_streaks()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_weeks DATE[];
  v_streak INT;
  v_longest INT;
  v_last_k1 DATE;
  v_prev_week DATE;
  v_cur_week DATE;
  i INT;
BEGIN
  FOR v_user IN
    SELECT id FROM users
    WHERE status = 'Active'
      AND role IN ('Misdinar_Aktif','Misdinar_Retired')
  LOOP
    SELECT ARRAY_AGG(week_start ORDER BY week_start)
    INTO v_weeks
    FROM rekap_poin_mingguan
    WHERE user_id = v_user.id
      AND kondisi IN ('K1','K2','K3')
      AND week_start <= CURRENT_DATE;

    v_streak := 0; v_longest := 0; v_last_k1 := NULL;

    IF v_weeks IS NOT NULL AND array_length(v_weeks, 1) > 0 THEN
      v_streak := 1;
      v_last_k1 := v_weeks[array_length(v_weeks,1)];
      FOR i IN 2..array_length(v_weeks,1) LOOP
        v_prev_week := v_weeks[i-1];
        v_cur_week  := v_weeks[i];
        IF v_cur_week = v_prev_week + INTERVAL '7 days' THEN
          v_streak := v_streak + 1;
        ELSE
          v_longest := GREATEST(v_longest, v_streak);
          v_streak := 1;
        END IF;
      END LOOP;
      v_longest := GREATEST(v_longest, v_streak);
    END IF;

    INSERT INTO streaks(user_id, current_streak, longest_streak, last_k1_week, updated_at)
    VALUES (v_user.id, v_streak, v_longest, v_last_k1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      current_streak = EXCLUDED.current_streak,
      longest_streak = EXCLUDED.longest_streak,
      last_k1_week   = EXCLUDED.last_k1_week,
      updated_at     = NOW();
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION recalculate_streaks() TO authenticated, service_role;

-- ----------------------------------------------------------------
-- process_misa_besar_scan — update attendance dari scan
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_misa_besar_scan(
  p_scan_record_id UUID,
  p_event_id       UUID,
  p_user_id        UUID,
  p_scanner_id     UUID,
  p_latihan_id     UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode   VARCHAR(10);
  v_today  DATE := CURRENT_DATE;
  v_row    RECORD;
  v_ids    UUID[] := '{}';
  v_marked INTEGER := 0;
BEGIN
  SELECT mode_latihan INTO v_mode FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event tidak ditemukan');
  END IF;

  IF v_mode = 'gabung' THEN
    FOR v_row IN
      SELECT id FROM event_latihan
      WHERE event_id = p_event_id AND tanggal = v_today
    LOOP
      INSERT INTO event_latihan_attendance (latihan_id, user_id, hadir, marked_by)
        VALUES (v_row.id, p_user_id, TRUE, p_scanner_id)
        ON CONFLICT (latihan_id, user_id)
        DO UPDATE SET hadir = TRUE, marked_by = p_scanner_id, marked_at = NOW();
      v_ids    := array_append(v_ids, v_row.id);
      v_marked := v_marked + 1;
    END LOOP;
    IF array_length(v_ids, 1) > 0 THEN
      UPDATE scan_records SET latihan_id = v_ids[1] WHERE id = p_scan_record_id;
    END IF;
  ELSE
    IF p_latihan_id IS NULL THEN
      SELECT id INTO v_row FROM event_latihan
      WHERE event_id = p_event_id AND tanggal = v_today
      ORDER BY jam ASC LIMIT 1;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'tidak ada sesi latihan hari ini');
      END IF;
      INSERT INTO event_latihan_attendance (latihan_id, user_id, hadir, marked_by)
        VALUES (v_row.id, p_user_id, TRUE, p_scanner_id)
        ON CONFLICT (latihan_id, user_id)
        DO UPDATE SET hadir = TRUE, marked_by = p_scanner_id, marked_at = NOW();
      v_ids    := ARRAY[v_row.id];
      v_marked := 1;
      UPDATE scan_records SET latihan_id = v_row.id WHERE id = p_scan_record_id;
    ELSE
      INSERT INTO event_latihan_attendance (latihan_id, user_id, hadir, marked_by)
        VALUES (p_latihan_id, p_user_id, TRUE, p_scanner_id)
        ON CONFLICT (latihan_id, user_id)
        DO UPDATE SET hadir = TRUE, marked_by = p_scanner_id, marked_at = NOW();
      v_ids    := ARRAY[p_latihan_id];
      v_marked := 1;
      UPDATE scan_records SET latihan_id = p_latihan_id WHERE id = p_scan_record_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'mode', v_mode, 'marked', v_marked,
    'latihan_ids', to_jsonb(v_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_misa_besar_scan(UUID,UUID,UUID,UUID,UUID)
  TO authenticated, service_role;

-- ----------------------------------------------------------------
-- generate_random_password — internal helper
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_random_password(len INT DEFAULT 10)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  chars  TEXT  := 'abcdefghjkmnpqrstuvwxyz23456789';
  result TEXT  := '';
  raw    BYTEA := extensions.gen_random_bytes(len * 2);
  i      INT;
BEGIN
  FOR i IN 1..len LOOP
    result := result || substr(chars, (get_byte(raw, i - 1) % length(chars)) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_random_password(INT) TO service_role;
REVOKE EXECUTE ON FUNCTION generate_random_password(INT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------
-- change_my_password — user ganti password sendiri
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION change_my_password(p_new_password TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  IF length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Password minimal 6 karakter');
  END IF;
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      updated_at         = NOW(),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      recovery_token     = ''
  WHERE id = v_uid;
  UPDATE public.users
  SET must_change_password = FALSE, updated_at = NOW()
  WHERE id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION change_my_password(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION change_my_password(TEXT) FROM anon, PUBLIC;

-- ----------------------------------------------------------------
-- admin_reset_password — reset 1 user. Caller harus Administrator.
-- Owned by supabase_auth_admin agar bisa tulis auth.*
-- ----------------------------------------------------------------
SET ROLE supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_target_id UUID,
  p_new_password TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role  TEXT;
  v_target_email TEXT;
  v_email_taken  BOOLEAN;
  v_exists       BOOLEAN;
  v_inst_id      UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED',
      'message', 'Anda belum login.');
  END IF;

  SELECT role::TEXT INTO v_caller_role
  FROM public.users WHERE id = auth.uid() LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role <> 'Administrator' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN',
      'message', 'Hanya Administrator yang dapat mereset password.');
  END IF;

  IF p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PASSWORD',
      'message', 'Password minimal 6 karakter.');
  END IF;

  SELECT email INTO v_target_email FROM public.users WHERE id = p_target_id;
  IF v_target_email IS NULL OR trim(v_target_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND',
      'message', 'User tidak ditemukan atau email kosong.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE LOWER(email) = LOWER(v_target_email) AND id <> p_target_id
  ) INTO v_email_taken;

  IF v_email_taken THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMAIL_CONFLICT',
      'message', 'Email ' || v_target_email || ' sudah dipakai akun lain.');
  END IF;

  SELECT instance_id INTO v_inst_id FROM auth.users LIMIT 1;
  v_inst_id := COALESCE(v_inst_id, '00000000-0000-0000-0000-000000000000'::UUID);

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_id) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, email_change_token_new, recovery_token
    ) VALUES (
      p_target_id, v_inst_id, 'authenticated', 'authenticated',
      v_target_email,
      extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::JSONB,
      '{}'::JSONB, false, '', '', ''
    ) ON CONFLICT (id) DO NOTHING;
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        banned_until       = NULL,
        confirmation_token = '',
        recovery_token     = '',
        email_change_token_new = '',
        aud   = 'authenticated',
        role  = 'authenticated',
        updated_at = NOW()
    WHERE id = p_target_id;
  END IF;

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid(), p_target_id,
    jsonb_build_object('sub', p_target_id::TEXT,
      'email', v_target_email,
      'email_verified', true, 'phone_verified', false),
    'email', v_target_email,
    NOW(), NOW(), NOW()
  ) ON CONFLICT DO NOTHING;

  UPDATE public.users
  SET must_change_password = true, updated_at = NOW()
  WHERE id = p_target_id;

  RETURN jsonb_build_object('ok', true,
    'target_id', p_target_id, 'email', v_target_email);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'DB_ERROR',
    'message', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ----------------------------------------------------------------
-- admin_provision_all — mass reset password
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_provision_all()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role  TEXT;
  v_member       RECORD;
  v_password     TEXT;
  v_success      INT := 0;
  v_skipped      INT := 0;
  v_failed       INT := 0;
  v_results      JSONB := '[]'::JSONB;
  v_entry        JSONB;
  v_reset_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED',
      'message', 'Anda belum login.');
  END IF;

  SELECT role::TEXT INTO v_caller_role
  FROM public.users WHERE id = auth.uid() LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role <> 'Administrator' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN',
      'message', 'Hanya Administrator.');
  END IF;

  FOR v_member IN
    SELECT pu.id, pu.nickname, pu.nama_panggilan,
           pu.lingkungan, pu.hp_ortu, pu.hp_anak, pu.email
    FROM public.users pu
    WHERE pu.status IN ('Active','Pending')
      AND pu.role::TEXT <> 'Administrator'
    ORDER BY pu.nama_panggilan
  LOOP
    IF v_member.email IS NULL OR trim(v_member.email) = '' THEN
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_object(
        'id', v_member.id, 'nickname', v_member.nickname,
        'nama', v_member.nama_panggilan,
        'ok', false, 'skipped', true, 'error', 'EMAIL_KOSONG'
      );
      CONTINUE;
    END IF;

    v_password := public.generate_random_password(10);
    v_reset_result := public.admin_reset_password(v_member.id, v_password);

    IF (v_reset_result->>'ok')::BOOLEAN THEN
      v_success := v_success + 1;
      v_entry := v_reset_result || jsonb_build_object(
        'nickname',   v_member.nickname,
        'nama',       v_member.nama_panggilan,
        'lingkungan', COALESCE(v_member.lingkungan,''),
        'hp_ortu',    COALESCE(v_member.hp_ortu,''),
        'hp_anak',    COALESCE(v_member.hp_anak,''),
        'password',   v_password
      );
    ELSE
      v_failed := v_failed + 1;
      v_entry := v_reset_result || jsonb_build_object(
        'nickname', v_member.nickname,
        'nama',     v_member.nama_panggilan
      );
    END IF;

    v_results := v_results || v_entry;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'total',   v_success + v_skipped + v_failed,
    'success', v_success,
    'skipped', v_skipped,
    'failed',  v_failed,
    'results', v_results
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'DB_FATAL',
    'message', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ----------------------------------------------------------------
-- admin_approve_registration — approve pending registration
-- Membuat auth.users + auth.identities + public.users dalam 1 RPC
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_registration(
  p_registration_id UUID,
  p_myid            VARCHAR(10),
  p_temp_password   TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_reg         RECORD;
  v_new_id      UUID := gen_random_uuid();
  v_email       TEXT;
  v_inst_id     UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT role::TEXT INTO v_caller_role
  FROM public.users WHERE id = auth.uid() LIMIT 1;

  IF v_caller_role NOT IN ('Administrator','Pengurus') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN',
      'message', 'Hanya Administrator/Pengurus yang dapat approve.');
  END IF;

  SELECT * INTO v_reg FROM registrations WHERE id = p_registration_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REG_NOT_FOUND');
  END IF;

  IF v_reg.status <> 'Pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_PROCESSED',
      'message', 'Pendaftaran sudah ' || v_reg.status);
  END IF;

  v_email := COALESCE(NULLIF(trim(v_reg.email), ''),
                      v_reg.nickname || '@sigma.krsoba.id');

  -- Cek nickname unique
  IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(nickname) = LOWER(v_reg.nickname)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NICKNAME_TAKEN',
      'message', 'Nickname ' || v_reg.nickname || ' sudah dipakai.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(email) = LOWER(v_email)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMAIL_TAKEN',
      'message', 'Email ' || v_email || ' sudah dipakai.');
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER(v_email)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_EMAIL_TAKEN',
      'message', 'Email ' || v_email || ' sudah ada di Supabase Auth.');
  END IF;

  SELECT instance_id INTO v_inst_id FROM auth.users LIMIT 1;
  v_inst_id := COALESCE(v_inst_id, '00000000-0000-0000-0000-000000000000'::UUID);

  -- Insert auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, email_change_token_new, recovery_token
  ) VALUES (
    v_new_id, v_inst_id, 'authenticated', 'authenticated',
    v_email,
    extensions.crypt(p_temp_password, extensions.gen_salt('bf', 10)),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::JSONB,
    '{}'::JSONB, false, '', '', ''
  );

  -- Insert auth.identities
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid(), v_new_id,
    jsonb_build_object('sub', v_new_id::TEXT, 'email', v_email,
      'email_verified', true, 'phone_verified', false),
    'email', v_email, NOW(), NOW(), NOW()
  );

  -- Insert public.users
  INSERT INTO public.users (
    id, nickname, myid, nama_lengkap, nama_panggilan, tanggal_lahir,
    pendidikan, sekolah, is_tarakanita, wilayah, lingkungan,
    email, hp_anak, hp_ortu, nama_ayah, nama_ibu, alamat,
    alasan_masuk, sampai_kapan, surat_pernyataan_url,
    role, status, must_change_password
  ) VALUES (
    v_new_id, v_reg.nickname, p_myid, v_reg.nama_lengkap, v_reg.nickname,
    v_reg.tanggal_lahir, v_reg.pendidikan, v_reg.sekolah,
    COALESCE(v_reg.is_tarakanita, false), v_reg.wilayah,
    COALESCE(v_reg.lingkungan, ''),
    v_email, v_reg.hp_anak, v_reg.hp_ortu,
    v_reg.nama_ayah, v_reg.nama_ibu, v_reg.alamat,
    v_reg.alasan_masuk, v_reg.sampai_kapan, v_reg.surat_pernyataan_url,
    'Misdinar_Aktif', 'Active', true
  );

  UPDATE registrations
  SET status = 'Approved', approved_at = NOW()
  WHERE id = p_registration_id;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_new_id,
    'email', v_email,
    'temp_password', p_temp_password,
    'myid', p_myid
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'DB_ERROR',
    'message', SQLERRM, 'detail', SQLSTATE);
END;
$$;

RESET ROLE;

GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_provision_all()                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_registration(UUID, VARCHAR, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT)       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_provision_all()                  FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_approve_registration(UUID, VARCHAR, TEXT) FROM anon, PUBLIC;

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE users                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_records               ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rekap_poin_mingguan        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rekap_poin_harian          ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config              ENABLE ROW LEVEL SECURITY;
ALTER TABLE misa_harian_availability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reregistrations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_latihan              ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_latihan_attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_latihan_absence      ENABLE ROW LEVEL SECURITY;
ALTER TABLE latihan_threshold_notified ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                 ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first agar bisa idempotent
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users','events','assignments','scan_records','swap_requests',
        'rekap_poin_mingguan','rekap_poin_harian','system_config',
        'misa_harian_availability','registrations','reregistrations',
        'notifications','streaks','event_latihan','event_latihan_attendance',
        'event_latihan_absence','latihan_threshold_notified','audit_logs'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ── users ──────────────────────────────────────────────────────
CREATE POLICY users_select ON users FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY users_update_self ON users FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY users_admin ON users FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

-- ── events ─────────────────────────────────────────────────────
CREATE POLICY events_read ON events FOR SELECT USING (TRUE);
CREATE POLICY events_write ON events FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

-- ── assignments ────────────────────────────────────────────────
CREATE POLICY assign_read ON assignments FOR SELECT USING (TRUE);
CREATE POLICY assign_write ON assignments FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

-- ── scan_records (PERSEMPIT — hapus hole "scan: service write") ─
CREATE POLICY scan_read ON scan_records FOR SELECT
  USING (get_current_user_role() IN ('Administrator','Pengurus','Pelatih'));
CREATE POLICY scan_insert ON scan_records FOR INSERT
  WITH CHECK (get_current_user_role() IN ('Administrator','Pengurus','Pelatih'));
CREATE POLICY scan_update ON scan_records FOR UPDATE
  USING (get_current_user_role() IN ('Administrator','Pengurus'));
CREATE POLICY scan_delete ON scan_records FOR DELETE
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

-- ── swap_requests ──────────────────────────────────────────────
CREATE POLICY swap_select ON swap_requests FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY swap_insert ON swap_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY swap_update ON swap_requests FOR UPDATE
  USING (auth.uid() = requester_id
         OR get_current_user_role() IN ('Administrator','Pengurus'));

-- ── rekap ──────────────────────────────────────────────────────
CREATE POLICY rekap_read ON rekap_poin_mingguan FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY rekap_harian_read ON rekap_poin_harian FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── system_config (semua login bisa baca, admin tulis) ─────────
CREATE POLICY config_read ON system_config FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY config_write ON system_config FOR ALL
  USING (get_current_user_role() = 'Administrator');

-- ── misa_harian_availability ───────────────────────────────────
CREATE POLICY avail_self     ON misa_harian_availability FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY avail_pengurus ON misa_harian_availability FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

-- ── registrations (publik bisa insert, staff baca) ─────────────
CREATE POLICY registrations_insert ON registrations FOR INSERT
  WITH CHECK (TRUE);
CREATE POLICY registrations_read   ON registrations FOR SELECT
  USING (get_current_user_role() IN ('Administrator','Pengurus'));
CREATE POLICY registrations_update ON registrations FOR UPDATE
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

-- ── reregistrations ────────────────────────────────────────────
CREATE POLICY rereg_user_insert ON reregistrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY rereg_user_read   ON reregistrations FOR SELECT
  USING (auth.uid() = user_id
         OR get_current_user_role() IN ('Administrator','Pengurus'));
CREATE POLICY rereg_staff_update ON reregistrations FOR UPDATE
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

-- ── notifications ──────────────────────────────────────────────
CREATE POLICY notif_self_read ON notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY notif_self_update ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY notif_staff_insert ON notifications FOR INSERT
  WITH CHECK (get_current_user_role() IN ('Administrator','Pengurus')
              OR auth.uid() = user_id);

-- ── streaks ────────────────────────────────────────────────────
CREATE POLICY streak_read_self ON streaks FOR SELECT
  USING (auth.uid() = user_id
         OR get_current_user_role() IN ('Administrator','Pengurus','Pelatih'));

-- ── event_latihan ──────────────────────────────────────────────
CREATE POLICY ela_read   ON event_latihan FOR SELECT USING (TRUE);
CREATE POLICY ela_write  ON event_latihan FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus','Pelatih'));

CREATE POLICY elat_read  ON event_latihan_attendance FOR SELECT USING (TRUE);
CREATE POLICY elat_write ON event_latihan_attendance FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus','Pelatih'));

CREATE POLICY elab_read       ON event_latihan_absence FOR SELECT USING (TRUE);
CREATE POLICY elab_self_ins   ON event_latihan_absence FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY elab_self_upd   ON event_latihan_absence FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY elab_staff      ON event_latihan_absence FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus','Pelatih'));

CREATE POLICY ltn_read   ON latihan_threshold_notified FOR SELECT USING (TRUE);
CREATE POLICY ltn_write  ON latihan_threshold_notified FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

-- ── audit_logs ─────────────────────────────────────────────────
CREATE POLICY audit_read ON audit_logs FOR SELECT
  USING (get_current_user_role() IN ('Administrator','Pengurus'));
CREATE POLICY audit_insert ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------
-- GRANTS untuk service_role
-- ----------------------------------------------------------------
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ----------------------------------------------------------------
-- POPULATE auth.users + auth.identities untuk user yang sudah ada
-- ----------------------------------------------------------------
BEGIN;
  SET LOCAL ROLE supabase_auth_admin;

  -- auth.users untuk public.users yang belum punya
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    aud, role, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token, email_change_token_new, recovery_token
  )
  SELECT
    pu.id,
    COALESCE((SELECT instance_id FROM auth.users LIMIT 1),
             '00000000-0000-0000-0000-000000000000'::UUID),
    pu.email,
    extensions.crypt('sigma' || substring(pu.id::TEXT, 1, 8), extensions.gen_salt('bf', 10)),
    NOW(), NOW(), NOW(),
    'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}'::JSONB, '{}'::JSONB,
    false, '', '', ''
  FROM public.users pu
  WHERE pu.email IS NOT NULL AND trim(pu.email) <> ''
    AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = pu.id)
    AND NOT EXISTS (
      SELECT 1 FROM auth.users au
      WHERE LOWER(au.email) = LOWER(pu.email) AND au.id <> pu.id
    );

  -- Fix akun lama: confirmed, aud, role
  UPDATE auth.users au
  SET email_confirmed_at = COALESCE(au.email_confirmed_at, NOW()),
      aud = 'authenticated', role = 'authenticated',
      banned_until = NULL
  FROM public.users pu
  WHERE au.id = pu.id;

  -- auth.identities
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  )
  SELECT
    extensions.gen_random_uuid(), au.id,
    jsonb_build_object('sub', au.id::TEXT, 'email', au.email,
      'email_verified', true, 'phone_verified', false),
    'email', au.email, NOW(), NOW(), NOW()
  FROM auth.users au
  JOIN public.users pu ON pu.id = au.id
  WHERE au.email IS NOT NULL AND au.email <> ''
    AND NOT EXISTS (
      SELECT 1 FROM auth.identities ai
      WHERE ai.user_id = au.id AND ai.provider = 'email'
    )
  ON CONFLICT DO NOTHING;

COMMIT;

-- ================================================================
-- VERIFIKASI AKHIR
-- ================================================================
SELECT
  'Schema OK' AS status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') AS total_tables,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public') AS total_functions,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS total_policies,
  (SELECT COUNT(*) FROM public.users) AS total_users,
  (SELECT COUNT(*) FROM auth.users) AS total_auth_users,
  (SELECT COUNT(*) FROM auth.identities WHERE provider = 'email') AS total_identities;
