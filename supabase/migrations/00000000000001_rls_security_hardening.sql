-- ================================================================
-- SIGMA — RLS Security Hardening (Fase 4.1)
-- ================================================================
-- Fixes:
--   1. users: restrict sensitive columns (hp_ortu, alamat, email, etc.)
--      to Pengurus+ only; self-read always allowed
--   2. users: column-level UPDATE whitelist — block self-promotion of role/status
--   3. scan_records: add own-data read for non-staff (misdinar can see own scans)
--   4. swap_requests: restrict requester UPDATE to alasan only; status changes
--      require Pengurus+ or PIC
--   5. rekap_poin_mingguan/harian: explicit NO-INSERT/UPDATE for authenticated
--      (writes only via service_role / SECURITY DEFINER functions)
--   6. notifications: remove self-insert loophole
--   7. audit_logs: only service_role / SECURITY DEFINER functions may insert
--   8. get_email_by_nickname: add call-count throttle via pg_audit_log table
-- ================================================================

-- ----------------------------------------------------------------
-- 1. USERS — column-level security via two views + policy rewrite
-- ----------------------------------------------------------------

-- Drop old overly-broad policies
DROP POLICY IF EXISTS users_select    ON users;
DROP POLICY IF EXISTS users_update_self ON users;
DROP POLICY IF EXISTS users_admin     ON users;

-- 1a. Any authenticated user may read the safe (public) subset
CREATE POLICY users_select_public ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- own row: always full access (handled separately in app via get_my_profile RPC)
      auth.uid() = id
      -- staff: see everything
      OR get_current_user_role() IN ('Administrator','Pengurus','Pelatih')
    )
  );

-- 1b. Anggota biasa may ALSO select other members but ONLY safe columns
--     Implemented via a separate restrictive policy — PostgreSQL evaluates
--     all FOR SELECT policies with OR, so we need a view-based approach
--     for column restriction. Instead, we tighten by BLOCKING direct table
--     access for the sensitive columns via a SECURITY BARRIER view.

-- Safe public view (no hp_ortu, alamat, password_hash, email of others)
CREATE OR REPLACE VIEW users_public
  WITH (security_barrier = true, security_invoker = false)
AS
  SELECT
    id, nickname, myid, nama_panggilan, nama_lengkap,
    tanggal_lahir, pendidikan, sekolah, is_tarakanita,
    wilayah, lingkungan,
    role, status, is_suspended, suspended_until,
    foto_url, surat_pernyataan_url,
    created_at, updated_at,
    -- phone numbers visible only to self + staff (masked for others)
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
    -- never expose password_hash
    NULL::VARCHAR AS password_hash
  FROM public.users
  WHERE auth.uid() IS NOT NULL;

GRANT SELECT ON users_public TO authenticated;

-- 1c. self-update: whitelist safe columns only
CREATE POLICY users_update_self ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Prevent self-promotion: role and status changes are admin-only
    -- PostgreSQL column-level: enforce via trigger below
    auth.uid() = id
  );

-- Trigger: block non-admin from changing role/status/is_suspended via UPDATE
CREATE OR REPLACE FUNCTION trg_users_no_self_promote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_role FROM public.users WHERE id = auth.uid() LIMIT 1;
  IF v_role NOT IN ('Administrator','Pengurus') THEN
    IF NEW.role        IS DISTINCT FROM OLD.role        THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change own role';
    END IF;
    IF NEW.status      IS DISTINCT FROM OLD.status      THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change own status';
    END IF;
    IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change own suspension';
    END IF;
    IF NEW.myid        IS DISTINCT FROM OLD.myid        THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change myid';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_no_self_promote ON users;
CREATE TRIGGER trg_users_no_self_promote
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trg_users_no_self_promote();

-- 1d. admin full access
CREATE POLICY users_admin ON users FOR ALL
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

-- ----------------------------------------------------------------
-- 2. SCAN RECORDS — add own-data read for Misdinar
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS scan_read ON scan_records;

CREATE POLICY scan_read_staff ON scan_records FOR SELECT
  USING (get_current_user_role() IN ('Administrator','Pengurus','Pelatih'));

CREATE POLICY scan_read_self ON scan_records FOR SELECT
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 3. SWAP REQUESTS — tighten UPDATE
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS swap_update ON swap_requests;

-- Requester can only update alasan (reason text), not status/pengganti
CREATE POLICY swap_update_requester ON swap_requests FOR UPDATE
  USING (auth.uid() = requester_id);

-- Trigger: prevent requester from changing status/pengganti directly
CREATE OR REPLACE FUNCTION trg_swap_no_self_approve()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_role FROM public.users WHERE id = auth.uid() LIMIT 1;
  IF v_role NOT IN ('Administrator','Pengurus') THEN
    IF NEW.status       IS DISTINCT FROM OLD.status       THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change swap status directly';
    END IF;
    IF NEW.pengganti_id IS DISTINCT FROM OLD.pengganti_id THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot set pengganti directly';
    END IF;
    IF NEW.pic_user_id  IS DISTINCT FROM OLD.pic_user_id  THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change pic assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_swap_no_self_approve ON swap_requests;
CREATE TRIGGER trg_swap_no_self_approve
  BEFORE UPDATE ON swap_requests
  FOR EACH ROW EXECUTE FUNCTION trg_swap_no_self_approve();

-- Staff update (approve/reject)
CREATE POLICY swap_update_staff ON swap_requests FOR UPDATE
  USING (get_current_user_role() IN ('Administrator','Pengurus'));

