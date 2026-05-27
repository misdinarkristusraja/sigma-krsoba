-- Migration 017: Patch swap trigger + offer_to_board SECURITY DEFINER
-- Root cause: trg_swap_no_self_approve checks auth.uid() role on every UPDATE,
-- blocking SECURITY DEFINER functions (auth.uid() still returns JWT caller).
-- Fix: bypass trigger via set_config flag inside trusted functions.

-- 1. Patch trigger to respect bypass flag
CREATE OR REPLACE FUNCTION trg_swap_no_self_approve()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
  IF current_setting('app.trusted_fn', true) = 'true' THEN
    RETURN NEW;
  END IF;
  SELECT role::TEXT INTO v_role FROM public.users WHERE id = auth.uid() LIMIT 1;
  IF v_role NOT IN ('Administrator','Pengurus') THEN
    IF NEW.status       IS DISTINCT FROM OLD.status       THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change swap status directly';
    END IF;
    IF NEW.pengganti_id IS DISTINCT FROM OLD.pengganti_id THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot set pengganti directly';
    END IF;
    IF NEW.pic_user_id  IS DISTINCT FROM OLD.pic_user_id  THEN
      RAISE EXCEPTION 'FORBIDDEN: cannot change pic assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Recreate claim_swap_request with bypass flag
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

  PERFORM set_config('app.trusted_fn', 'true', true);

  UPDATE swap_requests
  SET status = 'Replaced', pengganti_id = v_uid
  WHERE id = p_request_id;

  UPDATE assignments
  SET user_id = v_uid
  WHERE id = v_req.assignment_id;

  PERFORM set_config('app.trusted_fn', 'false', true);

  RETURN jsonb_build_object('ok', true);
END;
$func$;

GRANT EXECUTE ON FUNCTION claim_swap_request(UUID) TO authenticated;

-- 3. New: offer_to_board — requester OR staff can move Approved_PIC → Offered
CREATE OR REPLACE FUNCTION offer_to_board(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_req   swap_requests%ROWTYPE;
  v_uid   UUID := auth.uid();
  v_role  TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT role::TEXT INTO v_role FROM users WHERE id = v_uid;
  SELECT * INTO v_req FROM swap_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_req.requester_id <> v_uid AND v_role NOT IN ('Administrator','Pengurus') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_req.status <> 'Approved_PIC' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_APPROVED_PIC');
  END IF;

  PERFORM set_config('app.trusted_fn', 'true', true);

  UPDATE swap_requests
  SET status = 'Offered', is_penawaran = true
  WHERE id = p_request_id;

  PERFORM set_config('app.trusted_fn', 'false', true);

  RETURN jsonb_build_object('ok', true);
END;
$func$;

GRANT EXECUTE ON FUNCTION offer_to_board(UUID) TO authenticated;
