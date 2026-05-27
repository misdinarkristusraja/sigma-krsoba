-- ================================================================
-- SIGMA — Fix update_rekap_poin: deduplicate (user_id, week_start)
--
-- Root cause: the FOR loop could yield the same (user_id, week_start)
-- twice — once from a Saturday scan and once from a Sunday scan
-- (or once from scan + once from assignment). ON CONFLICT DO UPDATE
-- meant the *last* record won, not the highest-poin one.
--
-- Fix: collapse the driver query so each (user_id, week_start) pair
-- appears exactly once before the loop starts.
-- ================================================================

CREATE OR REPLACE FUNCTION update_rekap_poin()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r                RECORD;
  v_week_end       DATE;
  v_poin           INTEGER;
  v_kondisi        VARCHAR(5);
  v_dijadwalkan    BOOLEAN;
  v_hadir_tugas    BOOLEAN;
  v_hadir_latihan  BOOLEAN;
  v_walk_in        BOOLEAN;
  v_swap_pengganti BOOLEAN;
  v_threshold      INTEGER := 3;
  v_processed      INTEGER := 0;
BEGIN
  SELECT COALESCE(value::INTEGER, 3) INTO v_threshold
  FROM system_config WHERE key = 'max_absen_before_suspend' LIMIT 1;
  IF v_threshold IS NULL THEN v_threshold := 3; END IF;

  -- Build unique (user_id, week_start) pairs from scans + scheduled assignments.
  -- week_start = Saturday of the event week (Sabtu 07:00 WIB boundary).
  FOR r IN
    SELECT DISTINCT
      user_id,
      week_start
    FROM (
      -- (A) From scan records in last 2 days
      SELECT
        sr.user_id,
        CASE
          WHEN EXTRACT(DOW FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER = 6
               AND EXTRACT(HOUR FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER >= 7
            THEN (sr.timestamp AT TIME ZONE 'Asia/Jakarta')::DATE
          WHEN EXTRACT(DOW FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER = 6
               AND EXTRACT(HOUR FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER < 7
            THEN (sr.timestamp AT TIME ZONE 'Asia/Jakarta')::DATE - 7
          ELSE
            (sr.timestamp AT TIME ZONE 'Asia/Jakarta')::DATE
            - CASE EXTRACT(DOW FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER
                WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 3
                WHEN 3 THEN 4 WHEN 4 THEN 5 WHEN 5 THEN 6
                ELSE 7
              END
        END AS week_start
      FROM scan_records sr
      WHERE sr.timestamp >= NOW() - INTERVAL '2 days'

      UNION

      -- (B) Scheduled users in last 7 days (K6 candidates)
      SELECT
        a.user_id,
        e.tanggal_tugas
        - CASE EXTRACT(DOW FROM e.tanggal_tugas::TIMESTAMPTZ AT TIME ZONE 'Asia/Jakarta')::INTEGER
            WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 3
            WHEN 3 THEN 4 WHEN 4 THEN 5 WHEN 5 THEN 6
            WHEN 6 THEN 0
            ELSE 0
          END AS week_start
      FROM assignments a
      JOIN events e ON a.event_id = e.id
      WHERE e.tanggal_tugas >= (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE - 7
        AND e.tanggal_tugas <= (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE
        AND e.tipe_event::TEXT != 'Misa_Harian'
    ) sub
  LOOP
    v_week_end := r.week_start + 6;

    SELECT EXISTS (
      SELECT 1 FROM assignments a
      JOIN events e ON a.event_id = e.id
      WHERE a.user_id = r.user_id
        AND e.tanggal_tugas BETWEEN r.week_start AND r.week_start + 7
        AND e.tipe_event::TEXT != 'Misa_Harian'
    ) INTO v_dijadwalkan;

    SELECT EXISTS (
      SELECT 1 FROM scan_records
      WHERE user_id = r.user_id
        AND scan_type::TEXT IN ('tugas','walkin_tugas')
        AND (timestamp AT TIME ZONE 'Asia/Jakarta')::DATE BETWEEN r.week_start AND v_week_end
    ) INTO v_hadir_tugas;

    SELECT EXISTS (
      SELECT 1 FROM scan_records
      WHERE user_id = r.user_id
        AND scan_type::TEXT IN ('latihan','walkin_latihan')
        AND (timestamp AT TIME ZONE 'Asia/Jakarta')::DATE BETWEEN r.week_start AND v_week_end
    ) INTO v_hadir_latihan;

    SELECT EXISTS (
      SELECT 1 FROM scan_records
      WHERE user_id = r.user_id
        AND is_walk_in = TRUE
        AND (timestamp AT TIME ZONE 'Asia/Jakarta')::DATE BETWEEN r.week_start AND v_week_end
    ) INTO v_walk_in;

    SELECT EXISTS (
      SELECT 1 FROM swap_requests sr
      JOIN assignments a ON sr.assignment_id = a.id
      JOIN events e ON a.event_id = e.id
      WHERE sr.pengganti_id = r.user_id
        AND sr.status = 'Replaced'
        AND e.tanggal_tugas BETWEEN r.week_start AND v_week_end
    ) INTO v_swap_pengganti;

    SELECT p.poin, p.kondisi INTO v_poin, v_kondisi
    FROM hitung_poin_kondisi(v_dijadwalkan, v_hadir_tugas, v_hadir_latihan, v_walk_in, v_swap_pengganti) p;

    INSERT INTO rekap_poin_mingguan (
      user_id, week_start, week_end,
      is_dijadwalkan, is_hadir_tugas, is_hadir_latihan, is_walk_in,
      poin, kondisi, last_updated
    ) VALUES (
      r.user_id, r.week_start, v_week_end,
      COALESCE(v_dijadwalkan, FALSE),
      COALESCE(v_hadir_tugas, FALSE),
      COALESCE(v_hadir_latihan, FALSE),
      COALESCE(v_walk_in, FALSE),
      COALESCE(v_poin, 0), v_kondisi, NOW()
    )
    ON CONFLICT (user_id, week_start) DO UPDATE SET
      week_end         = EXCLUDED.week_end,
      is_dijadwalkan   = EXCLUDED.is_dijadwalkan   OR rekap_poin_mingguan.is_dijadwalkan,
      is_hadir_tugas   = EXCLUDED.is_hadir_tugas   OR rekap_poin_mingguan.is_hadir_tugas,
      is_hadir_latihan = EXCLUDED.is_hadir_latihan OR rekap_poin_mingguan.is_hadir_latihan,
      is_walk_in       = EXCLUDED.is_walk_in       OR rekap_poin_mingguan.is_walk_in,
      -- Keep the entry with the higher poin (highest kondisi wins)
      poin    = CASE WHEN EXCLUDED.poin > rekap_poin_mingguan.poin THEN EXCLUDED.poin    ELSE rekap_poin_mingguan.poin    END,
      kondisi = CASE WHEN EXCLUDED.poin > rekap_poin_mingguan.poin THEN EXCLUDED.kondisi ELSE rekap_poin_mingguan.kondisi END,
      last_updated = NOW();

    v_processed := v_processed + 1;
  END LOOP;

  -- Lift suspension for users whose suspended_until has passed
  UPDATE users
  SET status = 'Active', suspended_until = NULL
  WHERE status = 'Suspended'
    AND suspended_until IS NOT NULL
    AND suspended_until < CURRENT_DATE;

  -- Expire pending swap_requests
  UPDATE swap_requests
  SET status = 'Expired'
  WHERE status = 'Pending'
    AND expires_at < NOW();

  RETURN jsonb_build_object('processed', v_processed, 'time', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION update_rekap_poin() TO authenticated, service_role;
