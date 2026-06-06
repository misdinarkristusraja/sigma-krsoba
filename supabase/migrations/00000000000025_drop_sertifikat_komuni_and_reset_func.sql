-- Migration 025: Hapus kolom sertifikat_komuni_url + fungsi reset data tugas

-- 1. Drop kolom sertifikat komuni dari kedua tabel
ALTER TABLE public.registrations
  DROP COLUMN IF EXISTS sertifikat_komuni_url;

ALTER TABLE public.users
  DROP COLUMN IF EXISTS sertifikat_komuni_url;

-- 2. Fungsi admin_reset_tugas_data
--    Menghapus semua data operasional (scan, assignments, poin, swap, absensi latihan)
--    sambil menjaga data personal anggota (users, registrations, reregistrations) dan
--    kalender liturgi (events, event_latihan).
CREATE OR REPLACE FUNCTION public.admin_reset_tugas_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan      int;
  v_assign    int;
  v_poin_mgg  int;
  v_poin_har  int;
  v_swap      int;
  v_att       int;
  v_abs       int;
BEGIN
  -- Hanya Administrator yang boleh memanggil fungsi ini
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'Administrator'
  ) THEN
    RAISE EXCEPTION 'Hanya Administrator yang dapat mereset data tugas';
  END IF;

  DELETE FROM public.swap_requests;          GET DIAGNOSTICS v_swap    = ROW_COUNT;
  DELETE FROM public.scan_records;           GET DIAGNOSTICS v_scan    = ROW_COUNT;
  DELETE FROM public.rekap_poin_mingguan;    GET DIAGNOSTICS v_poin_mgg = ROW_COUNT;
  DELETE FROM public.rekap_poin_harian;      GET DIAGNOSTICS v_poin_har = ROW_COUNT;
  DELETE FROM public.event_latihan_attendance; GET DIAGNOSTICS v_att   = ROW_COUNT;
  DELETE FROM public.event_latihan_absence;  GET DIAGNOSTICS v_abs     = ROW_COUNT;
  DELETE FROM public.assignments;            GET DIAGNOSTICS v_assign  = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted', jsonb_build_object(
      'scan_records',              v_scan,
      'assignments',               v_assign,
      'swap_requests',             v_swap,
      'rekap_poin_mingguan',       v_poin_mgg,
      'rekap_poin_harian',         v_poin_har,
      'event_latihan_attendance',  v_att,
      'event_latihan_absence',     v_abs
    )
  );
END;
$$;

-- Hanya bisa dipanggil oleh authenticated users (RLS di level fungsi sudah ada)
GRANT EXECUTE ON FUNCTION public.admin_reset_tugas_data() TO authenticated;
