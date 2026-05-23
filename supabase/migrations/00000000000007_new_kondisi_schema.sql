-- ================================================================
-- SIGMA — New kondisi/poin schema
-- Replaces old 6-kondisi with new 9-kondisi system.
-- "walk-in" renamed to "mengganti" throughout.
-- One kondisi per event-week (highest poin wins).
-- ================================================================

CREATE OR REPLACE FUNCTION hitung_poin_kondisi(
  p_dijadwalkan    BOOLEAN,
  p_hadir_tugas    BOOLEAN,
  p_hadir_latihan  BOOLEAN,
  p_walk_in        BOOLEAN,
  p_swap_pengganti BOOLEAN DEFAULT FALSE
) RETURNS TABLE(poin INTEGER, kondisi VARCHAR) AS $$
BEGIN
  -- K1: Mengganti mendadak + hadir Latihan (+5)
  IF p_walk_in AND p_hadir_latihan THEN
    RETURN QUERY SELECT 5, 'K1'::VARCHAR;
  -- K2a: Hadir Lengkap, terjadwal normal (+4)
  ELSIF p_dijadwalkan AND p_hadir_tugas AND p_hadir_latihan AND NOT p_swap_pengganti THEN
    RETURN QUERY SELECT 4, 'K2a'::VARCHAR;
  -- K2b: Hadir Lengkap, pengganti resmi via swap (+3)
  ELSIF p_swap_pengganti AND p_hadir_tugas AND p_hadir_latihan THEN
    RETURN QUERY SELECT 3, 'K2b'::VARCHAR;
  -- K3a: Hadir Tugas saja, terjadwal, bukan pengganti (+3)
  ELSIF p_dijadwalkan AND p_hadir_tugas AND NOT p_hadir_latihan AND NOT p_swap_pengganti THEN
    RETURN QUERY SELECT 3, 'K3a'::VARCHAR;
  -- K3b: Mengganti mendadak saja, tanpa latihan (+3)
  ELSIF p_walk_in AND NOT p_hadir_latihan THEN
    RETURN QUERY SELECT 3, 'K3b'::VARCHAR;
  -- K3c: Hadir Tugas saja, pengganti resmi via swap (+2)
  ELSIF p_swap_pengganti AND p_hadir_tugas AND NOT p_hadir_latihan THEN
    RETURN QUERY SELECT 2, 'K3c'::VARCHAR;
  -- K4a: Hadir Latihan saja, tidak terjadwal, bukan mengganti (+2)
  ELSIF NOT p_dijadwalkan AND NOT p_walk_in AND NOT p_swap_pengganti AND p_hadir_latihan THEN
    RETURN QUERY SELECT 2, 'K4a'::VARCHAR;
  -- K4c: Terjadwal tapi hanya hadir Latihan, tidak hadir Tugas (0)
  ELSIF p_dijadwalkan AND NOT p_hadir_tugas AND p_hadir_latihan THEN
    RETURN QUERY SELECT 0, 'K4c'::VARCHAR;
  -- K6: Absen — terjadwal, tidak hadir sama sekali (-1)
  ELSIF p_dijadwalkan AND NOT p_hadir_tugas AND NOT p_hadir_latihan THEN
    RETURN QUERY SELECT -1, 'K6'::VARCHAR;
  ELSE
    RETURN QUERY SELECT 0, NULL::VARCHAR;
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION hitung_poin_kondisi(BOOLEAN,BOOLEAN,BOOLEAN,BOOLEAN,BOOLEAN)
  TO authenticated, service_role;

-- ----------------------------------------------------------------
-- update_rekap_poin — updated to detect swap pengganti
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_rekap_poin()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r                RECORD;
  v_dow            INTEGER;
  v_hour_wib       INTEGER;
  v_week_start     DATE;
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

  FOR r IN
    -- (A) Users with scan records in last 2 days
    SELECT DISTINCT
      sr.user_id,
      (sr.timestamp AT TIME ZONE 'Asia/Jakarta')::DATE AS ref_date,
      EXTRACT(DOW  FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER AS dow,
      EXTRACT(HOUR FROM sr.timestamp AT TIME ZONE 'Asia/Jakarta')::INTEGER AS hour_wib
    FROM scan_records sr
    WHERE sr.timestamp >= NOW() - INTERVAL '2 days'
    UNION
    -- (B) Users scheduled in last 7 days (K6 candidates)
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

    -- Pengganti: user is pengganti_id on a Replaced swap for an event in this week
    SELECT EXISTS (
      SELECT 1 FROM swap_requests sr
      JOIN assignments a ON sr.assignment_id = a.id
      JOIN events e ON a.event_id = e.id
      WHERE sr.pengganti_id = r.user_id
        AND sr.status = 'Replaced'
        AND e.tanggal_tugas BETWEEN v_week_start AND v_week_end
    ) INTO v_swap_pengganti;

    SELECT p.poin, p.kondisi INTO v_poin, v_kondisi
    FROM hitung_poin_kondisi(v_dijadwalkan, v_hadir_tugas, v_hadir_latihan, v_walk_in, v_swap_pengganti) p;

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

-- ----------------------------------------------------------------
-- recalculate_streaks — updated kondisi list for streak counting
-- Streak = hadir tugas (K1, K2a, K2b, K3a, K3b, K3c)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_streaks()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    RECORD;
  v_weeks   DATE[];
  v_streak  INTEGER;
  v_longest INTEGER;
  v_cur     INTEGER;
  v_last_k1 DATE;
  i         INTEGER;
  v_len     INTEGER;
BEGIN
  FOR v_user IN SELECT id FROM users WHERE status = 'Active' LOOP
    SELECT ARRAY_AGG(week_start ORDER BY week_start)
    INTO v_weeks
    FROM rekap_poin_mingguan
    WHERE user_id = v_user.id
      AND kondisi IN ('K1','K2a','K2b','K3a','K3b','K3c')
      AND week_start <= CURRENT_DATE;

    v_streak := 0; v_longest := 0; v_last_k1 := NULL;

    IF v_weeks IS NOT NULL AND array_length(v_weeks, 1) > 0 THEN
      v_len     := array_length(v_weeks, 1);
      v_last_k1 := v_weeks[v_len];

      -- Count current streak (consecutive weeks backwards from latest)
      v_streak := 1;
      FOR i IN REVERSE v_len - 1 .. 1 LOOP
        IF v_weeks[i + 1] - v_weeks[i] = 7 THEN
          v_streak := v_streak + 1;
        ELSE
          EXIT;
        END IF;
      END LOOP;

      -- Reset streak if latest hadir week is older than 2 weeks ago
      IF v_last_k1 < CURRENT_DATE - 13 THEN
        v_streak := 0;
      END IF;

      -- Count longest streak (all-time)
      v_longest := 1;
      v_cur     := 1;
      FOR i IN 2 .. v_len LOOP
        IF v_weeks[i] - v_weeks[i-1] = 7 THEN
          v_cur := v_cur + 1;
          IF v_cur > v_longest THEN v_longest := v_cur; END IF;
        ELSE
          v_cur := 1;
        END IF;
      END LOOP;
    END IF;

    INSERT INTO streaks (user_id, current_streak, longest_streak, last_k1_week, updated_at)
    VALUES (v_user.id, v_streak, v_longest, v_last_k1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      current_streak = EXCLUDED.current_streak,
      longest_streak = GREATEST(streaks.longest_streak, EXCLUDED.longest_streak),
      last_k1_week   = EXCLUDED.last_k1_week,
      updated_at     = NOW();
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION recalculate_streaks() TO authenticated, service_role;
