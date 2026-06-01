-- Migration 023: Tambah kolom dapat_pic_harian ke tabel users
-- Pengurus yang domisili di luar kota bisa dikecualikan dari pool PIC Misa Harian.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dapat_pic_harian BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.users.dapat_pic_harian IS 'Apakah pengurus ini bisa ditugaskan sebagai PIC Misa Harian (false = dikecualikan)';
