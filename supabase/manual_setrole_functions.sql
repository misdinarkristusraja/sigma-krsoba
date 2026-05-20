-- ================================================================
-- SIGMA -- Admin Functions that write to auth.*
-- Run this in: Supabase Dashboard -> SQL Editor
-- ================================================================
-- postgres role already has INSERT/UPDATE on auth.users + auth.identities.
-- SECURITY DEFINER functions owned by postgres can write auth.* directly.
-- No SET ROLE or ALTER OWNER needed.
-- ================================================================

-- ----------------------------------------------------------------
-- admin_reset_password -- reset 1 user password
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_target_id UUID,
  p_new_password TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role  TEXT;
  v_target_email TEXT;
  v_email_taken  BOOLEAN;
  v_exists       BOOLEAN;
  v_inst_id      UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED',
      'message', 'Anda belum login.');
  END IF;

  SELECT role::TEXT INTO v_caller_role
  FROM public.users WHERE id = auth.uid() LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role <> 'Administrator' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN',
      'message', 'Hanya Administrator yang dapat mereset password.');
  END IF;

  IF p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PASSWORD',
      'message', 'Password minimal 6 karakter.');
  END IF;

  SELECT email INTO v_target_email FROM public.users WHERE id = p_target_id;
  IF v_target_email IS NULL OR trim(v_target_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND',
      'message', 'User tidak ditemukan atau email kosong.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE LOWER(email) = LOWER(v_target_email) AND id <> p_target_id
  ) INTO v_email_taken;

  IF v_email_taken THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMAIL_CONFLICT',
      'message', 'Email ' || v_target_email || ' sudah dipakai akun lain.');
  END IF;

  SELECT instance_id INTO v_inst_id FROM auth.users LIMIT 1;
  v_inst_id := COALESCE(v_inst_id, '00000000-0000-0000-0000-000000000000'::UUID);

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_id) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, email_change_token_new, recovery_token
    ) VALUES (
      p_target_id, v_inst_id, 'authenticated', 'authenticated',
      v_target_email,
      extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::JSONB,
      '{}'::JSONB, false, '', '', ''
    ) ON CONFLICT (id) DO NOTHING;
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        banned_until       = NULL,
        confirmation_token = '',
        recovery_token     = '',
        email_change_token_new = '',
        aud   = 'authenticated',
        role  = 'authenticated',
        updated_at = NOW()
    WHERE id = p_target_id;
  END IF;

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid(), p_target_id,
    jsonb_build_object('sub', p_target_id::TEXT,
      'email', v_target_email,
      'email_verified', true, 'phone_verified', false),
    'email', v_target_email,
    NOW(), NOW(), NOW()
  ) ON CONFLICT DO NOTHING;

  UPDATE public.users
  SET must_change_password = true, updated_at = NOW()
  WHERE id = p_target_id;

  RETURN jsonb_build_object('ok', true,
    'target_id', p_target_id, 'email', v_target_email);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'DB_ERROR',
    'message', SQLERRM, 'detail', SQLSTATE);
END;
$$;


-- ----------------------------------------------------------------
-- admin_provision_all -- mass reset password for all members
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_provision_all()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role  TEXT;
  v_member       RECORD;
  v_password     TEXT;
  v_success      INT := 0;
  v_skipped      INT := 0;
  v_failed       INT := 0;
  v_results      JSONB := '[]'::JSONB;
  v_entry        JSONB;
  v_reset_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED',
      'message', 'Anda belum login.');
  END IF;

  SELECT role::TEXT INTO v_caller_role
  FROM public.users WHERE id = auth.uid() LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role <> 'Administrator' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN',
      'message', 'Hanya Administrator.');
  END IF;

  FOR v_member IN
    SELECT pu.id, pu.nickname, pu.nama_panggilan,
           pu.lingkungan, pu.hp_ortu, pu.hp_anak, pu.email
    FROM public.users pu
    WHERE pu.status IN ('Active','Pending')
      AND pu.role::TEXT <> 'Administrator'
    ORDER BY pu.nama_panggilan
  LOOP
    IF v_member.email IS NULL OR trim(v_member.email) = '' THEN
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_object(
        'id', v_member.id, 'nickname', v_member.nickname,
        'nama', v_member.nama_panggilan,
        'ok', false, 'skipped', true, 'error', 'EMAIL_KOSONG'
      );
      CONTINUE;
    END IF;

    v_password := public.generate_random_password(10);
    v_reset_result := public.admin_reset_password(v_member.id, v_password);

    IF (v_reset_result->>'ok')::BOOLEAN THEN
      v_success := v_success + 1;
      v_entry := v_reset_result || jsonb_build_object(
        'nickname',   v_member.nickname,
        'nama',       v_member.nama_panggilan,
        'lingkungan', COALESCE(v_member.lingkungan,''),
        'hp_ortu',    COALESCE(v_member.hp_ortu,''),
        'hp_anak',    COALESCE(v_member.hp_anak,''),
        'password',   v_password
      );
    ELSE
      v_failed := v_failed + 1;
      v_entry := v_reset_result || jsonb_build_object(
        'nickname', v_member.nickname,
        'nama',     v_member.nama_panggilan
      );
    END IF;

    v_results := v_results || v_entry;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'total',   v_success + v_skipped + v_failed,
    'success', v_success,
    'skipped', v_skipped,
    'failed',  v_failed,
    'results', v_results
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'DB_FATAL',
    'message', SQLERRM, 'detail', SQLSTATE);
END;
$$;


-- ----------------------------------------------------------------
-- admin_approve_registration -- approve pending registration
-- Creates auth.users + auth.identities + public.users in 1 RPC
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_registration(
  p_registration_id UUID,
  p_myid            VARCHAR(10),
  p_temp_password   TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
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

  IF v_caller_role NOT IN ('Administrator','Pengurus') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN',
      'message', 'Hanya Administrator/Pengurus yang dapat approve.');
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
    jsonb_build_object('sub', v_new_id::TEXT, 'email', v_email,
      'email_verified', true, 'phone_verified', false),
    'email', v_email, NOW(), NOW(), NOW()
  );

  INSERT INTO public.users (
    id, nickname, myid, nama_lengkap, nama_panggilan, tanggal_lahir,
    pendidikan, sekolah, is_tarakanita, wilayah, lingkungan,
    email, hp_anak, hp_ortu, nama_ayah, nama_ibu, alamat,
    alasan_masuk, sampai_kapan, surat_pernyataan_url,
    role, status, must_change_password
  ) VALUES (
    v_new_id, v_reg.nickname, p_myid, v_reg.nama_lengkap, v_reg.nickname,
    v_reg.tanggal_lahir, v_reg.pendidikan, v_reg.sekolah,
    COALESCE(v_reg.is_tarakanita, false), v_reg.wilayah,
    COALESCE(v_reg.lingkungan, ''),
    v_email, v_reg.hp_anak, v_reg.hp_ortu,
    v_reg.nama_ayah, v_reg.nama_ibu, v_reg.alamat,
    v_reg.alasan_masuk, v_reg.sampai_kapan, v_reg.surat_pernyataan_url,
    'Misdinar_Aktif', 'Active', true
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
$$;


-- ----------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT)                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_provision_all()                               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_registration(UUID, VARCHAR, TEXT)     TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT)                   FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_provision_all()                              FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_approve_registration(UUID, VARCHAR, TEXT)    FROM anon, PUBLIC;
