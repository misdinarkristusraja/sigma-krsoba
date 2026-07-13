-- Migration 033: Fix admin_approve_registration to not reference dropped sertifikat_komuni_url

CREATE OR REPLACE FUNCTION public.admin_approve_registration(
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
    jsonb_build_object('sub', v_new_id::TEXT, 'email', v_email,
      'email_verified', true, 'phone_verified', false),
    'email', v_email, NOW(), NOW(), NOW()
  );

  INSERT INTO public.users (
    id, nickname, myid, nama_lengkap, nama_panggilan, tanggal_lahir,
    pendidikan, sekolah, is_tarakanita, wilayah, lingkungan,
    email, hp_anak, hp_ortu, nama_ayah, nama_ibu, alamat,
    alasan_masuk, sampai_kapan,
    surat_pernyataan_url,
    role, status, must_change_password, registration_year
  ) VALUES (
    v_new_id, v_reg.nickname, p_myid, v_reg.nama_lengkap, v_reg.nickname,
    v_reg.tanggal_lahir, v_reg.pendidikan, v_reg.sekolah,
    COALESCE(v_reg.is_tarakanita, false), v_reg.wilayah,
    COALESCE(v_reg.lingkungan, ''),
    v_email, v_reg.hp_anak, v_reg.hp_ortu,
    v_reg.nama_ayah, v_reg.nama_ibu, v_reg.alamat,
    v_reg.alasan_masuk, v_reg.sampai_kapan,
    v_reg.surat_pernyataan_url,
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

GRANT EXECUTE ON FUNCTION public.admin_approve_registration(UUID, VARCHAR, TEXT) TO authenticated;
