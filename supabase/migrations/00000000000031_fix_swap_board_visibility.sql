-- Migration 031: Fix swap board requester visibility for standard members

-- Drop policy if exists to avoid conflicts
DROP POLICY IF EXISTS users_select_for_swap ON users;

-- Allow all authenticated users to see the basic profile info of members 
-- who have put up a schedule swap offer on the public board.
CREATE POLICY users_select_for_swap ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND id IN (
      SELECT requester_id FROM swap_requests WHERE is_penawaran = TRUE
    )
  );
