-- Migration: tambah kolom registration_year ke users
-- Diisi saat approve pendaftaran manual (bukan import).
-- NULL = anggota lama/import → wajib daftar ulang.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS registration_year INTEGER DEFAULT NULL;
