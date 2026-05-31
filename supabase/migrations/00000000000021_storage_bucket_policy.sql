-- Migration 021: Enforce private storage buckets + RLS policies
-- Ensures bucket 'documents' is NOT public (all access via signed URL only).
-- Adds granular RLS: anon can INSERT during registration; staff can SELECT all.

-- ── 1. Ensure bucket exists and is private ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,                -- NOT public-read
  2097152,              -- 2 MB limit
  ARRAY['application/pdf','image/jpeg','image/png','image/jpg']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. Drop existing loose policies if any ──────────────────────────
DROP POLICY IF EXISTS "documents_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "documents_anon_upload"    ON storage.objects;
DROP POLICY IF EXISTS "documents_auth_upload"    ON storage.objects;
DROP POLICY IF EXISTS "documents_staff_read"     ON storage.objects;
DROP POLICY IF EXISTS "documents_owner_delete"   ON storage.objects;

-- ── 3. RLS must be enabled on storage.objects (Supabase default) ────
-- (Already enabled by Supabase; this is a no-op safety net)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ── 4. Anonymous INSERT — for registration PDF + sertifikat upload ──
-- Allowed for 'surat/' and 'sertifikat/' prefixes only; no read/delete.
CREATE POLICY "documents_anon_upload"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (
      (storage.filename(name) IS NOT NULL)
      AND (
        name LIKE 'surat/%'
        OR name LIKE 'sertifikat/%'
      )
    )
  );

-- ── 5. Staff SELECT — Administrator, Pengurus, Pendamping ───────────
CREATE POLICY "documents_staff_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1
    ) IN ('Administrator', 'Pengurus', 'Pendamping')
  );

-- ── 6. Owner DELETE — only the authenticated user who uploaded ───────
-- Keyed on path: surat/TIMESTAMP_nickname_*.pdf — not strictly ownable,
-- so we restrict delete to Administrator only.
CREATE POLICY "documents_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1
    ) = 'Administrator'
  );
