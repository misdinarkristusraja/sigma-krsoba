-- Migration 018: Add 'Pendamping' role
-- Pendamping = Pengurus-level access, works with any status including Retired.

-- ── 1. Enum ─────────────────────────────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Pendamping';

-- Enum ADD VALUE must be committed before it can be used in policies.
-- Supabase management API executes each migration in its own transaction,
-- so we split into two steps: enum in step 1, policies in step 2 below.
-- For the management API one-shot approach we wrap policies in DO blocks
-- that reference the value by text cast to avoid planner errors.

-- ── 2. Helper: centralized staff check (future-proof) ───────────────────────
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT get_current_user_role() IN ('Administrator','Pengurus','Pendamping')
$$;
GRANT EXECUTE ON FUNCTION is_staff() TO authenticated;

CREATE OR REPLACE FUNCTION is_staff_or_pelatih()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT get_current_user_role() IN ('Administrator','Pengurus','Pendamping','Pelatih')
$$;
GRANT EXECUTE ON FUNCTION is_staff_or_pelatih() TO authenticated;

-- ── 3. users ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS users_select_public ON users;
CREATE POLICY users_select_public ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      auth.uid() = id
      OR is_staff_or_pelatih()
    )
  );

DROP POLICY IF EXISTS users_admin ON users;
CREATE POLICY users_admin ON users FOR ALL
  USING (is_staff());

-- ── 4. users_public view (phone/email visibility) ───────────────────────────
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
    CASE WHEN auth.uid() = id OR is_staff_or_pelatih()
         THEN hp_anak ELSE NULL END AS hp_anak,
    CASE WHEN is_staff()
         THEN hp_ortu ELSE NULL END AS hp_ortu,
    CASE WHEN auth.uid() = id OR is_staff()
         THEN email ELSE NULL END AS email,
    CASE WHEN is_staff()
         THEN alamat ELSE NULL END AS alamat,
    CASE WHEN is_staff()
         THEN nama_ayah ELSE NULL END AS nama_ayah,
    CASE WHEN is_staff()
         THEN nama_ibu ELSE NULL END AS nama_ibu,
    NULL::VARCHAR AS password_hash
  FROM public.users
  WHERE auth.uid() IS NOT NULL;

GRANT SELECT ON users_public TO authenticated;

-- ── 5. events ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS events_write ON events;
CREATE POLICY events_write ON events FOR ALL
  USING (is_staff());

-- ── 6. assignments ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS assign_write ON assignments;
CREATE POLICY assign_write ON assignments FOR ALL
  USING (is_staff());

-- ── 7. scan_records ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS scan_read   ON scan_records;
DROP POLICY IF EXISTS scan_read_staff ON scan_records;
CREATE POLICY scan_read_staff ON scan_records FOR SELECT
  USING (is_staff_or_pelatih());

DROP POLICY IF EXISTS scan_insert ON scan_records;
CREATE POLICY scan_insert ON scan_records FOR INSERT
  WITH CHECK (is_staff_or_pelatih());

DROP POLICY IF EXISTS scan_update ON scan_records;
CREATE POLICY scan_update ON scan_records FOR UPDATE
  USING (is_staff());

DROP POLICY IF EXISTS scan_delete ON scan_records;
CREATE POLICY scan_delete ON scan_records FOR DELETE
  USING (is_staff());

-- ── 8. swap_requests ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS swap_insert ON swap_requests;
CREATE POLICY swap_insert ON swap_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id OR is_staff());

DROP POLICY IF EXISTS swap_update_staff ON swap_requests;
CREATE POLICY swap_update_staff ON swap_requests FOR UPDATE
  USING (is_staff());

DROP POLICY IF EXISTS swap_delete ON swap_requests;
CREATE POLICY swap_delete ON swap_requests FOR DELETE
  USING (is_staff() OR auth.uid() = requester_id);

-- ── 9. misa_harian_availability ──────────────────────────────────────────────
DROP POLICY IF EXISTS avail_pengurus ON misa_harian_availability;
CREATE POLICY avail_pengurus ON misa_harian_availability FOR ALL
  USING (is_staff());

-- ── 10. registrations ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS registrations_read   ON registrations;
CREATE POLICY registrations_read ON registrations FOR SELECT
  USING (is_staff());

DROP POLICY IF EXISTS registrations_update ON registrations;
CREATE POLICY registrations_update ON registrations FOR UPDATE
  USING (is_staff());

-- ── 11. reregistrations ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS rereg_user_read ON reregistrations;
CREATE POLICY rereg_user_read ON reregistrations FOR SELECT
  USING (auth.uid() = user_id OR is_staff());

DROP POLICY IF EXISTS rereg_staff_update ON reregistrations;
CREATE POLICY rereg_staff_update ON reregistrations FOR UPDATE
  USING (is_staff());

-- ── 12. notifications ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS notif_staff_insert ON notifications;
CREATE POLICY notif_staff_insert ON notifications FOR INSERT
  WITH CHECK (is_staff());

-- ── 13. audit_logs ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS audit_read   ON audit_logs;
CREATE POLICY audit_read ON audit_logs FOR SELECT
  USING (is_staff());

DROP POLICY IF EXISTS audit_insert ON audit_logs;
CREATE POLICY audit_insert ON audit_logs FOR INSERT
  WITH CHECK (is_staff());

-- ── 14. streaks ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS streak_read_self ON streaks;
CREATE POLICY streak_read_self ON streaks FOR SELECT
  USING (auth.uid() = user_id OR is_staff_or_pelatih());

