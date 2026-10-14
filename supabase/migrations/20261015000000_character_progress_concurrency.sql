-- Replace the unconditional writer with an owner- and version-checked transaction.
REVOKE ALL ON FUNCTION public.save_character_progress(UUID, INT, INT, INT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_character_progress(
  p_user_id UUID,
  p_character_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_level INT,
  p_xp INT,
  p_gold INT,
  p_checkpoint TEXT,
  p_inventory JSONB,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_character public.characters%ROWTYPE;
  v_existing public.character_progress_outbox%ROWTYPE;
  v_payload JSONB;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Authoritative server role required';
  END IF;
  IF p_idempotency_key IS NULL OR char_length(trim(p_idempotency_key)) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid idempotency key';
  END IF;
  IF jsonb_typeof(p_inventory) <> 'array' THEN
    RAISE EXCEPTION 'Inventory must be a JSON array';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trim(p_idempotency_key), 0));
  SELECT * INTO v_character FROM public.characters
  WHERE id = p_character_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
  SELECT * INTO v_existing FROM public.character_progress_outbox
  WHERE idempotency_key = trim(p_idempotency_key) FOR UPDATE;
  IF FOUND THEN
    IF v_existing.character_id <> p_character_id THEN
      RAISE EXCEPTION 'Idempotency key belongs to another character';
    END IF;
    RETURN jsonb_build_object('applied', false, 'progress', jsonb_build_object(
      'id', v_character.id, 'level', v_character.level, 'xp', v_character.xp,
      'gold', v_character.gold, 'checkpoint', v_character.checkpoint, 'inventory', v_character.inventory,
      'updated_at', v_character.updated_at
    ));
  END IF;

  IF v_character.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Stale character progress';
  END IF;

  UPDATE public.characters SET level = p_level, xp = p_xp, gold = p_gold,
    checkpoint = p_checkpoint, inventory = p_inventory, updated_at = now()
  WHERE id = p_character_id AND user_id = p_user_id RETURNING * INTO v_character;

  v_payload := jsonb_build_object('level', p_level, 'xp', p_xp, 'gold', p_gold,
    'checkpoint', p_checkpoint, 'inventory', p_inventory);
  INSERT INTO public.character_progress_outbox(character_id, idempotency_key, payload)
  VALUES (p_character_id, trim(p_idempotency_key), v_payload);

  RETURN jsonb_build_object('applied', true, 'progress', jsonb_build_object(
    'id', v_character.id, 'level', v_character.level, 'xp', v_character.xp,
    'gold', v_character.gold, 'checkpoint', v_character.checkpoint, 'inventory', v_character.inventory,
    'updated_at', v_character.updated_at
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.save_character_progress(UUID, UUID, TIMESTAMPTZ, INT, INT, INT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_character_progress(UUID, UUID, TIMESTAMPTZ, INT, INT, INT, TEXT, JSONB, TEXT) TO service_role;
