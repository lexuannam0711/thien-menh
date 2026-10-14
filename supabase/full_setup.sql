-- ============================================================================
-- THẦN MỆNH — SUPABASE FULL DATABASE SCHEMA & MIGRATIONS
-- Chạy script này trong Supabase Dashboard -> SQL Editor để khởi tạo toàn bộ CSDL
-- ============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261014000000_m1_profiles_and_characters.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Migration: M1 Profiles and Characters Schema
-- Purpose: Authenticated account/profile/character creation, updated_at triggers, ownership constraints, indexes, and strict RLS policies.
-- Constraints: Server-owned gameplay fields client-immutable; least-privilege column grants; deny cross-user access.

-- Enable pgcrypto extension for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT UNIQUE NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 3 AND 24),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profile information accessible by the owning authenticated user.';
COMMENT ON COLUMN public.profiles.id IS 'References auth.users.id; primary key ensuring 1 profile per auth user.';
COMMENT ON COLUMN public.profiles.display_name IS 'Unique player display name, trimmed, between 3 and 24 characters.';

-- Index for searching/lookup by display name
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- ============================================================================
-- 2. CHARACTERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 20),
    level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 99),
    xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
    gold INT NOT NULL DEFAULT 0 CHECK (gold >= 0),
    chapter INT NOT NULL DEFAULT 1 CHECK (chapter BETWEEN 1 AND 4),
    kills INT NOT NULL DEFAULT 0 CHECK (kills >= 0),
    checkpoint TEXT NOT NULL DEFAULT 'village-gate' CHECK (char_length(trim(checkpoint)) > 0),
    playtime_seconds INT NOT NULL DEFAULT 0 CHECK (playtime_seconds >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_character UNIQUE (user_id)
);

COMMENT ON TABLE public.characters IS 'Player characters. Client may only modify name; gameplay stats are server-authoritative.';
COMMENT ON COLUMN public.characters.user_id IS 'References auth.users.id; UNIQUE constraint enforces 1 active character per user in M1.';
COMMENT ON COLUMN public.characters.name IS 'Character name, trimmed, 2-20 characters.';
COMMENT ON COLUMN public.characters.level IS 'Server-owned character level (1-99).';
COMMENT ON COLUMN public.characters.xp IS 'Server-owned experience points.';
COMMENT ON COLUMN public.characters.gold IS 'Server-owned in-game gold currency.';
COMMENT ON COLUMN public.characters.chapter IS 'Server-owned story chapter progress (1-4).';
COMMENT ON COLUMN public.characters.kills IS 'Server-owned total enemy kills.';
COMMENT ON COLUMN public.characters.checkpoint IS 'Server-owned last saved checkpoint string.';
COMMENT ON COLUMN public.characters.playtime_seconds IS 'Server-owned tracked gameplay duration in seconds.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON public.characters(name);

-- ============================================================================
-- 3. TIMESTAMP TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_characters_updated_at ON public.characters;
CREATE TRIGGER set_characters_updated_at
BEFORE UPDATE ON public.characters
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. PROFILE IMMUTABILITY & SAFETY GUARDS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_profile_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.id IS DISTINCT FROM OLD.id) THEN
        RAISE EXCEPTION 'Field id is immutable';
    END IF;
    IF (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
        RAISE EXCEPTION 'Field created_at is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_profile_immutability ON public.profiles;
CREATE TRIGGER trg_enforce_profile_immutability
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_immutability();

-- Optional trigger on auth.users for seamless automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
            'HiepSi_' || SUBSTRING(NEW.id::text FROM 1 FOR 8)
        ),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- ============================================================================
-- 5. SERVER-OWNED GAMEPLAY FIELD PROTECTION
-- ============================================================================

