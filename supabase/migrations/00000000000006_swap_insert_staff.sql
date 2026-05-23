-- ================================================================
-- SIGMA — Fix swap_insert RLS policy
-- Allow Administrator/Pengurus to insert swap_requests on behalf of
-- other members (admin manual entry). Previously only requester_id
-- matching auth.uid() was allowed, blocking admin form.
-- ================================================================

DROP POLICY IF EXISTS swap_insert ON swap_requests;

CREATE POLICY swap_insert ON swap_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    OR get_current_user_role() IN ('Administrator', 'Pengurus')
  );
