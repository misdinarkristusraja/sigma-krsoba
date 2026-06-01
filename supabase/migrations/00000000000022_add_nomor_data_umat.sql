-- Migration 022: Tambah kolom nomor_data_umat ke tabel users
-- Nomor Data Umat adalah nomor registrasi umat paroki.
-- Diisi saat daftar ulang; nullable (tidak semua anggota punya nomor ini).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS nomor_data_umat VARCHAR(20) DEFAULT NULL;

COMMENT ON COLUMN public.users.nomor_data_umat IS 'Nomor registrasi umat paroki (opsional, diisi saat daftar ulang)';
