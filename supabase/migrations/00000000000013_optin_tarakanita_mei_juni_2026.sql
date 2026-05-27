-- Migration 013: Bulk update opt-in Mei/Juni 2026 & is_tarakanita
-- Sumber: survei Pengurus, Mei 2026.
-- is_tarakanita Juli+ akan dari pendaftaran ulang; flag ini berlaku sekarang.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    WITH data(nick, optin, tarakanita) AS (
      VALUES
        ('lexa',     'Pas_Libur'::optin_status,  false),
        ('angelica', 'Tidak_Bisa'::optin_status, true),
        ('felicez',  'Tidak_Bisa'::optin_status, true),
        ('juna',     'Pas_Libur'::optin_status,  true),
        ('vara',     'Tidak_Bisa'::optin_status, true),
        ('bena',     'Bisa'::optin_status,        false),
        ('moses',    'Pas_Libur'::optin_status,  false),
        ('eugene',   'Bisa'::optin_status,        true),
        ('eveline',  'Pas_Libur'::optin_status,  false),
        ('felice',   'Tidak_Bisa'::optin_status, true),
        ('beauty',   'Tidak_Bisa'::optin_status, true),
        ('lista',    'Pas_Libur'::optin_status,  true),
        ('alicia',   'Bisa'::optin_status,        true),
        ('adelia',   'Tidak_Bisa'::optin_status, true),
        ('marco',    'Pas_Libur'::optin_status,  true),
        ('owen',     'Tidak_Bisa'::optin_status, true),
        ('alena',    'Bisa'::optin_status,        true),
        ('kelyn',    'Tidak_Bisa'::optin_status, true),
        ('gisshela', 'Tidak_Bisa'::optin_status, true),
        ('jessie',   'Tidak_Bisa'::optin_status, true),
        ('nuel',     'Tidak_Bisa'::optin_status, false),
        ('jona',     'Tidak_Bisa'::optin_status, true),
        ('sekar',    'Bisa'::optin_status,        true),
        ('alden',    'Pas_Libur'::optin_status,  true),
        ('jovan',    'Tidak_Bisa'::optin_status, true),
        ('feli',     'Tidak_Bisa'::optin_status, true),
        ('gratia',   'Tidak_Bisa'::optin_status, true),
        ('pina',     'Tidak_Bisa'::optin_status, true),
        ('wina',     'Tidak_Bisa'::optin_status, true),
        ('rara',     'Tidak_Bisa'::optin_status, true),
        ('martin',   'Tidak_Bisa'::optin_status, true),
        ('alvaro',   'Pas_Libur'::optin_status,  false),
        ('joshua',   'Pas_Libur'::optin_status,  false),
        ('inet',     'Pas_Libur'::optin_status,  false),
        ('thania',   'Bisa'::optin_status,        true),
        ('bintang',  'Pas_Libur'::optin_status,  false),
        ('anya',     'Tidak_Bisa'::optin_status, true),
        ('renzo',    'Tidak_Bisa'::optin_status, true),
        ('tina',     'Pas_Libur'::optin_status,  false),
        ('mastha',   'Tidak_Bisa'::optin_status, true),
        ('alberto',  'Pas_Libur'::optin_status,  true),
        ('sakha',    'Pas_Libur'::optin_status,  false),
        ('tasha',    'Bisa'::optin_status,        true),
        ('flavia',   'Pas_Libur'::optin_status,  true),
        ('vano',     'Tidak_Bisa'::optin_status, true),
        ('noel',     'Tidak_Bisa'::optin_status, true),
        ('ave',      'Pas_Libur'::optin_status,  true),
        ('adhi',     'Tidak_Bisa'::optin_status, true),
        ('rio',      'Pas_Libur'::optin_status,  false),
        ('rayhang',  'Tidak_Bisa'::optin_status, true),
        ('dewi',     'Tidak_Bisa'::optin_status, true)
    )
    SELECT u.id AS user_id, d.optin, d.tarakanita
    FROM   data d
    JOIN   users u ON LOWER(u.nickname) = LOWER(d.nick)
  LOOP
    -- Update is_tarakanita di tabel users
    UPDATE users
    SET    is_tarakanita = r.tarakanita,
           updated_at    = NOW()
    WHERE  id = r.user_id;

    -- Upsert availability Mei 2026
    INSERT INTO misa_harian_availability (user_id, tahun, bulan, status)
    VALUES (r.user_id, 2026, 5, r.optin)
    ON CONFLICT (user_id, tahun, bulan)
    DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();

    -- Upsert availability Juni 2026
    INSERT INTO misa_harian_availability (user_id, tahun, bulan, status)
    VALUES (r.user_id, 2026, 6, r.optin)
    ON CONFLICT (user_id, tahun, bulan)
    DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();
  END LOOP;
END $$;
