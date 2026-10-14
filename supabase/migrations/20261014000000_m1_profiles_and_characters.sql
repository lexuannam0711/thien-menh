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