-- Guard against client forging non-default gameplay fields during character creation
CREATE OR REPLACE FUNCTION public.enforce_character_initial_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF (auth.role() = 'authenticated') THEN
        IF (NEW.level <> 1 OR
            NEW.xp <> 0 OR
            NEW.gold <> 0 OR
            NEW.chapter <> 1 OR
            NEW.kills <> 0 OR
            NEW.checkpoint <> 'village-gate' OR
            NEW.playtime_seconds <> 0) THEN
            RAISE EXCEPTION 'Client cannot initialize character with non-default gameplay fields';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_character_initial_defaults ON public.characters;
CREATE TRIGGER trg_enforce_character_initial_defaults
BEFORE INSERT ON public.characters
FOR EACH ROW
EXECUTE FUNCTION public.enforce_character_initial_defaults();

-- Guard against client modifying gameplay fields or immutable identifiers
CREATE OR REPLACE FUNCTION public.enforce_character_client_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.id IS DISTINCT FROM OLD.id) THEN
        RAISE EXCEPTION 'Field id is immutable';
    END IF;
    IF (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
        RAISE EXCEPTION 'Field user_id is immutable';
    END IF;
    IF (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
        RAISE EXCEPTION 'Field created_at is immutable';
    END IF;

    -- If updated by an authenticated client, block changes to server-owned fields
    IF (auth.role() = 'authenticated') THEN
        IF (NEW.level IS DISTINCT FROM OLD.level OR
            NEW.xp IS DISTINCT FROM OLD.xp OR
            NEW.gold IS DISTINCT FROM OLD.gold OR
            NEW.chapter IS DISTINCT FROM OLD.chapter OR
            NEW.kills IS DISTINCT FROM OLD.kills OR
            NEW.checkpoint IS DISTINCT FROM OLD.checkpoint OR
            NEW.playtime_seconds IS DISTINCT FROM OLD.playtime_seconds) THEN
            RAISE EXCEPTION 'Client is not authorized to modify server-owned gameplay fields';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_character_client_immutability ON public.characters;
CREATE TRIGGER trg_enforce_character_client_immutability
BEFORE UPDATE ON public.characters
FOR EACH ROW
EXECUTE FUNCTION public.enforce_character_client_immutability();

-- ============================================================================
-- 6. LEAST-PRIVILEGE ROLE PERMISSIONS
-- ============================================================================

-- Deny all access to anonymous users by default
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.characters FROM anon;

-- Grant selective column permissions to authenticated clients
-- 1) profiles: select all columns; insert id, display_name, avatar_url; update display_name, avatar_url
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT (id, display_name, avatar_url) ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;

-- 2) characters: select all columns; insert user_id, name; update name only
REVOKE ALL ON public.characters FROM authenticated;
GRANT SELECT ON public.characters TO authenticated;
GRANT INSERT (user_id, name) ON public.characters TO authenticated;
GRANT UPDATE (name) ON public.characters TO authenticated;

-- Service role has full access for future authoritative server
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.characters TO service_role;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can select own character" ON public.characters;
DROP POLICY IF EXISTS "Users can insert own character" ON public.characters;
DROP POLICY IF EXISTS "Users can update own character metadata" ON public.characters;

-- Profiles policies: strictly own profile
CREATE POLICY "Users can select own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Characters policies: strictly own character
CREATE POLICY "Users can select own character"
ON public.characters FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own character"
ON public.characters FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own character metadata"
ON public.characters FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261014010000_m5_character_progress.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261015000000_character_progress_concurrency.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 20261014100000_minigames_schema_and_rls.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- Migration: NPC Minigames & Gacha Schema, RLS Policies, and Atomic Functions
-- Version: 20261014100000
-- Purpose: Schema for 3 NPC minigames (7321, Lucky Dice, Animal Guess),
--          daily limits, session state machines, action journals, reward ledgers,
--          audit events, strict Row Level Security (RLS), and SECURITY DEFINER
--          atomic procedures for session management and idempotent settlement.
-- ============================================================================

-- Ensure pgcrypto extension exists for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLE DEFINITIONS (8 CORE TABLES)
-- ============================================================================

