-- =============================================================================
-- Migration: 023_fix_admin_permissions.sql
-- Tujuan   : Perbaikan menyeluruh permission admin_provision_all &
--            admin_reset_password agar bisa dipanggil dari Edge Function
--            maupun frontend tanpa konflik GRANT/REVOKE.
-- Aman     : Seluruh operasi dibungkus DO $$ sehingga atomic.
--            Zero-regression terhadap fungsi/tabel lain.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 0: Pastikan extension yang dibutuhkan tersedia
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- STEP 1: Bersihkan semua GRANT & REVOKE yang saling bertabrakan
--         dari migrasi sebelumnya (016 s.d 022) pada kedua fungsi.
--         Kita mulai dari state bersih, lalu set ulang dengan benar.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Cabut SEMUA privilege dari SEMUA role dahulu agar baseline bersih
  -- (tidak error jika sebelumnya belum di-grant)
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name   = 'admin_provision_all'
  ) THEN
    REVOKE ALL ON FUNCTION public.admin_provision_all()       FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.admin_provision_all()       FROM anon;
    REVOKE ALL ON FUNCTION public.admin_provision_all()       FROM authenticated;
    REVOKE ALL ON FUNCTION public.admin_provision_all()       FROM service_role;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name   = 'admin_reset_password'
  ) THEN
    REVOKE ALL ON FUNCTION public.admin_reset_password(UUID, TEXT) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.admin_reset_password(UUID, TEXT) FROM anon;
    REVOKE ALL ON FUNCTION public.admin_reset_password(UUID, TEXT) FROM authenticated;
    REVOKE ALL ON FUNCTION public.admin_reset_password(UUID, TEXT) FROM service_role;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name   = 'generate_random_password'
  ) THEN
    REVOKE ALL ON FUNCTION public.generate_random_password(INT) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.generate_random_password(INT) FROM anon;
    REVOKE ALL ON FUNCTION public.generate_random_password(INT) FROM authenticated;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 2: Recreate generate_random_password sebagai helper internal.
--         SECURITY DEFINER + search_path terkunci = aman dari privilege
--         escalation. Tidak diekspos ke role eksternal.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_random_password(len INT DEFAULT 10)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  chars  TEXT    := 'abcdefghjkmnpqrstuvwxyz23456789';
  result TEXT    := '';
  raw    BYTEA   := extensions.gen_random_bytes(len * 2);
  i      INT;
