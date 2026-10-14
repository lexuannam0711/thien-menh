# Thần Mệnh Online — M1 Database Runbook & Schema Contract

> **Target:** `supabase/migrations/20261014000000_m1_profiles_and_characters.sql`
> **Status:** Static Analysis Verified (`scripts/check-m1-schema.cjs` PASS).
> **Remote Status:** `remote-application-unverified` (No live Supabase connection or service-role credentials present).

---

## 1. Overview & M1 Database Contract

Milestone M1 establishes the persistent database schema for account, profile, and initial character creation using Supabase PostgreSQL.

### Core Architecture & Authority Boundaries
- **Client (Phaser H5):** Can query and update its own profile (`display_name`, `avatar_url`) and update its own character metadata (`name`).
- **Server-Owned Fields:** Gameplay attributes (`level`, `xp`, `gold`, `chapter`, `kills`, `checkpoint`, `playtime_seconds`) are client-immutable. Clients cannot modify or forge initial stats; only the authoritative game server (`service_role`) can mutate gameplay state.
- **Single Character Constraint:** In M1, each user account owns at most 1 active character (`CONSTRAINT uq_user_character UNIQUE (user_id)`).

---

## 2. Schema Structure & Security Architecture

### Tables
1. **`public.profiles`:**
   - `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
   - `display_name TEXT UNIQUE NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 3 AND 24)`
   - `avatar_url TEXT`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

2. **`public.characters`:**
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
   - `name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 20)`
   - `level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 99)`
   - `xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0)`
   - `gold INT NOT NULL DEFAULT 0 CHECK (gold >= 0)`
   - `chapter INT NOT NULL DEFAULT 1 CHECK (chapter BETWEEN 1 AND 4)`
   - `kills INT NOT NULL DEFAULT 0 CHECK (kills >= 0)`
   - `checkpoint TEXT NOT NULL DEFAULT 'village-gate' CHECK (char_length(trim(checkpoint)) > 0)`
   - `playtime_seconds INT NOT NULL DEFAULT 0 CHECK (playtime_seconds >= 0)`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `CONSTRAINT uq_user_character UNIQUE (user_id)`

### Triggers & Security Guards
- **`set_profiles_updated_at` / `set_characters_updated_at`:** Updates `updated_at = now()` before update.
- **`trg_enforce_character_client_immutability`:** Prevents authenticated clients from modifying `level`, `xp`, `gold`, `chapter`, `kills`, `checkpoint`, `playtime_seconds`, or immutable primary/foreign keys (`id`, `user_id`, `created_at`).
- **`trg_enforce_character_initial_defaults`:** Blocks client requests that attempt to initialize a character with altered stats (e.g., non-zero gold or level > 1).
- **`trg_enforce_profile_immutability`:** Protects `id` and `created_at` on profile updates.
- **`on_auth_user_created`:** Trigger on `auth.users` to provision a default profile row upon user signup.

### Row Level Security (RLS) & Column Grants
- `REVOKE ALL ON public.profiles, public.characters FROM anon;` (Anon has zero table access).
- `GRANT SELECT ON public.profiles, public.characters TO authenticated;`
- `GRANT INSERT (id, display_name, avatar_url) ON public.profiles TO authenticated;`
- `GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;`
- `GRANT INSERT (user_id, name) ON public.characters TO authenticated;`
- `GRANT UPDATE (name) ON public.characters TO authenticated;`
- `GRANT ALL ON public.profiles, public.characters TO service_role;` (Authoritative server access).

### RLS Policies
- `Users can select own profile`: `USING (auth.uid() = id)`
- `Users can insert own profile`: `WITH CHECK (auth.uid() = id)`
- `Users can update own profile`: `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`
- `Users can select own character`: `USING (auth.uid() = user_id)`
- `Users can insert own character`: `WITH CHECK (auth.uid() = user_id)`
- `Users can update own character metadata`: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- All policies strictly evaluate `auth.uid()` and reject cross-user access. DELETE operations are denied by default.

---

## 3. Required Environment Variables

> **CRITICAL SECURITY REQUIREMENT:** Never commit credentials or expose private keys to client builds or version control. Store only variable names in documentation and `.env.example`.

### Frontend / Web Client (`.env.local`)
- `VITE_SUPABASE_URL`: Public Supabase API project endpoint.
- `VITE_SUPABASE_ANON_KEY`: Public anonymous API key (subject to strict RLS).

### Game Server / Authoritative Backend (`server/.env`)
- `SUPABASE_URL`: Supabase project endpoint.
- `SUPABASE_SERVICE_ROLE_KEY`: Privileged backend secret key (bypasses RLS for authoritative game writes).
- `DATABASE_URL`: Direct PostgreSQL connection string (pooled or direct, server-side only).

---

## 4. Application Runbook

### A. Local Development (Supabase CLI)
1. Initialize local Supabase if not already running:
   ```bash
   npx supabase start
   ```
2. Apply migration locally:
   ```bash
   npx supabase migration up
   # OR reset local database applying all migrations cleanly:
   npx supabase db reset
   ```
3. Run static check script to verify migration consistency:
   ```bash
   node scripts/check-m1-schema.cjs
   ```

### B. Remote Staging / Production Application
1. **Prerequisite:** Ensure full backup of existing remote database before applying migrations.
2. Link the remote project via Supabase CLI:
   ```bash
   npx supabase link --project-ref <PROJECT_REF>
   ```
3. Push migrations to remote instance:
   ```bash
   npx supabase db push
   ```
   *Alternative:* Open the Supabase Dashboard, navigate to **SQL Editor**, paste the contents of `supabase/migrations/20261014000000_m1_profiles_and_characters.sql`, and execute.
4. Verify remote schema using the verification queries listed below.

---

## 5. Verification & Test Matrix (Positive & Negative Tests)

### Positive Tests (Expected to Succeed)
1. **User Profile Creation & Selection:**
   - Authenticated user `A` (`auth.uid() = '00000000-0000-0000-0000-000000000001'`) inserts `profiles (id, display_name)` -> **Success**.
   - User `A` selects `FROM public.profiles` -> Returns user `A`'s profile row.
2. **Character Creation with Default Stats:**
   - User `A` inserts `characters (user_id, name)` -> **Success**. Defaults applied: `level = 1`, `xp = 0`, `gold = 0`, `chapter = 1`, `checkpoint = 'village-gate'`.
3. **Character Metadata Update:**
   - User `A` updates `characters SET name = 'MoiTen'` where `user_id = auth.uid()` -> **Success**. `updated_at` automatically updates.
4. **Authoritative Server Mutation:**
   - Backend using `service_role` updates `characters SET gold = 500, level = 2 WHERE id = ...` -> **Success**.

### Negative Tests (Expected to Fail / Denied)
1. **Cross-User Profile Read:**
   - User `A` executes `SELECT * FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'` (User `B`) -> **Returns 0 rows** (RLS isolation).
