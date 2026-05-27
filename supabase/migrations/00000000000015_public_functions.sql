-- Migration 015: SECURITY DEFINER functions for public/member access
--
-- 1. get_public_schedule() — returns upcoming schedule with member names.
--    Accessible by anon (no login needed) — fixes mobile /jadwal showing "—".
--
-- 2. get_leaderboard(p_from, p_to) — returns aggregated poin per member from
--    rekap_poin_mingguan (pre-calculated). Accessible by all authenticated users
--    so regular members can view the rankings tab.

-- ── 1. Public schedule ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_public_schedule()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(ev_row ORDER BY (ev_row->>'tanggal_tugas')),
    '[]'::jsonb
  )
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'id',              e.id,
      'perayaan',        e.perayaan,
      'nama_event',      e.nama_event,
      'tanggal_tugas',   e.tanggal_tugas,
      'tanggal_latihan', e.tanggal_latihan,
      'tanpa_latihan',   e.tanpa_latihan,
      'tipe_event',      e.tipe_event,
      'jumlah_misa',     e.jumlah_misa,
      'warna_liturgi',   e.warna_liturgi,
      'latihan_times',   e.latihan_times,
      'latihan_notes',   e.latihan_notes,
      'draft_note',      e.draft_note,
      'assignments', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'slot_number', a.slot_number,
            'users', jsonb_build_object(
              'nama_panggilan', u.nama_panggilan,
              'lingkungan',     u.lingkungan
            )
          )
        ), '[]'::jsonb)
        FROM assignments a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.event_id = e.id
      ),
      'event_pics', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'slot',   ep.slot,
            'nama',   ep.nama,
            'hp',     ep.hp,
            'urutan', ep.urutan
          ) ORDER BY ep.urutan
        ), '[]'::jsonb)
        FROM event_pics ep
        WHERE ep.event_id = e.id
      ),
      'event_pelatih', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'nama',   epl.nama,
            'urutan', epl.urutan
          ) ORDER BY epl.urutan
        ), '[]'::jsonb)
        FROM event_pelatih epl
        WHERE epl.event_id = e.id
      )
    ) AS ev_row
    FROM events e
    WHERE e.tanggal_tugas >= CURRENT_DATE
      AND e.tipe_event::TEXT != 'Misa_Harian'
      AND e.is_draft = false
    ORDER BY e.tanggal_tugas
    LIMIT 12
  ) sub;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_schedule() TO anon, authenticated;

-- ── 2. Leaderboard from pre-calculated rekap ─────────────────────────────────
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_from DATE DEFAULT NULL,
  p_to   DATE DEFAULT NULL
)
RETURNS TABLE (
  user_id        UUID,
  nama_panggilan TEXT,
  lingkungan     TEXT,
  total_poin     INTEGER,
  k6_count       INTEGER,
  hadir_count    INTEGER,
  minggu_count   INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id                                                          AS user_id,
    u.nama_panggilan,
    u.lingkungan,
    COALESCE(SUM(r.poin), 0)::INTEGER                             AS total_poin,
    COUNT(CASE WHEN r.kondisi = 'K6' THEN 1 END)::INTEGER         AS k6_count,
    COUNT(CASE WHEN r.is_hadir_tugas OR r.is_hadir_latihan THEN 1 END)::INTEGER AS hadir_count,
    COUNT(r.week_start)::INTEGER                                  AS minggu_count
  FROM users u
  LEFT JOIN rekap_poin_mingguan r
         ON r.user_id = u.id
        AND (p_from IS NULL OR r.week_start >= p_from)
        AND (p_to   IS NULL OR r.week_start <= p_to)
  WHERE u.status = 'Active'
    AND u.role::TEXT IN ('Misdinar_Aktif', 'Misdinar_Retired')
  GROUP BY u.id, u.nama_panggilan, u.lingkungan
  ORDER BY total_poin DESC, u.nama_panggilan;
END;
$$;

GRANT EXECUTE ON FUNCTION get_leaderboard(DATE, DATE) TO authenticated;
