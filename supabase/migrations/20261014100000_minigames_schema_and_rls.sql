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