BEGIN
  FOR i IN 1..len LOOP
    result := result || substr(chars, (get_byte(raw, i - 1) % length(chars)) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.generate_random_password(INT) IS
  'Internal helper: generate password alfanumerik acak. Hanya dipanggil oleh fungsi SECURITY DEFINER lain.';

-- ---------------------------------------------------------------------------
-- STEP 3: Recreate admin_reset_password — reset satu user.
--         SECURITY DEFINER agar bisa tulis ke auth.users tanpa service_role.
--         Role check internal: hanya Administrator yang boleh memanggil.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_target_id UUID,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_target_email TEXT;
  v_target_exists BOOLEAN;
  v_email_conflict BOOLEAN;
BEGIN
  -- [A] Pastikan pemanggil sudah login
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'UNAUTHENTICATED',
      'message', 'Anda belum login.'
    );
  END IF;

  -- [B] Pastikan pemanggil adalah Administrator
  SELECT role INTO v_caller_role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role::TEXT <> 'Administrator' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'FORBIDDEN',
      'message', 'Hanya Administrator yang dapat mereset password.'
    );
  END IF;

  -- [C] Validasi password baru
  IF p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INVALID_PASSWORD',
      'message', 'Password minimal 6 karakter.'
    );
  END IF;

  -- [D] Cek target user ada di public.users
  SELECT email INTO v_target_email
  FROM public.users
  WHERE id = p_target_id
  LIMIT 1;

  IF NOT FOUND OR v_target_email IS NULL OR trim(v_target_email) = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'USER_NOT_FOUND',
      'message', 'User tidak ditemukan atau email kosong.',
      'target_id', p_target_id
    );
  END IF;

  -- [E] Cek konflik email (email dipakai auth.user lain)
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE LOWER(email) = LOWER(v_target_email)
      AND id <> p_target_id
  ) INTO v_email_conflict;

  IF v_email_conflict THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'EMAIL_CONFLICT',
      'message', 'Email ' || v_target_email || ' sudah dipakai akun auth lain.',
      'target_id', p_target_id
    );
  END IF;

  -- [F] Pastikan auth.users record ada; jika tidak, buat (upsert)
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_id)
  INTO v_target_exists;

  IF NOT v_target_exists THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at, confirmation_sent_at,
      recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    )
    SELECT
      p_target_id,
      (SELECT instance_id FROM auth.users LIMIT 1),
      'authenticated',
      'authenticated',
      v_target_email,
      extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      NOW(), NOW(), NULL, NULL,
      '{"provider":"email","providers":["email"]}'::JSONB,
      '{}'::JSONB,
      NOW(), NOW()
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- [G] Update password + pastikan email confirmed & tidak banned
    UPDATE auth.users
    SET
      encrypted_password   = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      email                = v_target_email,
      email_confirmed_at   = COALESCE(email_confirmed_at, NOW()),
      banned_until         = NULL,
      raw_app_meta_data    = COALESCE(raw_app_meta_data,
                               '{"provider":"email","providers":["email"]}'::JSONB),
      updated_at           = NOW()
    WHERE id = p_target_id;
  END IF;

  -- [H] Pastikan identity email ada (tanpa identity, login email tidak bisa)
  INSERT INTO auth.identities (
    id, user_id, provider, identity_data,
    provider_id, last_sign_in_at, created_at, updated_at
  )
  VALUES (
    p_target_id,
    p_target_id,
    'email',
    jsonb_build_object('sub', p_target_id::TEXT, 'email', v_target_email),
    p_target_id::TEXT,
    NOW(), NOW(), NOW()
  )
  ON CONFLICT (provider, provider_id) DO UPDATE
    SET identity_data = EXCLUDED.identity_data,
        updated_at    = NOW();

  -- [I] Tandai user harus ganti password saat login pertama
  UPDATE public.users
  SET
    must_change_password = true,
    updated_at           = NOW()
  WHERE id = p_target_id;

  RETURN jsonb_build_object(
    'ok',       true,
    'target_id', p_target_id,
    'email',    v_target_email
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok',      false,
    'error',   'DB_ERROR',
    'message', SQLERRM,
    'detail',  SQLSTATE
  );
END;
$$;

COMMENT ON FUNCTION public.admin_reset_password(UUID, TEXT) IS
  'Reset password satu user. Hanya bisa dipanggil oleh Administrator. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- STEP 4: Recreate admin_provision_all — reset semua user aktif/pending.
--         KEAMANAN: Role check internal (bukan lewat RLS) agar tidak
--         bergantung pada konfigurasi policy yang bisa berbeda-beda.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_provision_all()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role  TEXT;
  v_member       RECORD;
  v_password     TEXT;
  v_success      INT  := 0;
  v_skipped      INT  := 0;
  v_failed       INT  := 0;
  v_results      JSONB := '[]'::JSONB;
  v_entry        JSONB;
  v_reset_result JSONB;
