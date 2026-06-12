-- ================================================================
-- SIGMA — Security Hardening Phase 2
--
-- Fixes discovered in second security audit:
--
-- 1. event_latihan_absence: SELECT USING (TRUE)
--    → Any authenticated user could read ALL absence records including
--      personal reasons (sakit, acara_keluarga_urgent, etc.)
--    Fix: restrict to own rows + staff (Admin/Pengurus/Pelatih/Pendamping)
--
-- 2. claim_swap_request: no claimer eligibility check
--    → Suspended or Pending users could claim offered swap slots
--    Fix: verify claimer status = 'Active' AND is_suspended = FALSE
--
-- 3. events: draft events USING (TRUE)
--    → Draft/unpublished events visible to ALL authenticated users
--      (incomplete data, schedule not yet approved by Pengurus)
--    Fix: published events = all authenticated; draft = staff only
--
-- 4. latihan_threshold_notified: SELECT USING (TRUE)
--    → Internal notification tracking table readable by everyone
--    Fix: own rows + Admin/Pengurus
--
-- 5. change_my_password: minimum 6 chars
--    → Too weak for an app storing personal data (NIK, hp, alamat)
--    Fix: minimum 8 characters
-- ================================================================

-- ── 1. event_latihan_absence — restrict absence data ─────────────────
-- Before: USING (TRUE) — any logged-in user read all absence reasons
-- After : own row + staff only

DROP POLICY IF EXISTS elab_read ON event_latihan_absence;

CREATE POLICY elab_read_self ON event_latihan_absence
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY elab_read_staff ON event_latihan_absence
  FOR SELECT USING (
    get_current_user_role() IN ('Administrator','Pengurus','Pelatih','Pendamping')
  );

-- ── 2. claim_swap_request — claimer eligibility check ─────────────────
-- Added: status = 'Active' AND is_suspended = FALSE guard

CREATE OR REPLACE FUNCTION claim_swap_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_req     swap_requests%ROWTYPE;
  v_uid     UUID := auth.uid();
  v_claimer RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- Claimer must be Active and not suspended
  SELECT status, is_suspended INTO v_claimer FROM users WHERE id = v_uid LIMIT 1;
  IF NOT FOUND OR v_claimer.status::TEXT <> 'Active' OR v_claimer.is_suspended THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'CLAIMER_NOT_ELIGIBLE',
      'message', 'Hanya anggota aktif yang dapat mengambil jadwal penawaran'
    );
  END IF;

  SELECT * INTO v_req FROM swap_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_req.status <> 'Offered' OR v_req.is_penawaran = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_OFFERED');
  END IF;

  IF v_req.requester_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CANNOT_CLAIM_OWN');
  END IF;

  UPDATE swap_requests
  SET status = 'Replaced', pengganti_id = v_uid
  WHERE id = p_request_id;

  UPDATE assignments
  SET user_id = v_uid
  WHERE id = v_req.assignment_id;

  RETURN jsonb_build_object('ok', true);
END;
$func$;

GRANT EXECUTE ON FUNCTION claim_swap_request(UUID) TO authenticated;

-- ── 3. events — restrict draft visibility to staff ────────────────────
-- Before: USING (TRUE) — draft + published readable by everyone
-- After : published = all (incl. anon for public schedule);
--         draft = staff only

DROP POLICY IF EXISTS events_read ON events;

-- Published events: any role (supports public /jadwal page via anon key)
CREATE POLICY events_read_published ON events
  FOR SELECT USING (is_draft = FALSE);

-- Draft events: staff only (Pengurus schedule management, ScanLatihan preview)
CREATE POLICY events_read_draft ON events
  FOR SELECT USING (
    is_draft = TRUE
    AND get_current_user_role() IN ('Administrator','Pengurus','Pelatih','Pendamping')
  );

-- ── 4. latihan_threshold_notified — restrict to self + staff ─────────
-- Before: USING (TRUE) — internal threshold tracking readable by all
-- After : own row + Admin/Pengurus

DROP POLICY IF EXISTS ltn_read ON latihan_threshold_notified;

CREATE POLICY ltn_read_self ON latihan_threshold_notified
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY ltn_read_staff ON latihan_threshold_notified
  FOR SELECT USING (
    get_current_user_role() IN ('Administrator','Pengurus')
  );

-- ── 5. change_my_password — minimum 8 characters ─────────────────────
-- Before: 6 characters minimum
-- After : 8 characters minimum (stronger baseline for personal data app)

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
  IF length(p_new_password) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Password minimal 8 karakter');
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

GRANT   EXECUTE ON FUNCTION change_my_password(TEXT) TO authenticated;
REVOKE  EXECUTE ON FUNCTION change_my_password(TEXT) FROM anon, PUBLIC;
