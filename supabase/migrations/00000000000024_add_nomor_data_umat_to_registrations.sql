-- Migration 024: Tambah kolom nomor_data_umat ke tabel registrations
-- Pendaftar baru wajib mengisi nomor data umat saat mendaftar.

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS nomor_data_umat VARCHAR(20) DEFAULT NULL;

COMMENT ON COLUMN public.registrations.nomor_data_umat IS 'Nomor registrasi umat paroki yang diisi saat pendaftaran baru';