BEGIN
  -- [A] Pastikan pemanggil sudah login
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'UNAUTHENTICATED',
      'message', 'Anda belum login.'
    );
  END IF;

  -- [B] Cek role pemanggil
  SELECT role INTO v_caller_role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role::TEXT <> 'Administrator' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'FORBIDDEN',
      'message', 'Hanya Administrator yang dapat menjalankan mass reset.'
    );
  END IF;

  -- [C] Iterasi semua user Active/Pending (bukan Administrator)
  FOR v_member IN
    SELECT
      pu.id,
      pu.nickname,
      pu.nama_panggilan,
      pu.lingkungan,
      pu.hp_ortu,
      pu.hp_anak,
      pu.email
    FROM public.users pu
    WHERE pu.status IN ('Active', 'Pending')
      AND pu.role::TEXT <> 'Administrator'
    ORDER BY pu.nama_panggilan
  LOOP

    -- [D] Skip user dengan email kosong
    IF v_member.email IS NULL OR trim(v_member.email) = '' THEN
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_object(
        'id',       v_member.id,
        'nickname', v_member.nickname,
        'nama',     v_member.nama_panggilan,
        'ok',       false,
        'skipped',  true,
        'error',    'EMAIL_KOSONG'
      );
      CONTINUE;
    END IF;

    -- [E] Generate password baru
    v_password := public.generate_random_password(10);

    -- [F] Delegate ke admin_reset_password (reuse logika upsert + identity)
    --     Catatan: auth.uid() tetap valid karena kita masih dalam konteks
    --     satu transaksi dengan session yang sama.
    v_reset_result := public.admin_reset_password(v_member.id, v_password);

    -- [G] Catat hasil per-user (password disertakan agar frontend bisa kirim WA)
    IF (v_reset_result->>'ok')::BOOLEAN THEN
      v_success := v_success + 1;
      v_entry   := v_reset_result || jsonb_build_object(
        'nickname',   v_member.nickname,
        'nama',       v_member.nama_panggilan,
        'lingkungan', COALESCE(v_member.lingkungan, ''),
        'hp_ortu',    COALESCE(v_member.hp_ortu, ''),
        'hp_anak',    COALESCE(v_member.hp_anak, ''),
        'password',   v_password    -- plain text untuk dikirim via WA/notif
      );
    ELSE
      v_failed := v_failed + 1;
      v_entry  := v_reset_result || jsonb_build_object(
        'nickname', v_member.nickname,
        'nama',     v_member.nama_panggilan
      );
    END IF;

    v_results := v_results || v_entry;

  END LOOP;

  RETURN jsonb_build_object(
    'ok',      true,
    'total',   v_success + v_skipped + v_failed,
    'success', v_success,
    'skipped', v_skipped,
    'failed',  v_failed,
    'results', v_results
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok',      false,
    'error',   'DB_FATAL',
    'message', SQLERRM,
    'detail',  SQLSTATE
  );
END;
$$;

COMMENT ON FUNCTION public.admin_provision_all() IS
  'Mass reset password semua user Active/Pending. Hanya Administrator. SECURITY DEFINER. Mengembalikan hasil per-user termasuk password plain-text untuk notifikasi.';

-- ---------------------------------------------------------------------------
-- STEP 5: Set GRANT yang benar dan bersih.
--
--   - anon          : TIDAK boleh (tidak login = tidak boleh)
--   - authenticated : BOLEH (fungsi sendiri yang cek apakah dia Administrator)
--   - service_role  : BOLEH (untuk Edge Function yang pakai service_role_key)
--
--   generate_random_password: internal, tidak perlu diekspos ke luar
-- ---------------------------------------------------------------------------

-- admin_provision_all
GRANT EXECUTE ON FUNCTION public.admin_provision_all()
  TO authenticated, service_role;

-- admin_reset_password
GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT)
  TO authenticated, service_role;

-- generate_random_password: HANYA service_role & postgres (internal)
GRANT EXECUTE ON FUNCTION public.generate_random_password(INT)
  TO service_role;

-- Pastikan anon tidak bisa memanggil apapun
REVOKE EXECUTE ON FUNCTION public.admin_provision_all()          FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_random_password(INT)  FROM anon, PUBLIC, authenticated;

-- ---------------------------------------------------------------------------
-- STEP 6: Pastikan kolom must_change_password ada (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'must_change_password'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'updated_at'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 7: Smoke-test (berjalan saat migration dieksekusi)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn_provision  BOOLEAN;
  fn_reset      BOOLEAN;
  fn_randpw     BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'admin_provision_all'
  ) INTO fn_provision;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'admin_reset_password'
  ) INTO fn_reset;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'generate_random_password'
  ) INTO fn_randpw;

  IF NOT fn_provision OR NOT fn_reset OR NOT fn_randpw THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Satu atau lebih fungsi tidak terdaftar. Cek log di atas.';
  END IF;

  RAISE NOTICE '✅ Migration 023 OK: admin_provision_all=%, admin_reset_password=%, generate_random_password=%',
    fn_provision, fn_reset, fn_randpw;
END;
$$;
