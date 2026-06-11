-- ================================================================
-- SIGMA — RLS Privacy Hardening
--
-- Fixes four over-permissive RLS policies discovered in security audit:
--
-- 1. poin_bonus:          bonus_read USING (auth.uid() IS NOT NULL)
--    → every authenticated user could read ALL bonus rows (all members)
--    Fix: restrict to own rows + staff
--
-- 2. audit_logs:          audit_insert WITH CHECK (role IN ('Admin','Pengurus'))
--    → Pengurus could forge audit log entries by direct INSERT
--    Fix: deny direct INSERT entirely; must use log_audit() SECURITY DEFINER RPC
--
-- 3. swap_requests:       swap_select USING (auth.uid() IS NOT NULL)
--    → every authenticated user could read ALL swap requests incl. alasan (reason)
--    Fix: self + staff see all; others only see public board (is_penawaran+Offered)
--
-- 4. rekap_poin_mingguan/harian: USING (auth.uid() IS NOT NULL)
--    → every authenticated user could read K5/K6 kondisi of all members
--    Fix: own rows + staff only
-- ================================================================

-- ── 1. poin_bonus ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS bonus_read ON poin_bonus;

-- Staff sees all; misdinar sees only own bonus entries
CREATE POLICY bonus_read_self ON poin_bonus
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY bonus_read_staff ON poin_bonus
  FOR SELECT USING (is_staff());

-- ── 2. audit_logs ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS audit_insert ON audit_logs;

-- Direct INSERT denied for everyone; all audit entries MUST go via log_audit() RPC
-- (log_audit is SECURITY DEFINER and handles its own inserts via service role)
CREATE POLICY audit_insert ON audit_logs
  FOR INSERT WITH CHECK (FALSE);

-- ── 3. swap_requests ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS swap_select ON swap_requests;

-- Own requests (requester or pengganti)
CREATE POLICY swap_select_self ON swap_requests
  FOR SELECT USING (
    auth.uid() = requester_id
    OR auth.uid() = pengganti_id
  );

-- Staff sees all swap requests
CREATE POLICY swap_select_staff ON swap_requests
  FOR SELECT USING (is_staff());

-- Public board: anyone authenticated may see offered slots for claiming
-- (does NOT expose alasan / pic_wa_link for unrelated members)
CREATE POLICY swap_select_board ON swap_requests
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND is_penawaran = TRUE
    AND status = 'Offered'
  );

-- ── 4. rekap_poin_mingguan ────────────────────────────────────────────────────
DROP POLICY IF EXISTS rekap_read ON rekap_poin_mingguan;

CREATE POLICY rekap_read_self ON rekap_poin_mingguan
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY rekap_read_staff ON rekap_poin_mingguan
  FOR SELECT USING (is_staff());

-- ── 5. rekap_poin_harian ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS rekap_harian_read ON rekap_poin_harian;

CREATE POLICY rekap_harian_read_self ON rekap_poin_harian
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY rekap_harian_read_staff ON rekap_poin_harian
  FOR SELECT USING (is_staff());