-- ── 15. event_latihan ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS ela_write ON event_latihan;
CREATE POLICY ela_write ON event_latihan FOR ALL
  USING (is_staff_or_pelatih());

DROP POLICY IF EXISTS elat_write ON event_latihan_attendance;
CREATE POLICY elat_write ON event_latihan_attendance FOR ALL
  USING (is_staff_or_pelatih());

DROP POLICY IF EXISTS elab_staff ON event_latihan_absence;
CREATE POLICY elab_staff ON event_latihan_absence FOR ALL
  USING (is_staff_or_pelatih());

-- ── 16. latihan_threshold_notified ───────────────────────────────────────────
DROP POLICY IF EXISTS ltn_write ON latihan_threshold_notified;
CREATE POLICY ltn_write ON latihan_threshold_notified FOR ALL
  USING (is_staff());

-- ── 17. acara ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "acara_insert_peng" ON acara;
CREATE POLICY "acara_insert_peng" ON acara FOR INSERT TO authenticated
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "acara_update_peng" ON acara;
CREATE POLICY "acara_update_peng" ON acara FOR UPDATE TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "acara_delete_peng" ON acara;
CREATE POLICY "acara_delete_peng" ON acara FOR DELETE TO authenticated
  USING (is_staff());

-- ── 18. event_pics ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS event_pics_write ON event_pics;
CREATE POLICY event_pics_write ON event_pics FOR ALL
  USING (is_staff());

DROP POLICY IF EXISTS event_pics_read ON event_pics;
CREATE POLICY event_pics_read ON event_pics FOR SELECT
  USING (is_staff_or_pelatih());

-- ── 19. Trigger: trg_users_no_self_promote ───────────────────────────────────
CREATE OR REPLACE FUNCTION trg_users_no_self_promote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_role FROM public.users WHERE id = auth.uid() LIMIT 1;
  IF v_role NOT IN ('Administrator','Pengurus','Pendamping') THEN
    IF NEW.role         IS DISTINCT FROM OLD.role         THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change own role';
    END IF;
    IF NEW.status       IS DISTINCT FROM OLD.status       THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change own status';
    END IF;
    IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change own suspension';
    END IF;
    IF NEW.myid         IS DISTINCT FROM OLD.myid         THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change myid';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 20. Trigger: trg_swap_no_self_approve (re-patch with Pendamping) ─────────
CREATE OR REPLACE FUNCTION trg_swap_no_self_approve()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
  IF current_setting('app.trusted_fn', true) = 'true' THEN
    RETURN NEW;
  END IF;
  SELECT role::TEXT INTO v_role FROM public.users WHERE id = auth.uid() LIMIT 1;
  IF v_role NOT IN ('Administrator','Pengurus','Pendamping') THEN
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

-- ── 21. offer_to_board: add Pendamping to FORBIDDEN check ────────────────────
CREATE OR REPLACE FUNCTION offer_to_board(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_req   swap_requests%ROWTYPE;
  v_uid   UUID := auth.uid();
  v_role  TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;
  SELECT role::TEXT INTO v_role FROM users WHERE id = v_uid;
  SELECT * INTO v_req FROM swap_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_req.requester_id <> v_uid AND v_role NOT IN ('Administrator','Pengurus','Pendamping') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_req.status <> 'Approved_PIC' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_APPROVED_PIC');
  END IF;
  PERFORM set_config('app.trusted_fn', 'true', true);
  UPDATE swap_requests SET status = 'Offered', is_penawaran = true WHERE id = p_request_id;
  PERFORM set_config('app.trusted_fn', 'false', true);
  RETURN jsonb_build_object('ok', true);
END;
$func$;
GRANT EXECUTE ON FUNCTION offer_to_board(UUID) TO authenticated;

-- ── 22. admin_approve_registration: add Pendamping ───────────────────────────
-- (patched inline — full function redefined with Pendamping added)
CREATE OR REPLACE FUNCTION admin_approve_registration(
  p_registration_id UUID,
  p_myid            VARCHAR,
  p_temp_password   TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $func$
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

  IF v_caller_role NOT IN ('Administrator','Pengurus','Pendamping') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN',
      'message', 'Hanya Administrator/Pengurus/Pendamping yang dapat approve.');
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

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid(), v_new_id,
    jsonb_build_object('sub', v_new_id::TEXT, 'email', v_email),
    'email', v_new_id::TEXT, NOW(), NOW(), NOW()
  );

  INSERT INTO public.users (
    id, nickname, myid, nama_lengkap, nama_panggilan, tanggal_lahir,
    pendidikan, sekolah, is_tarakanita, wilayah, lingkungan,
    email, hp_anak, hp_ortu, nama_ayah, nama_ibu, alamat,
    alasan_masuk, sampai_kapan, surat_pernyataan_url,
    role, status, must_change_password, registration_year
  ) VALUES (
    v_new_id, v_reg.nickname, p_myid, v_reg.nama_lengkap, v_reg.nickname,
    v_reg.tanggal_lahir, v_reg.pendidikan, v_reg.sekolah,
    COALESCE(v_reg.is_tarakanita, false), v_reg.wilayah,
    COALESCE(v_reg.lingkungan, ''),
    v_email, v_reg.hp_anak, v_reg.hp_ortu,
    v_reg.nama_ayah, v_reg.nama_ibu, v_reg.alamat,
    v_reg.alasan_masuk, v_reg.sampai_kapan, v_reg.surat_pernyataan_url,
    'Misdinar_Aktif', 'Active', true, EXTRACT(YEAR FROM NOW())::INTEGER
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
$func$;
