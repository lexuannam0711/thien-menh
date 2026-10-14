-- M5 character progress persistence: server-authoritative progress and idempotent writes.
-- Depends on M1 public.characters. Reward writes use one SECURITY DEFINER function transaction.
-- Ownership remains public.characters.user_id REFERENCES auth.users(id); RLS stays owner-scoped from M1.

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Explicit progress invariants (M1-compatible names make static intent reviewable).
ALTER TABLE public.characters
  ADD CONSTRAINT characters_progress_level_check CHECK (level BETWEEN 1 AND 99);
ALTER TABLE public.characters
  ADD CONSTRAINT characters_progress_xp_check CHECK (xp >= 0);
ALTER TABLE public.characters
  ADD CONSTRAINT characters_progress_gold_check CHECK (gold >= 0);
ALTER TABLE public.characters
  ADD CONSTRAINT characters_progress_checkpoint_check CHECK (char_length(trim(checkpoint)) > 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.characters'::regclass AND conname = 'characters_inventory_array_check'
  ) THEN
    ALTER TABLE public.characters
      ADD CONSTRAINT characters_inventory_array_check CHECK (jsonb_typeof(inventory) = 'array');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.character_progress_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (char_length(trim(idempotency_key)) BETWEEN 1 AND 128),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_character_progress_outbox_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_character_progress_outbox_character
  ON public.character_progress_outbox(character_id);

CREATE OR REPLACE FUNCTION public.enforce_character_progress_server_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF TG_OP = 'INSERT' AND NEW.inventory <> '[]'::jsonb THEN
      RAISE EXCEPTION 'Client cannot initialize server-owned inventory';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.level IS DISTINCT FROM OLD.level OR NEW.xp IS DISTINCT FROM OLD.xp OR
      NEW.gold IS DISTINCT FROM OLD.gold OR NEW.checkpoint IS DISTINCT FROM OLD.checkpoint OR
      NEW.inventory IS DISTINCT FROM OLD.inventory
    ) THEN
      RAISE EXCEPTION 'Client cannot modify server-owned character progress';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_character_progress_server_fields ON public.characters;
CREATE TRIGGER trg_enforce_character_progress_server_fields
BEFORE INSERT OR UPDATE ON public.characters
FOR EACH ROW EXECUTE FUNCTION public.enforce_character_progress_server_fields();

REVOKE UPDATE (level, xp, gold, checkpoint, inventory) ON public.characters FROM anon, authenticated;
REVOKE ALL ON public.character_progress_outbox FROM anon, authenticated;
GRANT ALL ON public.character_progress_outbox TO service_role;
ALTER TABLE public.character_progress_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.save_character_progress(
  p_character_id UUID,
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
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Authoritative server role required';
  END IF;
  IF p_idempotency_key IS NULL OR char_length(trim(p_idempotency_key)) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid idempotency key';
  END IF;
  IF jsonb_typeof(p_inventory) <> 'array' THEN
    RAISE EXCEPTION 'Inventory must be a JSON array';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(trim(p_idempotency_key), 0));
  SELECT * INTO v_existing FROM public.character_progress_outbox
  WHERE idempotency_key = trim(p_idempotency_key) FOR UPDATE;
  IF FOUND THEN
    IF v_existing.character_id <> p_character_id THEN
      RAISE EXCEPTION 'Idempotency key belongs to another character';
    END IF;
    SELECT * INTO v_character FROM public.characters WHERE id = p_character_id;
    RETURN jsonb_build_object('applied', false, 'progress', jsonb_build_object(
      'id', v_character.id, 'level', v_character.level, 'xp', v_character.xp,
      'gold', v_character.gold, 'checkpoint', v_character.checkpoint, 'inventory', v_character.inventory,
      'updated_at', v_character.updated_at
    ));
  END IF;

  UPDATE public.characters SET level = p_level, xp = p_xp, gold = p_gold,
    checkpoint = p_checkpoint, inventory = p_inventory, updated_at = now()
  WHERE id = p_character_id RETURNING * INTO v_character;
  IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;

  v_payload := jsonb_build_object('level', p_level, 'xp', p_xp, 'gold', p_gold,
    'checkpoint', p_checkpoint, 'inventory', p_inventory);
  INSERT INTO public.character_progress_outbox(character_id, idempotency_key, payload)
  VALUES (p_character_id, trim(p_idempotency_key), v_payload)
  ON CONFLICT (idempotency_key) DO NOTHING;
  -- The advisory transaction lock makes this conflict path deterministic under retries.
  -- Keep the unique constraint as the database-level idempotency backstop.

  RETURN jsonb_build_object('applied', true, 'progress', jsonb_build_object(
    'id', v_character.id, 'level', v_character.level, 'xp', v_character.xp,
    'gold', v_character.gold, 'checkpoint', v_character.checkpoint, 'inventory', v_character.inventory,
    'updated_at', v_character.updated_at
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.save_character_progress(UUID, INT, INT, INT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_character_progress(UUID, INT, INT, INT, TEXT, JSONB, TEXT) TO service_role;
