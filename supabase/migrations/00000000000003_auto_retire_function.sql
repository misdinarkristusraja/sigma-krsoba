-- ================================================================
-- SIGMA — Auto-Retire Function
-- User Misdinar_Aktif yang tidak daftar ulang setelah rereg_close_date
-- otomatis di-set status=Retired, role=Misdinar_Retired
-- ================================================================

-- ── RPC: auto_retire_non_rereg ───────────────────────────────────
-- Dipanggil dari AdminPage (manual) atau pg_cron (otomatis).
-- Hanya jalan jika CURRENT_DATE > rereg_close_date dari system_config.
-- Return: jumlah user yang di-retire.
CREATE OR REPLACE FUNCTION public.auto_retire_non_rereg()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_close_date  DATE;
  v_tahun       INTEGER;
  v_count       INTEGER;
BEGIN
  -- Ambil rereg_close_date dari system_config
  SELECT value::DATE INTO v_close_date
  FROM system_config
  WHERE key = 'rereg_close_date'
  LIMIT 1;

  -- Jika config belum diset, tidak lakukan apa-apa
  IF v_close_date IS NULL THEN
    RETURN 0;
  END IF;

  -- Hanya eksekusi setelah close date lewat
  IF CURRENT_DATE <= v_close_date THEN
    RETURN 0;
  END IF;

  -- Tahun rereg: ambil dari rereg_tahun config, fallback ke tahun close_date
  SELECT COALESCE(value::INTEGER, EXTRACT(YEAR FROM v_close_date)::INTEGER)
  INTO v_tahun
  FROM system_config
  WHERE key = 'rereg_tahun'
  LIMIT 1;

  IF v_tahun IS NULL THEN
    v_tahun := EXTRACT(YEAR FROM v_close_date)::INTEGER;
  END IF;

  -- Update: Misdinar_Aktif yang belum rereg tahun ini → Retired
  UPDATE users
  SET
    status     = 'Retired',
    role       = 'Misdinar_Retired',
    updated_at = NOW()
  WHERE
    role   = 'Misdinar_Aktif'
    AND status = 'Active'
    AND id NOT IN (
      SELECT user_id FROM reregistrations WHERE tahun = v_tahun
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Hanya Administrator yang boleh panggil RPC ini
REVOKE ALL ON FUNCTION public.auto_retire_non_rereg() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_retire_non_rereg() TO authenticated;