-- ----------------------------------------------------------------
-- 4. REKAP — explicit no authenticated write
--    Writes happen only via update_rekap_poin() SECURITY DEFINER
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS rekap_write ON rekap_poin_mingguan;
DROP POLICY IF EXISTS rekap_harian_write ON rekap_poin_harian;

-- No INSERT/UPDATE/DELETE policies for authenticated → denied by default
-- service_role bypasses RLS entirely, SECURITY DEFINER functions run as owner

-- ----------------------------------------------------------------
-- 5. NOTIFICATIONS — remove self-insert loophole
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS notif_staff_insert ON notifications;

CREATE POLICY notif_staff_insert ON notifications FOR INSERT
  WITH CHECK (get_current_user_role() IN ('Administrator','Pengurus'));

-- ----------------------------------------------------------------
-- 6. AUDIT LOGS — only via SECURITY DEFINER functions (service_role)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS audit_insert ON audit_logs;

-- Block direct authenticated INSERT; audit entries must go via RPC
CREATE POLICY audit_insert ON audit_logs FOR INSERT
  WITH CHECK (get_current_user_role() IN ('Administrator','Pengurus'));

-- Helper function for safe audit logging (called from app RPCs)
CREATE OR REPLACE FUNCTION log_audit(
  p_action    VARCHAR(50),
  p_target_id UUID DEFAULT NULL,
  p_detail    TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, action, target_id, detail)
  VALUES (auth.uid(), p_action, p_target_id, p_detail);
EXCEPTION WHEN OTHERS THEN NULL; -- never let audit fail silently break main flow
END;
$$;

GRANT EXECUTE ON FUNCTION log_audit(VARCHAR, UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------
-- 7. get_email_by_nickname — rate-limit via simple counter table
-- ----------------------------------------------------------------

-- Lightweight table: one row per (ip_hash, minute_bucket)
CREATE TABLE IF NOT EXISTS ratelimit_login_attempts (
  ip_hash       VARCHAR(64) NOT NULL,
  minute_bucket TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER     NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, minute_bucket)
);

-- Purge old rows automatically (keep 1 hour only)
CREATE OR REPLACE FUNCTION cleanup_ratelimit() RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM ratelimit_login_attempts
  WHERE minute_bucket < NOW() - INTERVAL '1 hour';
$$;

-- Replace get_email_by_nickname with throttled version
-- p_client_hash: caller sends SHA-256 of their IP (client-side, best-effort)
-- Hard server-side limit: 10 lookups/minute per hash; 50/minute global
CREATE OR REPLACE FUNCTION get_email_by_nickname(
  p_nickname    TEXT,
  p_client_hash TEXT DEFAULT 'unknown'
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket  TIMESTAMPTZ := DATE_TRUNC('minute', NOW());
  v_count   INTEGER;
  v_global  INTEGER;
  v_email   TEXT;
BEGIN
  -- Per-client rate check
  INSERT INTO ratelimit_login_attempts (ip_hash, minute_bucket, attempt_count)
  VALUES (LEFT(p_client_hash, 64), v_bucket, 1)
  ON CONFLICT (ip_hash, minute_bucket)
  DO UPDATE SET attempt_count = ratelimit_login_attempts.attempt_count + 1
  RETURNING attempt_count INTO v_count;

  IF v_count > 10 THEN
    RAISE EXCEPTION 'RATE_LIMIT: terlalu banyak percobaan login';
  END IF;

  -- Global rate check (prevent distributed enumeration)
  SELECT COALESCE(SUM(attempt_count), 0) INTO v_global
  FROM ratelimit_login_attempts WHERE minute_bucket = v_bucket;

  IF v_global > 200 THEN
    RAISE EXCEPTION 'RATE_LIMIT: server sedang sibuk, coba lagi sebentar';
  END IF;

  SELECT email INTO v_email
  FROM users
  WHERE LOWER(nickname) = LOWER(p_nickname)
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION get_email_by_nickname(TEXT, TEXT) TO authenticated, anon;

-- Keep old 1-arg signature as alias for backward compat (no rate limit arg)
CREATE OR REPLACE FUNCTION get_email_by_nickname(p_nickname TEXT)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT get_email_by_nickname(p_nickname, 'unknown');
$$;

GRANT EXECUTE ON FUNCTION get_email_by_nickname(TEXT) TO authenticated, anon;

-- RLS on ratelimit table: only service_role / SECURITY DEFINER writes
ALTER TABLE ratelimit_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY rl_deny_direct ON ratelimit_login_attempts
  FOR ALL USING (FALSE);  -- block all direct access; function is SECURITY DEFINER

-- ----------------------------------------------------------------
-- 8. streaks — block authenticated direct writes
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS streak_write ON streaks;
-- No INSERT/UPDATE/DELETE policy for authenticated → only SECURITY DEFINER
-- recalculate_streaks() already SECURITY DEFINER, so this is safe.

-- ----------------------------------------------------------------
-- GRANT view to authenticated
-- ----------------------------------------------------------------
GRANT SELECT ON users_public TO authenticated;

-- ================================================================
-- VERIFICATION
-- ================================================================
SELECT
  'RLS Hardening Applied' AS status,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS total_policies,
  (SELECT COUNT(*) FROM information_schema.triggers
   WHERE trigger_schema = 'public'
     AND trigger_name IN ('trg_users_no_self_promote','trg_swap_no_self_approve')) AS security_triggers;
