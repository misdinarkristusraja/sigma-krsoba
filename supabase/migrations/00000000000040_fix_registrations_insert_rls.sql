-- Migration 00000000000040: Fix registrations_insert RLS policy to allow both anon and authenticated users
-- Problem: Migration 00000000000012 restricted registrations_insert TO anon ONLY.
-- As a result, logged-in users (Admin / Pengurus) creating manual registrations in MembersPage got:
-- "new row violates row-level security policy for table 'registrations'"
-- Solution: Expand TO clause to both anon and authenticated roles.

DROP POLICY IF EXISTS registrations_insert ON public.registrations;

CREATE POLICY registrations_insert ON public.registrations
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