-- 1.1 minigame_definitions
CREATE TABLE IF NOT EXISTS public.minigame_definitions (
    game_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    rules_version TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    daily_limit INTEGER NOT NULL DEFAULT 3,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.minigame_definitions IS 'Core catalog and configuration for playable NPC minigames.';
COMMENT ON COLUMN public.minigame_definitions.game_id IS 'Unique identifier for the minigame (e.g., 7321, lucky_dice, animal_guess).';
COMMENT ON COLUMN public.minigame_definitions.title IS 'Human-readable Vietnamese display name.';
COMMENT ON COLUMN public.minigame_definitions.rules_version IS 'Semantic version of active game rules.';
COMMENT ON COLUMN public.minigame_definitions.enabled IS 'Feature flag to toggle game availability.';
COMMENT ON COLUMN public.minigame_definitions.daily_limit IS 'Maximum allowed attempts per player per calendar day.';

-- 1.2 minigame_npcs
CREATE TABLE IF NOT EXISTS public.minigame_npcs (
    npc_id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES public.minigame_definitions(game_id) ON DELETE CASCADE,
    world_map TEXT NOT NULL,
    spawn_point JSONB NOT NULL,
    unlock_condition JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.minigame_npcs IS 'World placement and registry linking NPCs to specific minigames.';
COMMENT ON COLUMN public.minigame_npcs.npc_id IS 'Unique NPC identifier string (e.g., thay-the-lac, lao-dong-xuc, nang-hoa-linh).';
COMMENT ON COLUMN public.minigame_npcs.game_id IS 'Foreign key referencing minigame_definitions(game_id).';
COMMENT ON COLUMN public.minigame_npcs.world_map IS 'Map/Zone identifier where NPC resides.';
COMMENT ON COLUMN public.minigame_npcs.spawn_point IS 'JSON coordinates {x, y, name, direction} for NPC placement.';
COMMENT ON COLUMN public.minigame_npcs.unlock_condition IS 'Requirements (level, quest) to interact with minigame.';

-- 1.3 minigame_daily_usage
CREATE TABLE IF NOT EXISTS public.minigame_daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    game_id TEXT NOT NULL REFERENCES public.minigame_definitions(game_id) ON DELETE CASCADE,
    local_date DATE NOT NULL,
    plays_used INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_minigame_daily_usage UNIQUE (user_id, game_id, local_date)
);

COMMENT ON TABLE public.minigame_daily_usage IS 'Tracks daily attempt consumption per user per minigame (VN timezone date).';
COMMENT ON COLUMN public.minigame_daily_usage.user_id IS 'Authenticated player user UUID.';
COMMENT ON COLUMN public.minigame_daily_usage.local_date IS 'Local date (Asia/Ho_Chi_Minh) determining the daily reset boundary.';
COMMENT ON COLUMN public.minigame_daily_usage.plays_used IS 'Counter of plays consumed today.';

-- 1.4 minigame_sessions
CREATE TABLE IF NOT EXISTS public.minigame_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    character_id TEXT NOT NULL,
    game_id TEXT NOT NULL REFERENCES public.minigame_definitions(game_id) ON DELETE CASCADE,
    rules_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('created', 'active', 'resolved', 'rewarded', 'cancelled', 'expired')),
    public_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    secret_state_ref TEXT,
    attempt_reserved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    result_json JSONB,
    reward_receipt_id TEXT,
    version INTEGER NOT NULL DEFAULT 1
);

COMMENT ON TABLE public.minigame_sessions IS 'Active and historical minigame gameplay sessions.';
COMMENT ON COLUMN public.minigame_sessions.user_id IS 'Authenticated user UUID owning this session.';
COMMENT ON COLUMN public.minigame_sessions.character_id IS 'Active character identifier during the session.';
COMMENT ON COLUMN public.minigame_sessions.status IS 'Lifecycle state: created -> active -> resolved -> rewarded (or cancelled/expired).';
COMMENT ON COLUMN public.minigame_sessions.public_state IS 'Safe public state visible to the player client.';
COMMENT ON COLUMN public.minigame_sessions.secret_state_ref IS 'Internal reference to server-only hidden state (e.g., hidden card deck hash).';
COMMENT ON COLUMN public.minigame_sessions.attempt_reserved IS 'Flag indicating daily quota deduction occurred upon start.';

