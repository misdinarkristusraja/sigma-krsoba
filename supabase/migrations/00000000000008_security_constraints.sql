-- ================================================================
-- SIGMA — Security & constraint hardening
-- 1. Restrict swap_select RLS — was public to all authenticated users
-- 2. Add CHECK constraint on rekap_poin_mingguan.kondisi
-- ================================================================

-- ----------------------------------------------------------------
-- 1. swap_requests SELECT policy: own rows + papan + staff
--    Before: any auth user could read ALL swap requests (privacy leak)
--    After:  own rows (requester/pengganti) OR Offered board entries
--            OR staff (Administrator/Pengurus/Pelatih)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS swap_select ON swap_requests;

CREATE POLICY swap_select ON swap_requests FOR SELECT
  USING (
    auth.uid() = requester_id
    OR auth.uid() = pengganti_id
    OR is_penawaran = TRUE
    OR get_current_user_role() IN ('Administrator', 'Pengurus', 'Pelatih')
  );

-- ----------------------------------------------------------------
-- 2. kondisi CHECK constraint on rekap_poin_mingguan
--    Includes new 9-kondisi codes + legacy codes for backward compat
-- ----------------------------------------------------------------
ALTER TABLE rekap_poin_mingguan
  DROP CONSTRAINT IF EXISTS chk_kondisi_valid;

ALTER TABLE rekap_poin_mingguan
  ADD CONSTRAINT chk_kondisi_valid
  CHECK (
    kondisi IS NULL
    OR kondisi IN (
      'K1', 'K2a', 'K2b', 'K3a', 'K3b', 'K3c',
      'K4a', 'K4c', 'K6',
      -- legacy 6-kondisi codes (pre-migration rows)
      'K2', 'K3', 'K4', 'K5'
    )
  );
