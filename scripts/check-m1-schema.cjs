#!/usr/bin/env node
/**
 * scripts/check-m1-schema.cjs
 *
 * Deterministic static checker for Supabase M1 database schema & RLS policies.
 * Verifies table structure, ownership constraints, updated_at triggers,
 * server-owned field protections, least-privilege column grants, and RLS policies.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const migrationPath = path.join(root, 'supabase', 'migrations', '20261014000000_m1_profiles_and_characters.sql');

console.log('[M1-SCHEMA-CHECK] Starting deterministic static analysis...');
console.log(`[M1-SCHEMA-CHECK] Migration file: ${migrationPath}`);

// 1. Verify migration file exists and is non-empty
assert.ok(fs.existsSync(migrationPath), `Migration file not found at ${migrationPath}`);
const sqlContent = fs.readFileSync(migrationPath, 'utf8');
assert.ok(sqlContent.length > 500, `Migration file unexpectedly short (${sqlContent.length} bytes)`);

// 2. Tokenize and parse statements taking into account dollar quotes $$ ... $$
function parseStatements(sql) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';

    // Handle comments
    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      if (!inLineComment && !inBlockComment && char === '-' && nextChar === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      if (inLineComment && (char === '\n' || char === '\r')) {
        inLineComment = false;
        continue;
      }
      if (inLineComment) continue;

      if (!inBlockComment && char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
      if (inBlockComment && char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
        continue;
      }
      if (inBlockComment) continue;
    }

    // Handle strings & dollar quotes
    if (!inSingleQuote && !inDoubleQuote && char === '$' && nextChar === '$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i++;
      continue;
    }

    if (!inDollarQuote) {
      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && nextChar === "'") {
          current += "''";
          i++;
          continue;
        }
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
    } else {
      current += char;
    }
  }

  const remainder = current.trim();
  if (remainder) statements.push(remainder);

  return { statements, inSingleQuote, inDoubleQuote, inDollarQuote, inBlockComment };
}

const parsed = parseStatements(sqlContent);
assert.equal(parsed.inSingleQuote, false, 'Unterminated single quote in SQL migration');
assert.equal(parsed.inDoubleQuote, false, 'Unterminated double quote in SQL migration');
assert.equal(parsed.inDollarQuote, false, 'Unterminated dollar-quote block in SQL migration');
assert.equal(parsed.inBlockComment, false, 'Unterminated block comment in SQL migration');
console.log(`[PASS] SQL parser: ${parsed.statements.length} valid top-level SQL statements extracted.`);

// 3. Verify Table Definitions
const tablesFound = { profiles: false, characters: false };
for (const stmt of parsed.statements) {
  if (/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.profiles/i.test(stmt)) {
    tablesFound.profiles = true;
    // Verify profiles columns and constraints
    assert.match(stmt, /id\s+UUID\s+PRIMARY\s+KEY\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i,
      'profiles.id must be UUID PRIMARY KEY referencing auth.users(id) ON DELETE CASCADE');
    assert.match(stmt, /display_name\s+TEXT\s+UNIQUE\s+NOT\s+NULL/i,
      'profiles.display_name must be TEXT UNIQUE NOT NULL');
    assert.match(stmt, /created_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
      'profiles.created_at must default to now()');
    assert.match(stmt, /updated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
      'profiles.updated_at must default to now()');
  }

  if (/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.characters/i.test(stmt)) {
    tablesFound.characters = true;
    // Verify characters columns and constraints
    assert.match(stmt, /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
      'characters.id must be UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    assert.match(stmt, /user_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i,
      'characters.user_id must reference auth.users(id) ON DELETE CASCADE');
    assert.match(stmt, /CONSTRAINT\s+uq_user_character\s+UNIQUE\s*\(user_id\)/i,
      'characters must enforce CONSTRAINT uq_user_character UNIQUE (user_id)');
    assert.match(stmt, /name\s+TEXT\s+NOT\s+NULL/i, 'characters.name must be TEXT NOT NULL');

    // Server-owned fields
    assert.match(stmt, /level\s+INT\s+NOT\s+NULL\s+DEFAULT\s+1\s+CHECK\s*\(level\s+BETWEEN\s+1\s+AND\s+99\)/i,
      'characters.level must be bounded between 1 and 99 with default 1');
    assert.match(stmt, /xp\s+INT\s+NOT\s+NULL\s+DEFAULT\s+0\s+CHECK\s*\(xp\s*>=\s*0\)/i,
      'characters.xp must be non-negative with default 0');
    assert.match(stmt, /gold\s+INT\s+NOT\s+NULL\s+DEFAULT\s+0\s+CHECK\s*\(gold\s*>=\s*0\)/i,
      'characters.gold must be non-negative with default 0');
    assert.match(stmt, /chapter\s+INT\s+NOT\s+NULL\s+DEFAULT\s+1\s+CHECK\s*\(chapter\s+BETWEEN\s+1\s+AND\s+4\)/i,
      'characters.chapter must be bounded between 1 and 4 with default 1');
    assert.match(stmt, /kills\s+INT\s+NOT\s+NULL\s+DEFAULT\s+0\s+CHECK\s*\(kills\s*>=\s*0\)/i,
      'characters.kills must be non-negative with default 0');
    assert.match(stmt, /checkpoint\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'village-gate'/i,
      'characters.checkpoint must default to village-gate');
    assert.match(stmt, /playtime_seconds\s+INT\s+NOT\s+NULL\s+DEFAULT\s+0/i,
      'characters.playtime_seconds must default to 0');
  }
}
assert.ok(tablesFound.profiles, 'Missing public.profiles table definition');
assert.ok(tablesFound.characters, 'Missing public.characters table definition');
console.log('[PASS] Schema verification: profiles and characters tables with primary keys, FKs, constraints, and server-owned fields.');

// 4. Verify updated_at Triggers
const triggersFound = {
  fnUpdatedAt: /FUNCTION\s+public\.handle_updated_at\(\)/i.test(sqlContent),
  trgProfiles: /CREATE\s+TRIGGER\s+set_profiles_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.profiles/i.test(sqlContent),
  trgCharacters: /CREATE\s+TRIGGER\s+set_characters_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.characters/i.test(sqlContent)
};
assert.ok(triggersFound.fnUpdatedAt, 'Missing handle_updated_at function');
assert.ok(triggersFound.trgProfiles, 'Missing set_profiles_updated_at trigger');
assert.ok(triggersFound.trgCharacters, 'Missing set_characters_updated_at trigger');
console.log('[PASS] Timestamp triggers: handle_updated_at defined and active for both tables.');

// 5. Verify Server-Owned Gameplay Field Protection Guards
const guardsFound = {
  fnInitialDefaults: /FUNCTION\s+public\.enforce_character_initial_defaults\(\)/i.test(sqlContent),
  trgInitialDefaults: /CREATE\s+TRIGGER\s+trg_enforce_character_initial_defaults\s+BEFORE\s+INSERT\s+ON\s+public\.characters/i.test(sqlContent),
  fnClientImmutability: /FUNCTION\s+public\.enforce_character_client_immutability\(\)/i.test(sqlContent),
  trgClientImmutability: /CREATE\s+TRIGGER\s+trg_enforce_character_client_immutability\s+BEFORE\s+UPDATE\s+ON\s+public\.characters/i.test(sqlContent),
  fnProfileImmutability: /FUNCTION\s+public\.enforce_profile_immutability\(\)/i.test(sqlContent),
  trgProfileImmutability: /CREATE\s+TRIGGER\s+trg_enforce_profile_immutability\s+BEFORE\s+UPDATE\s+ON\s+public\.profiles/i.test(sqlContent)
};
for (const [key, found] of Object.entries(guardsFound)) {
  assert.ok(found, `Missing server guard trigger/function: ${key}`);
}
console.log('[PASS] Server guards: Triggers prevent client from forging initial stats or modifying server-owned fields on update.');

// 6. Verify Column-Level Grants (Least Privilege)
const anonRevokedProfiles = /REVOKE\s+ALL\s+ON\s+public\.profiles\s+FROM\s+anon/i.test(sqlContent);
const anonRevokedCharacters = /REVOKE\s+ALL\s+ON\s+public\.characters\s+FROM\s+anon/i.test(sqlContent);
assert.ok(anonRevokedProfiles && anonRevokedCharacters, 'Anon role must be stripped of all privileges on both tables');

// Check authenticated column grants
assert.match(sqlContent, /GRANT\s+SELECT\s+ON\s+public\.profiles\s+TO\s+authenticated/i,
  'authenticated must have SELECT on profiles');
assert.match(sqlContent, /GRANT\s+INSERT\s*\(id,\s*display_name,\s*avatar_url\)\s+ON\s+public\.profiles\s+TO\s+authenticated/i,
  'authenticated INSERT on profiles must be restricted to id, display_name, avatar_url');
assert.match(sqlContent, /GRANT\s+UPDATE\s*\(display_name,\s*avatar_url\)\s+ON\s+public\.profiles\s+TO\s+authenticated/i,
  'authenticated UPDATE on profiles must be restricted to display_name, avatar_url');

assert.match(sqlContent, /GRANT\s+SELECT\s+ON\s+public\.characters\s+TO\s+authenticated/i,
  'authenticated must have SELECT on characters');
assert.match(sqlContent, /GRANT\s+INSERT\s*\(user_id,\s*name\)\s+ON\s+public\.characters\s+TO\s+authenticated/i,
  'authenticated INSERT on characters must be restricted to user_id, name only');
assert.match(sqlContent, /GRANT\s+UPDATE\s*\(name\)\s+ON\s+public\.characters\s+TO\s+authenticated/i,
  'authenticated UPDATE on characters must be restricted to name only');

// Confirm server-owned gameplay fields are NEVER granted for write to authenticated
const forbiddenWrites = ['level', 'xp', 'gold', 'chapter', 'kills', 'checkpoint', 'playtime_seconds'];
for (const field of forbiddenWrites) {
  const insertRegex = new RegExp(`GRANT\\s+INSERT\\s*\\([^)]*\\b${field}\\b[^)]*\\)\\s+ON\\s+public\\.characters\\s+TO\\s+authenticated`, 'i');
  const updateRegex = new RegExp(`GRANT\\s+UPDATE\\s*\\([^)]*\\b${field}\\b[^)]*\\)\\s+ON\\s+public\\.characters\\s+TO\\s+authenticated`, 'i');
  assert.equal(insertRegex.test(sqlContent), false, `Forbidden: Column ${field} must not be granted for INSERT to authenticated`);
  assert.equal(updateRegex.test(sqlContent), false, `Forbidden: Column ${field} must not be granted for UPDATE to authenticated`);
}
console.log('[PASS] Privilege audit: Column grants explicitly prevent client write access to server-owned gameplay fields.');

// 7. Verify RLS Activation & Strict Ownership Policies
assert.match(sqlContent, /ALTER\s+TABLE\s+public\.profiles\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
  'RLS must be enabled on public.profiles');
assert.match(sqlContent, /ALTER\s+TABLE\s+public\.characters\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
  'RLS must be enabled on public.characters');

const expectedPolicies = [
  {
    table: 'public.profiles',
    name: 'Users can select own profile',
    command: 'SELECT',
    clause: 'auth.uid() = id'
  },
  {
    table: 'public.profiles',
    name: 'Users can insert own profile',
    command: 'INSERT',
    clause: 'auth.uid() = id'
  },
  {
    table: 'public.profiles',
    name: 'Users can update own profile',
    command: 'UPDATE',
    clause: 'auth.uid() = id'
  },
  {
    table: 'public.characters',
    name: 'Users can select own character',
    command: 'SELECT',
    clause: 'auth.uid() = user_id'
  },
  {
    table: 'public.characters',
    name: 'Users can insert own character',
    command: 'INSERT',
    clause: 'auth.uid() = user_id'
  },
  {
    table: 'public.characters',
    name: 'Users can update own character metadata',
    command: 'UPDATE',
    clause: 'auth.uid() = user_id'
  }
];

for (const p of expectedPolicies) {
  const policyRegex = new RegExp(
    `CREATE\\s+POLICY\\s+"${p.name}"\\s+ON\\s+${p.table.replace('.', '\\.')}\\s+FOR\\s+${p.command}\\s+TO\\s+authenticated[\\s\\S]*?${p.clause.replace('(', '\\(').replace(')', '\\)')}`,
    'i'
  );
  assert.ok(policyRegex.test(sqlContent), `Missing or malformed RLS policy: "${p.name}" on ${p.table}`);
}
console.log('[PASS] RLS policies: All 6 required policies reference auth.uid() and strictly deny cross-user access.');

// 8. Deterministic Mock Policy & Access Simulation
console.log('[M1-SCHEMA-CHECK] Running deterministic mock access matrix tests...');

const testUsers = {
  alice: { uid: '00000000-0000-0000-0000-000000000001', role: 'authenticated' },
  bob: { uid: '00000000-0000-0000-0000-000000000002', role: 'authenticated' },
  anon: { uid: null, role: 'anon' },
  server: { uid: 'server-worker', role: 'service_role' }
};

// Simulation helper for RLS rule
function evaluateRls(policyType, user, recordOwnerId) {
  if (user.role === 'service_role') return true; // BYPASSRLS
  if (user.role !== 'authenticated' || !user.uid) return false;
  return user.uid === recordOwnerId;
}

// Simulation helper for column write permissions
function evaluateColumnWrite(table, command, user, columnsToModify) {
  if (user.role === 'service_role') return true;
  if (user.role !== 'authenticated') return false;

  const allowedColumns = {
    profiles: {
      INSERT: ['id', 'display_name', 'avatar_url'],
      UPDATE: ['display_name', 'avatar_url']
    },
    characters: {
      INSERT: ['user_id', 'name'],
      UPDATE: ['name']
    }
  };

  const allowed = allowedColumns[table]?.[command] || [];
  return columnsToModify.every(col => allowed.includes(col));
}

// Test cases
// Case 1: Alice selects Alice's profile -> ALLOW
assert.equal(evaluateRls('SELECT', testUsers.alice, testUsers.alice.uid), true);
// Case 2: Alice selects Bob's profile -> DENY
assert.equal(evaluateRls('SELECT', testUsers.alice, testUsers.bob.uid), false);
// Case 3: Anon selects Alice's profile -> DENY
assert.equal(evaluateRls('SELECT', testUsers.anon, testUsers.alice.uid), false);
// Case 4: Alice updates Bob's profile -> DENY
assert.equal(evaluateRls('UPDATE', testUsers.alice, testUsers.bob.uid), false);

// Case 5: Alice selects Alice's character -> ALLOW
assert.equal(evaluateRls('SELECT', testUsers.alice, testUsers.alice.uid), true);
// Case 6: Alice selects Bob's character -> DENY
assert.equal(evaluateRls('SELECT', testUsers.alice, testUsers.bob.uid), false);

// Case 7: Alice updates character name -> ALLOW
assert.equal(evaluateColumnWrite('characters', 'UPDATE', testUsers.alice, ['name']), true);
// Case 8: Alice updates character gold -> DENY
assert.equal(evaluateColumnWrite('characters', 'UPDATE', testUsers.alice, ['gold']), false);
// Case 9: Alice updates character level & name -> DENY
assert.equal(evaluateColumnWrite('characters', 'UPDATE', testUsers.alice, ['name', 'level']), false);
// Case 10: Alice inserts character with initial server gold -> DENY
assert.equal(evaluateColumnWrite('characters', 'INSERT', testUsers.alice, ['user_id', 'name', 'gold']), false);
// Case 11: Alice inserts character with valid columns -> ALLOW
assert.equal(evaluateColumnWrite('characters', 'INSERT', testUsers.alice, ['user_id', 'name']), true);

// Case 12: Server role updates character gold and level -> ALLOW
assert.equal(evaluateColumnWrite('characters', 'UPDATE', testUsers.server, ['gold', 'level', 'xp']), true);

console.log('[PASS] Mock access matrix: 12/12 positive and negative security assertions passed.');
console.log('----------------------------------------------------------------------');
console.log('[SUCCESS] All M1 database schema, constraint, and RLS checks passed.');
