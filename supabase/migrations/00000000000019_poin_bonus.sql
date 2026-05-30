-- Migration 019: poin_bonus table — manual point adjustments (prestasi, AOA, etc.)

CREATE TABLE IF NOT EXISTS poin_bonus (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  poin        INTEGER     NOT NULL,
  keterangan  TEXT        NOT NULL,
  kategori    VARCHAR(50) NOT NULL DEFAULT 'Lainnya',
  tanggal     DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_by  UUID        REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poin_bonus_user    ON poin_bonus (user_id);
CREATE INDEX IF NOT EXISTS idx_poin_bonus_tanggal ON poin_bonus (tanggal DESC);

ALTER TABLE poin_bonus ENABLE ROW LEVEL SECURITY;

-- All logged-in users can read (leaderboard transparency)
CREATE POLICY bonus_read  ON poin_bonus FOR SELECT USING (auth.uid() IS NOT NULL);
-- Only staff can write
CREATE POLICY bonus_write ON poin_bonus FOR ALL   USING (is_staff());

-- Update get_leaderboard to include bonus poin in total
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_from DATE DEFAULT NULL,
  p_to   DATE DEFAULT NULL
) RETURNS TABLE(
  user_id       UUID,
  nama_panggilan TEXT,
  lingkungan    TEXT,
  total_poin    INTEGER,
  bonus_poin    INTEGER,
  k6_count      INTEGER,
  hadir_count   INTEGER,
  minggu_count  INTEGER
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $func$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.nama_panggilan::TEXT,
    u.lingkungan::TEXT,
    (COALESCE(SUM(r.poin), 0) + COALESCE(b.bonus, 0))::INTEGER AS total_poin,
    COALESCE(b.bonus, 0)::INTEGER                               AS bonus_poin,
    COUNT(CASE WHEN r.kondisi = 'K6' THEN 1 END)::INTEGER       AS k6_count,
    COUNT(CASE WHEN r.is_hadir_tugas OR r.is_hadir_latihan THEN 1 END)::INTEGER AS hadir_count,
    COUNT(r.week_start)::INTEGER                                AS minggu_count
  FROM users u
  LEFT JOIN rekap_poin_mingguan r ON r.user_id = u.id
    AND (p_from IS NULL OR r.week_start >= p_from)
    AND (p_to   IS NULL OR r.week_start <= p_to)
  LEFT JOIN (
    SELECT pb.user_id, SUM(pb.poin)::INTEGER AS bonus
    FROM poin_bonus pb
    WHERE (p_from IS NULL OR pb.tanggal >= p_from)
      AND (p_to   IS NULL OR pb.tanggal <= p_to)
    GROUP BY pb.user_id
  ) b ON b.user_id = u.id
  WHERE u.status = 'Active'
    AND u.role::TEXT IN ('Misdinar_Aktif', 'Misdinar_Retired')
  GROUP BY u.id, u.nama_panggilan, u.lingkungan, b.bonus
  ORDER BY total_poin DESC, u.nama_panggilan;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_leaderboard(DATE, DATE) TO authenticated;