-- 1.5 minigame_actions
CREATE TABLE IF NOT EXISTS public.minigame_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.minigame_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_minigame_actions UNIQUE (session_id, action_id)
);

COMMENT ON TABLE public.minigame_actions IS 'Idempotent action log preventing replay attacks and duplicate submissions.';
COMMENT ON COLUMN public.minigame_actions.action_id IS 'Client/Server idempotency key for this specific action step.';
COMMENT ON COLUMN public.minigame_actions.payload_hash IS 'Cryptographic digest or serialized representation of action payload.';

-- 1.6 minigame_reward_ledger
CREATE TABLE IF NOT EXISTS public.minigame_reward_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.minigame_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    character_id TEXT NOT NULL,
    reward_type TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_minigame_reward_ledger UNIQUE (session_id, reward_type)
);

COMMENT ON TABLE public.minigame_reward_ledger IS 'Immutable ledger of non-cash in-game rewards disbursed from minigames.';
COMMENT ON COLUMN public.minigame_reward_ledger.reward_type IS 'Virtual token/item type (e.g., festival_points, exp, badge).';
COMMENT ON COLUMN public.minigame_reward_ledger.amount IS 'Quantity disbursed (non-negative).';

-- 1.7 minigame_reward_catalog
CREATE TABLE IF NOT EXISTS public.minigame_reward_catalog (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES public.minigame_definitions(game_id) ON DELETE CASCADE,
    tier TEXT NOT NULL,
    name TEXT NOT NULL,
    festival_points INTEGER NOT NULL DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.minigame_reward_catalog IS 'Transparent payout and reward probability tier configurations.';
COMMENT ON COLUMN public.minigame_reward_catalog.festival_points IS 'In-game virtual festival reward points.';

-- 1.8 minigame_audit_events
CREATE TABLE IF NOT EXISTS public.minigame_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID,
    event_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.minigame_audit_events IS 'Security and anti-cheat event audit trails.';
COMMENT ON COLUMN public.minigame_audit_events.event_type IS 'Event category (e.g., SESSION_STARTED, SESSION_RESOLVED_AND_REWARDED, REPLAY_REJECTED).';

-- ============================================================================
-- 2. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_minigame_npcs_game ON public.minigame_npcs(game_id);
CREATE INDEX IF NOT EXISTS idx_minigame_daily_usage_lookup ON public.minigame_daily_usage(user_id, game_id, local_date);
CREATE INDEX IF NOT EXISTS idx_minigame_sessions_user_game ON public.minigame_sessions(user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_minigame_sessions_status ON public.minigame_sessions(status);
CREATE INDEX IF NOT EXISTS idx_minigame_actions_session ON public.minigame_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_minigame_reward_ledger_user ON public.minigame_reward_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_minigame_reward_ledger_session ON public.minigame_reward_ledger(session_id);
CREATE INDEX IF NOT EXISTS idx_minigame_audit_events_user ON public.minigame_audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_minigame_reward_catalog_game ON public.minigame_reward_catalog(game_id);

-- ============================================================================
-- 3. TIMESTAMP TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_minigames_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_minigame_definitions_updated_at ON public.minigame_definitions;
CREATE TRIGGER set_minigame_definitions_updated_at
BEFORE UPDATE ON public.minigame_definitions
FOR EACH ROW
EXECUTE FUNCTION public.handle_minigames_updated_at();

DROP TRIGGER IF EXISTS set_minigame_daily_usage_updated_at ON public.minigame_daily_usage;
CREATE TRIGGER set_minigame_daily_usage_updated_at
BEFORE UPDATE ON public.minigame_daily_usage
FOR EACH ROW
EXECUTE FUNCTION public.handle_minigames_updated_at();

-- ============================================================================
-- 4. SEED INITIAL DATA
-- ============================================================================

-- 4.1 Seed 3 core minigame definitions
INSERT INTO public.minigame_definitions (game_id, title, rules_version, enabled, daily_limit, config_json)
VALUES
    ('7321', '7321', 'v1.0', true, 3, '{"description": "Trò thẻ bài cổ Văn Lang điểm chuẩn 21", "deck_count": 1, "dealer_stand": 17}'::jsonb),
    ('lucky_dice', 'Xúc Xắc May Mắn', 'v1.0', true, 3, '{"description": "Dự đoán tổng 3 viên xúc xắc Tài / Xỉu", "dice_count": 3, "sides": 6}'::jsonb),
    ('animal_guess', 'Nhìn Hình Đoán Thú', 'v1.0', true, 3, '{"description": "Dự đoán linh hình Văn Lang (Bầu, Cua, Cá, Cọp, Gà, Nai)", "symbols": ["bau", "cua", "ca", "cop", "ga", "nai"]}'::jsonb)
ON CONFLICT (game_id) DO UPDATE SET
    title = EXCLUDED.title,
    rules_version = EXCLUDED.rules_version,
    enabled = EXCLUDED.enabled,
    daily_limit = EXCLUDED.daily_limit,
    config_json = EXCLUDED.config_json,
    updated_at = now();

-- 4.2 Seed 3 NPCs mapping to minigames
INSERT INTO public.minigame_npcs (npc_id, game_id, world_map, spawn_point, unlock_condition)
VALUES
    ('thay-the-lac', '7321', 'lang_lac_thuy', '{"x": 420, "y": 360, "name": "Thầy Thẻ Lạc"}'::jsonb, '{}'::jsonb),
    ('lao-dong-xuc', 'lucky_dice', 'lang_lac_thuy', '{"x": 680, "y": 410, "name": "Lão Đồng Xúc"}'::jsonb, '{}'::jsonb),
    ('nang-hoa-linh', 'animal_guess', 'lang_lac_thuy', '{"x": 850, "y": 320, "name": "Nàng Họa Linh"}'::jsonb, '{}'::jsonb)
ON CONFLICT (npc_id) DO UPDATE SET
    game_id = EXCLUDED.game_id,
    world_map = EXCLUDED.world_map,
    spawn_point = EXCLUDED.spawn_point,
    unlock_condition = EXCLUDED.unlock_condition;

-- 4.3 Seed transparent reward catalog
INSERT INTO public.minigame_reward_catalog (id, game_id, tier, name, festival_points, config)
VALUES
    ('reward_7321_win', '7321', 'win', 'Thắng 7321', 15, '{"type": "win"}'::jsonb),
    ('reward_7321_draw', '7321', 'draw', 'Hòa 7321', 5, '{"type": "draw"}'::jsonb),
    ('reward_7321_participate', '7321', 'participate', 'Tham Gia 7321', 5, '{"type": "participate"}'::jsonb),
    ('reward_dice_win', 'lucky_dice', 'win', 'Đoán Đúng Tài Xỉu', 10, '{"type": "win"}'::jsonb),
    ('reward_dice_triple', 'lucky_dice', 'special', 'Bộ Ba Đồng Số', 5, '{"type": "special"}'::jsonb),
    ('reward_dice_participate', 'lucky_dice', 'participate', 'Tham Gia Xúc Xắc', 5, '{"type": "participate"}'::jsonb),
    ('reward_animal_match_1', 'animal_guess', 'tier1', 'Trúng 1 Linh Hình', 8, '{"matches": 1}'::jsonb),
    ('reward_animal_match_2', 'animal_guess', 'tier2', 'Trúng 2 Linh Hình', 20, '{"matches": 2}'::jsonb),
    ('reward_animal_match_3', 'animal_guess', 'tier3', 'Trúng 3 Linh Hình', 45, '{"matches": 3}'::jsonb),
    ('reward_animal_participate', 'animal_guess', 'participate', 'Tham Gia Đoán Thú', 5, '{"type": "participate"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    game_id = EXCLUDED.game_id,
    tier = EXCLUDED.tier,
    name = EXCLUDED.name,
    festival_points = EXCLUDED.festival_points,
    config = EXCLUDED.config;

-- ============================================================================
-- 5. LEAST-PRIVILEGE ROLE PERMISSIONS
-- ============================================================================

-- Strip all default public permissions
REVOKE ALL ON public.minigame_definitions FROM anon, authenticated;
REVOKE ALL ON public.minigame_npcs FROM anon, authenticated;
REVOKE ALL ON public.minigame_reward_catalog FROM anon, authenticated;
REVOKE ALL ON public.minigame_daily_usage FROM anon, authenticated;
REVOKE ALL ON public.minigame_sessions FROM anon, authenticated;
REVOKE ALL ON public.minigame_actions FROM anon, authenticated;
REVOKE ALL ON public.minigame_reward_ledger FROM anon, authenticated;
REVOKE ALL ON public.minigame_audit_events FROM anon, authenticated;

-- Service role has full administrative access for authoritative server
GRANT ALL ON public.minigame_definitions TO service_role;
GRANT ALL ON public.minigame_npcs TO service_role;
GRANT ALL ON public.minigame_reward_catalog TO service_role;
GRANT ALL ON public.minigame_daily_usage TO service_role;
GRANT ALL ON public.minigame_sessions TO service_role;
GRANT ALL ON public.minigame_actions TO service_role;
GRANT ALL ON public.minigame_reward_ledger TO service_role;
GRANT ALL ON public.minigame_audit_events TO service_role;

-- Public definitions, NPCs, and rewards catalog are viewable by all (anon + authenticated)
GRANT SELECT ON public.minigame_definitions TO anon, authenticated;
GRANT SELECT ON public.minigame_npcs TO anon, authenticated;
GRANT SELECT ON public.minigame_reward_catalog TO anon, authenticated;

-- User gameplay tables: SELECT-only for authenticated players; clients CANNOT write directly
GRANT SELECT ON public.minigame_daily_usage TO authenticated;
GRANT SELECT ON public.minigame_sessions TO authenticated;
GRANT SELECT ON public.minigame_actions TO authenticated;
GRANT SELECT ON public.minigame_reward_ledger TO authenticated;
GRANT SELECT ON public.minigame_audit_events TO authenticated;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.minigame_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_reward_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_reward_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_audit_events ENABLE ROW LEVEL SECURITY;

-- Clean existing policies for idempotency
DROP POLICY IF EXISTS "Public read minigame_definitions" ON public.minigame_definitions;
DROP POLICY IF EXISTS "Public read minigame_npcs" ON public.minigame_npcs;
DROP POLICY IF EXISTS "Public read minigame_reward_catalog" ON public.minigame_reward_catalog;
DROP POLICY IF EXISTS "Users can select own minigame_daily_usage" ON public.minigame_daily_usage;
DROP POLICY IF EXISTS "Users can select own minigame_sessions" ON public.minigame_sessions;
DROP POLICY IF EXISTS "Users can select own minigame_actions" ON public.minigame_actions;
DROP POLICY IF EXISTS "Users can select own minigame_reward_ledger" ON public.minigame_reward_ledger;
DROP POLICY IF EXISTS "Users can select own minigame_audit_events" ON public.minigame_audit_events;

-- 6.1 Public read-only catalog policies
CREATE POLICY "Public read minigame_definitions"
ON public.minigame_definitions FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public read minigame_npcs"
ON public.minigame_npcs FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public read minigame_reward_catalog"
ON public.minigame_reward_catalog FOR SELECT
TO anon, authenticated
USING (true);

-- 6.2 Strict user ownership policies (SELECT only for own records)
CREATE POLICY "Users can select own minigame_daily_usage"
ON public.minigame_daily_usage FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can select own minigame_sessions"
ON public.minigame_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can select own minigame_actions"
ON public.minigame_actions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can select own minigame_reward_ledger"
ON public.minigame_reward_ledger FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can select own minigame_audit_events"
ON public.minigame_audit_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- 7. ATOMIC DATABASE FUNCTIONS (SECURITY DEFINER)
-- ============================================================================

-- 7.1 start_session: Atomically checks daily limits, reserves quota, and initializes active session
CREATE OR REPLACE FUNCTION public.start_session(
    p_character_id TEXT,
    p_game_id TEXT,
    p_rules_version TEXT DEFAULT 'v1.0',
    p_public_state JSONB DEFAULT '{}'::jsonb,
    p_secret_state_ref TEXT DEFAULT NULL,
    p_local_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
    p_expires_in_seconds INT DEFAULT 300,
    p_override_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_daily_limit INT;
    v_rules_version TEXT;
    v_enabled BOOLEAN;
    v_plays_used INT;
    v_session_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Determine user: authenticated role uses auth.uid(); service_role may specify override
    IF auth.role() = 'service_role' OR auth.role() IS NULL THEN
        v_user_id := COALESCE(p_override_user_id, auth.uid());
    ELSE
        v_user_id := auth.uid();
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: user ID cannot be determined';
    END IF;

    -- Validate game definition
    SELECT enabled, daily_limit, rules_version
    INTO v_enabled, v_daily_limit, v_rules_version
    FROM public.minigame_definitions
    WHERE game_id = p_game_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Minigame % not found', p_game_id;
    END IF;

    IF NOT v_enabled THEN
        RAISE EXCEPTION 'Minigame % is currently disabled', p_game_id;
    END IF;

    -- Upsert daily usage row and lock for atomic update
    INSERT INTO public.minigame_daily_usage (user_id, game_id, local_date, plays_used, updated_at)
    VALUES (v_user_id, p_game_id, p_local_date, 0, now())
    ON CONFLICT (user_id, game_id, local_date) DO NOTHING;

    SELECT plays_used INTO v_plays_used
    FROM public.minigame_daily_usage
    WHERE user_id = v_user_id AND game_id = p_game_id AND local_date = p_local_date
    FOR UPDATE;

    IF v_plays_used >= v_daily_limit THEN
        RAISE EXCEPTION 'Daily play limit of % reached for game % on %', v_daily_limit, p_game_id, p_local_date;
    END IF;

    -- Atomically increment usage
    UPDATE public.minigame_daily_usage
    SET plays_used = plays_used + 1,
        updated_at = now()
    WHERE user_id = v_user_id AND game_id = p_game_id AND local_date = p_local_date;

    v_expires_at := now() + (COALESCE(p_expires_in_seconds, 300) || ' seconds')::interval;

    -- Create game session
    INSERT INTO public.minigame_sessions (
        user_id,
        character_id,
        game_id,
        rules_version,
        status,
        public_state,
        secret_state_ref,
        attempt_reserved,
        created_at,
        expires_at,
        version
    )
    VALUES (
        v_user_id,
        p_character_id,
        p_game_id,
        COALESCE(p_rules_version, v_rules_version),
        'active',
        p_public_state,
        p_secret_state_ref,
        true,
        now(),
        v_expires_at,
        1
    )
    RETURNING id INTO v_session_id;

    -- Log audit event
    INSERT INTO public.minigame_audit_events (
        user_id,
        session_id,
        event_type,
        metadata
    )
    VALUES (
        v_user_id,
        v_session_id,
        'SESSION_STARTED',
        jsonb_build_object(
            'game_id', p_game_id,
            'character_id', p_character_id,
            'local_date', p_local_date,
            'plays_used', v_plays_used + 1,
            'remaining_plays', v_daily_limit - (v_plays_used + 1)
        )
    );

    RETURN jsonb_build_object(
        'session_id', v_session_id,
        'game_id', p_game_id,
        'status', 'active',
        'remaining_plays', v_daily_limit - (v_plays_used + 1),
        'expires_at', v_expires_at
    );
END;
$$;

-- 7.2 resolve_and_reward: Atomically locks session, checks idempotency, resolves result and disburses rewards
CREATE OR REPLACE FUNCTION public.resolve_and_reward(
    p_session_id UUID,
    p_result_json JSONB,
    p_reward_receipt_id TEXT DEFAULT NULL,
    p_rewards JSONB DEFAULT '[]'::jsonb,
    p_public_state JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_receipt_id TEXT;
    r RECORD;
    v_reward_count INT := 0;
BEGIN
    -- Strict authorization: only authoritative backend (service_role or elevated) may disburse rewards
    IF auth.role() = 'authenticated' THEN
        RAISE EXCEPTION 'Client is not authorized to resolve sessions directly';
    END IF;

    -- Lock session row for update
    SELECT * INTO v_session
    FROM public.minigame_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session % not found', p_session_id;
    END IF;

    -- Idempotency check: if already settled, return existing result without duplicate rewards
    IF v_session.status = 'rewarded' THEN
        RETURN jsonb_build_object(
            'session_id', v_session.id,
            'status', v_session.status,
            'reward_receipt_id', v_session.reward_receipt_id,
            'result_json', v_session.result_json,
            'resolved_at', v_session.resolved_at,
            'already_resolved', true
        );
    END IF;

    IF v_session.status NOT IN ('active', 'created') THEN
        RAISE EXCEPTION 'Cannot resolve session % with status %', p_session_id, v_session.status;
    END IF;

    v_receipt_id := COALESCE(p_reward_receipt_id, 'rcpt_' || gen_random_uuid()::text);

    -- Mark session as rewarded
    UPDATE public.minigame_sessions
    SET status = 'rewarded',
        resolved_at = now(),
        result_json = p_result_json,
        reward_receipt_id = v_receipt_id,
        public_state = COALESCE(p_public_state, public_state),
        version = version + 1
    WHERE id = p_session_id;

    -- Disburse virtual rewards into ledger
    IF p_rewards IS NOT NULL AND jsonb_array_length(p_rewards) > 0 THEN
        FOR r IN SELECT * FROM jsonb_to_recordset(p_rewards) AS x(reward_type TEXT, amount INT, source TEXT)
        LOOP
            IF r.amount > 0 THEN
                INSERT INTO public.minigame_reward_ledger (
                    session_id,
                    user_id,
                    character_id,
                    reward_type,
                    amount,
                    source,
                    created_at
                )
                VALUES (
                    v_session.id,
                    v_session.user_id,
                    v_session.character_id,
                    r.reward_type,
                    r.amount,
                    COALESCE(r.source, 'minigame_resolve'),
                    now()
                )
                ON CONFLICT (session_id, reward_type) DO NOTHING;

                v_reward_count := v_reward_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- Audit event
    INSERT INTO public.minigame_audit_events (
        user_id,
        session_id,
        event_type,
        metadata
    )
    VALUES (
        v_session.user_id,
        v_session.id,
        'SESSION_RESOLVED_AND_REWARDED',
        jsonb_build_object(
            'receipt_id', v_receipt_id,
            'reward_count', v_reward_count,
            'rewards', p_rewards
        )
    );

    RETURN jsonb_build_object(
        'session_id', v_session.id,
        'status', 'rewarded',
        'reward_receipt_id', v_receipt_id,
        'reward_count', v_reward_count,
        'resolved_at', now(),
        'already_resolved', false
    );
END;
$$;

-- Revoke default public execution privileges
REVOKE ALL ON FUNCTION public.start_session FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_and_reward FROM PUBLIC;

-- Grant execution privileges
GRANT EXECUTE ON FUNCTION public.start_session TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_and_reward TO authenticated, service_role;

