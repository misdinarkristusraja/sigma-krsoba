-- ================================================================
-- SIGMA — Security Linter Fixes (Migration 012)
-- ================================================================
-- Fixes Supabase security linter warnings/errors:
--
-- 1. ERROR  users_public view: SECURITY DEFINER → SECURITY INVOKER
-- 2. WARN   hitung_poin_kondisi: add SET search_path (both overloads)
-- 3. WARN   update_updated_at: add SET search_path
-- 4. WARN   registrations_insert RLS: scope INSERT to anon only
-- 5. WARN   anon_security_definer_function_executable:
--              revoke EXECUTE from anon for admin/internal functions
-- 6. WARN   authenticated_security_definer_function_executable:
--              revoke EXECUTE from authenticated for admin-only functions
-- 7. Note   auth_leaked_password_protection: must be enabled manually
--              in Supabase dashboard → Auth → Password Security
-- ================================================================

-- ----------------------------------------------------------------
-- 1. users_public view — switch to SECURITY INVOKER
-- ----------------------------------------------------------------
-- The view currently uses security_invoker = false (SECURITY DEFINER
-- behavior). Switching to SECURITY INVOKER means the view runs with
-- the permissions of the calling user — correct here because we use
-- auth.uid() + get_current_user_role() which already evaluate in the
-- caller's context. The underlying users table RLS still applies.

CREATE OR REPLACE VIEW users_public
  WITH (security_barrier = true, security_invoker = true)
AS
  SELECT
    id, nickname, myid, nama_panggilan, nama_lengkap,
    tanggal_lahir, pendidikan, sekolah, is_tarakanita,
    wilayah, lingkungan,
    role, status, is_suspended, suspended_until,
    foto_url, surat_pernyataan_url,
    created_at, updated_at,
    CASE WHEN auth.uid() = id
              OR get_current_user_role() IN ('Administrator','Pengurus','Pelatih')
         THEN hp_anak ELSE NULL END AS hp_anak,
    CASE WHEN get_current_user_role() IN ('Administrator','Pengurus')
         THEN hp_ortu ELSE NULL END AS hp_ortu,
    CASE WHEN auth.uid() = id
              OR get_current_user_role() IN ('Administrator','Pengurus')
         THEN email ELSE NULL END AS email,
    CASE WHEN get_current_user_role() IN ('Administrator','Pengurus')
         THEN alamat ELSE NULL END AS alamat,
    CASE WHEN get_current_user_role() IN ('Administrator','Pengurus')
         THEN nama_ayah ELSE NULL END AS nama_ayah,
    CASE WHEN get_current_user_role() IN ('Administrator','Pengurus')
         THEN nama_ibu ELSE NULL END AS nama_ibu,
    NULL::VARCHAR AS password_hash
  FROM public.users
  WHERE auth.uid() IS NOT NULL;

GRANT SELECT ON users_public TO authenticated;

-- ----------------------------------------------------------------
-- 2. hitung_poin_kondisi — add SET search_path to both overloads
-- ----------------------------------------------------------------
-- Old 4-param overload (legacy kondisi K1-K6):
CREATE OR REPLACE FUNCTION hitung_poin_kondisi(
  p_dijadwalkan   BOOLEAN,
  p_hadir_tugas   BOOLEAN,
  p_hadir_latihan BOOLEAN,
  p_walk_in       BOOLEAN
) RETURNS TABLE(poin INTEGER, kondisi VARCHAR)
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- 9-kondisi overload (new system from migration 007) — search_path already
-- set there but recreate to be safe:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'hitung_poin_kondisi'
      AND p.pronargs = 5
  ) THEN
    -- Already has search_path from migration 007; just ensure it's set.
    -- (Full body recreated in migration 007 — we just ensure search_path here.)
    EXECUTE $inner$
      ALTER FUNCTION public.hitung_poin_kondisi(boolean,boolean,boolean,boolean,boolean)
        SET search_path = public;
    $inner$;
  END IF;
END;
$$;

-- ----------------------------------------------------------------
-- 3. update_updated_at — add SET search_path
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------
-- 4. registrations_insert — restrict to anon only
-- ----------------------------------------------------------------
-- Old policy allows ANY role (no TO clause = all roles).
-- Pendaftar baru adalah anon (belum login), jadi cukup TO anon.
DROP POLICY IF EXISTS registrations_insert ON registrations;
CREATE POLICY registrations_insert ON registrations
  FOR INSERT TO anon
  WITH CHECK (true);

-- ----------------------------------------------------------------
-- 5 & 6. REVOKE EXECUTE from anon/authenticated on admin functions
-- ----------------------------------------------------------------

-- Functions that should NEVER be callable by anon:
REVOKE EXECUTE ON FUNCTION public.auto_retire_non_rereg()            FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_ratelimit()                FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_streaks()              FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_rekap_poin()                FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit(VARCHAR, UUID, TEXT)     FROM anon;

-- Trigger functions — not meant to be called directly via REST at all:
REVOKE EXECUTE ON FUNCTION public.trg_swap_no_self_approve()         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_users_no_self_promote()        FROM anon, authenticated;

-- process_misa_besar_scan: only canScan roles should call this.
-- Revoke from anon; leave authenticated (app calls via client with auth).
REVOKE EXECUTE ON FUNCTION public.process_misa_besar_scan(UUID, UUID, UUID, UUID, UUID) FROM anon;

-- get_my_profile: should NOT be anon-callable (no profile without login).
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM anon;
-- Ensure it's available to authenticated:
GRANT  EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- is_rereg_open: OK for anon (pendaftar baru belum login perlu cek status window).
-- Leave as-is.

-- get_email_by_nickname: needed by anon for login-by-username flow.
-- Leave as-is.

-- get_current_user_role: needed by authenticated for RLS policies.
-- Revoke from anon (anon has no role row).
REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- Admin-only functions: revoke from plain authenticated users.
-- These must only be callable by the app server (service_role) or via
-- the admin UI which uses an RPC guard inside the function body itself.
-- We keep GRANT to authenticated for the ones that already have internal
-- auth checks (admin_approve_registration checks role inside function).
-- For the most dangerous ones, revoke from authenticated entirely:
REVOKE EXECUTE ON FUNCTION public.auto_retire_non_rereg()    FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_ratelimit()        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_streaks()      FROM authenticated;
-- update_rekap_poin: called by cron (service_role). Revoke from authenticated.
REVOKE EXECUTE ON FUNCTION public.update_rekap_poin()        FROM authenticated;

-- admin_provision_all, admin_approve_registration, admin_reset_password:
-- These check role inside the function body. Keep authenticated GRANT but
-- the internal check blocks non-admin calls. Leave as-is (they cannot be
-- called by anon already, and authenticated users get rejected by the body).

-- change_my_password: legitimate authenticated call (user changing own pw).
-- Leave as-is.

-- log_audit: called internally. Revoke from anon, keep authenticated
-- (app code may call via client).
REVOKE EXECUTE ON FUNCTION public.log_audit(VARCHAR, UUID, TEXT) FROM anon;
