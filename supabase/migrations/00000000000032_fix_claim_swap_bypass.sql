-- Migration 032: Fix claim_swap_request trusted function bypass
-- Root cause: Migration 029 recreated claim_swap_request but omitted setting
-- app.trusted_fn to true, which is checked by trg_swap_no_self_approve to bypass
-- standard member checks when updating swap status and pengganti_id.

CREATE OR REPLACE FUNCTION claim_swap_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_req     swap_requests%ROWTYPE;
  v_uid     UUID := auth.uid();
  v_claimer RECORD;T
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- Claimer must be Active and not suspended
  SELECT status, is_suspended INTO v_claimer FROM users WHERE id = v_uid LIMIT 1;
  IF NOT FOUND OR v_claimer.status::TEXT <> 'Active' OR v_claimer.is_suspended THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'CLAIMER_NOT_ELIGIBLE',
      'message', 'Hanya anggota aktif yang dapat mengambil jadwal penawaran'
    );
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

  -- Set bypass flag for trigger trg_swap_no_self_approve
  PERFORM set_config('app.trusted_fn', 'true', true);

  UPDATE swap_requests
  SET status = 'Replaced', pengganti_id = v_uid
  WHERE id = p_request_id;

  UPDATE assignments
  SET user_id = v_uid
  WHERE id = v_req.assignment_id;

  -- Reset bypass flag
  PERFORM set_config('app.trusted_fn', 'false', true);

  RETURN jsonb_build_object('ok', true);
END;
$func$;

GRANT EXECUTE ON FUNCTION claim_swap_request(UUID) TO authenticated;
