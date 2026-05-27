-- Migration 016: claim_swap_request function + swap DELETE policy

-- SECURITY DEFINER function so Misdinar_Aktif can claim board swaps.
-- Without this, assignments UPDATE is blocked by RLS (assign_write = Admin/Pengurus only).
CREATE OR REPLACE FUNCTION claim_swap_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_req   swap_requests%ROWTYPE;
  v_uid   UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_req FROM swap_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_req.status <> 'Offered' OR v_req.is_penawaran = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_OFFERED');
  END IF;

  IF v_req.requester_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CANNOT_CLAIM_OWN');
  END IF;

  UPDATE swap_requests
  SET status = 'Replaced', pengganti_id = v_uid
  WHERE id = p_request_id;

  UPDATE assignments
  SET user_id = v_uid
  WHERE id = v_req.assignment_id;

  RETURN jsonb_build_object('ok', true);
END;
$func$;

GRANT EXECUTE ON FUNCTION claim_swap_request(UUID) TO authenticated;

-- Admin wrapper to recalculate rekap (update_rekap_poin is revoked from authenticated)
CREATE OR REPLACE FUNCTION admin_recalc_rekap()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_role TEXT; v_result JSONB;
BEGIN
  SELECT role::TEXT INTO v_role FROM users WHERE id = auth.uid();
  IF v_role <> 'Administrator' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  SELECT row_to_json(r)::JSONB INTO v_result FROM update_rekap_poin() r;
  RETURN jsonb_build_object('ok', true, 'processed', v_result->>'processed');
END;
$func$;
GRANT EXECUTE ON FUNCTION admin_recalc_rekap() TO authenticated;

-- Allow pengurus and requester to delete swap requests
CREATE POLICY swap_delete ON swap_requests FOR DELETE
  USING (
    get_current_user_role() IN ('Administrator', 'Pengurus')
    OR auth.uid() = requester_id
  );