2. **Cross-User Profile Mutation:**
   - User `A` attempts `UPDATE public.profiles SET display_name = 'Hacked' WHERE id = '...'` (User `B`) -> **0 rows updated / access denied**.
3. **Cross-User Character Access:**
   - User `A` attempts `SELECT` or `UPDATE` on User `B`'s character -> **Returns 0 rows / access denied**.
4. **Anonymous (Unauthenticated) Access:**
   - Client with `anon` key queries `public.profiles` or `public.characters` -> **Denied (0 rows / permission denied)**.
5. **Client Tampering on Character Update:**
   - User `A` attempts `UPDATE public.characters SET gold = 999999 WHERE user_id = auth.uid()` -> **Permission denied for column gold** and blocked by `trg_enforce_character_client_immutability`.
6. **Client Tampering on Character Insert:**
   - User `A` attempts `INSERT INTO public.characters (user_id, name, gold) VALUES (..., 99999)` -> **Permission denied for column gold** and blocked by `trg_enforce_character_initial_defaults`.
7. **Multiple Characters Violation:**
   - User `A` attempts to insert a second character -> **Fails with `uq_user_character` unique constraint violation**.
8. **Client Character Deletion:**
   - User `A` attempts `DELETE FROM public.characters WHERE user_id = auth.uid()` -> **Denied (0 rows affected / no policy granted)**.

---

## 6. Backup & Rollback Warning

> **WARNING:**
> - Do NOT run destructive DDL (`DROP TABLE`, `TRUNCATE`, `CASCADE`) on production databases with live user data.
> - Before applying migrations in staging or production, create a point-in-time recovery (PITR) backup or export a full database dump (`supabase db dump`).
> - In case of rollback in a development or staging environment:
>   ```sql
>   -- Development rollback only:
>   DROP TABLE IF EXISTS public.characters CASCADE;
>   DROP TABLE IF EXISTS public.profiles CASCADE;
>   DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
>   DROP FUNCTION IF EXISTS public.enforce_profile_immutability() CASCADE;
>   DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
>   DROP FUNCTION IF EXISTS public.enforce_character_initial_defaults() CASCADE;
>   DROP FUNCTION IF EXISTS public.enforce_character_client_immutability() CASCADE;
>   ```

---

## 7. Exact Unverified Limits

- **Static Analysis Only:** The SQL migration and constraints have been verified deterministically using `node scripts/check-m1-schema.cjs`.
- **Remote Application Unverified:** No live Supabase connection, remote project URL, or credentials were provided or used in this task. Remote database application status is strictly **`remote-application-unverified`**.
- **No Client Runtime Changes:** Per M1 database contract scope, `package.json`, `src/**`, and runtime game client files remain untouched. Full runtime integration of Supabase client occurs in subsequent milestones.
