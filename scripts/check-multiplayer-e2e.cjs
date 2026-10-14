#!/usr/bin/env node
/**
 * scripts/check-multiplayer-e2e.cjs
 *
 * Deterministic E2E Test Suite for Two-Client Multiplayer Synchronization & Anti-Cheat:
 * Tham chiếu: THAN_MENH_ONLINE_MULTIPLAYER_SUPABASE_MASTER_PROMPT.md
 * (Mục 07 Network Protocol, Mục 08 Server-Authoritative Combat, Mục 14 Roadmap M2/M3/M4, Mục 15 QA Test Matrix)
 *
 * Test Case 1: Room Join & Presence Sync (M2)
 *   - Client A (Lạc Tướng) và Client B (Hùng Dũng) cùng tham gia room 'village-hub'.
 *   - Cả 2 client đều nhận được snapshot chứa thông tin hiện diện của cả 2 user.
 *
 * Test Case 2: Movement Synchronization (M2/M3)
 *   - Client A gửi intent move (x=1.5, y=-2.0) được chuẩn hóa theo protocol.
 *   - Client B nhận được authoritative snapshot phản ánh vị trí mới của Client A.
 *
 * Test Case 3: Server-Authoritative Combat & Hit Event (M3)
 *   - Client A gửi combat intent attack (comboIndex=0, seq=1).
 *   - Server tính toán sát thương xác định (10 HP), trừ máu quái 'training:0'.
 *   - Server broadcast event 'damage_dealt', cả Client A và Client B đều nhận event với newHp = 110.
 *
 * Test Case 4: Anti-Cheat & Fake Damage Rejection (M3 Anti-Cheat)
 *   - Client B gửi gói tin gian lận chứa damage: 999999 hoặc gold: 50000.
 *   - Server phát hiện vi phạm authority boundary, gửi reject gói tin.
 *   - Snapshot xác nhận máu của quái không bị thay đổi bởi client gian lận.
 *
 * Test Case 5: Party Co-op State Synchronization (M4)
 *   - Client A gửi party_intent tạo party và mời Client B.
 *   - Client B nhận lời mời và gửi accept.
 *   - Cả 2 client nhận được party_snapshot đồng bộ hiển thị 2 thành viên và User A là Leader.
 *
 * Cleanup & Tear Down:
 *   - Ngắt kết nối các client, tắt room, graceful shutdown server process không để lại port treo.
 */

const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { execFileSync } = require('node:child_process');
const { Client } = require('colyseus.js');

console.log('================================================================');
console.log('THẦN MỆNH: MULTIPLAYER E2E SYNCHRONIZATION & ANTI-CHEAT SUITE');
console.log('================================================================\n');

/**
 * Message hub utility for Colyseus room to prevent listener leaks
 * and guarantee immediate capture of incoming server messages.
 */
function createMessageHub(room) {
  const listeners = new Map();
  const knownTypes = [
    'snapshot',
    'event',
    'reject',
    'party_snapshot',
    'party_reject',
    'party_event',
    'character_progress',
  ];

  for (const type of knownTypes) {
    listeners.set(type, new Set());
    room.onMessage(type, (msg) => {
      const handlers = listeners.get(type);
      if (handlers) {
        for (const handler of Array.from(handlers)) {
          try {
            handler(msg);
          } catch (err) {
            console.error(`Error in message handler for ${type}:`, err);
          }
        }
      }
    });
  }

  return {
    nextMessage(type, predicate = () => true, timeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        let timer;
        const handler = (msg) => {
          if (predicate(msg)) {
            clearTimeout(timer);
            listeners.get(type)?.delete(handler);
            resolve(msg);
          }
        };

        timer = setTimeout(() => {
          listeners.get(type)?.delete(handler);
          reject(new Error(`Timed out waiting for message "${type}" (${timeoutMs}ms)`));
        }, timeoutMs);

        if (!listeners.has(type)) {
          listeners.set(type, new Set());
          room.onMessage(type, (msg) => {
            const handlers = listeners.get(type);
            if (handlers) {
              for (const h of Array.from(handlers)) {
                try {
                  h(msg);
                } catch {
                  /* ignore */
                }
              }
            }
          });
        }

        listeners.get(type).add(handler);
      });
    },
  };
}

async function runMultiplayerE2ETests() {
  // Step 0: Ensure TypeScript game-server is cleanly compiled
  console.log('--- Step 0: Compiling game-server TypeScript files ---');
  execFileSync(
    process.execPath,
    [require.resolve('typescript/bin/tsc'), '-p', 'apps/game-server/tsconfig.json'],
    { stdio: 'inherit' }
  );
  console.log('  -> [OK] game-server compilation successful.\n');

  // Step 1: Initialize local JWKS authentication provider and test identities
  console.log('--- Step 1: Initializing Local JWKS Auth Provider & Identities ---');
  const { SignJWT, generateKeyPair, exportJWK } = await import('jose');
  const { createGameServer, PlayerRoom, ROOM_NAME } = await import('../dist/game-server/server.js');

  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: 'e2e-multiplayer-key',
    alg: 'RS256',
    use: 'sig',
  };

  const jwksServer = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ keys: [jwk] }));
  });

  await new Promise((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
  const authPort = jwksServer.address().port;
  const authUrl = `http://127.0.0.1:${authPort}`;

  const envBackup = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_JWT_JWKS_URL: process.env.SUPABASE_JWT_JWKS_URL,
    SUPABASE_JWT_AUDIENCE: process.env.SUPABASE_JWT_AUDIENCE,
  };

  process.env.SUPABASE_URL = authUrl;
  process.env.SUPABASE_JWT_JWKS_URL = `${authUrl}/auth/v1/.well-known/jwks.json`;
  process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';

  const USER_A = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Lạc Tướng',
  };
  const USER_B = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Hùng Dũng',
  };

  const tokenA = await new SignJWT({ role: 'authenticated', name: USER_A.name })
    .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
    .setSubject(USER_A.id)
    .setIssuer(`${authUrl}/auth/v1`)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(privateKey);

  const tokenB = await new SignJWT({ role: 'authenticated', name: USER_B.name })
    .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
    .setSubject(USER_B.id)
    .setIssuer(`${authUrl}/auth/v1`)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(privateKey);

  console.log(`  -> [OK] JWKS listening on port ${authPort}`);
  console.log(`  -> [OK] User A: ${USER_A.name} (${USER_A.id})`);
  console.log(`  -> [OK] User B: ${USER_B.name} (${USER_B.id})\n`);

  // Step 2: Initialize local Colyseus Game Server
  console.log('--- Step 2: Launching Colyseus Server Instance ---');
  const server = createGameServer();
  // Define village-hub room explicitly for village instance routing
  server.define('village-hub', PlayerRoom);

  const requestedPort = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 0;
  await server.listen(requestedPort, '127.0.0.1');
  const serverPort = server.transport.server.address().port;
  const endpoint = `http://127.0.0.1:${serverPort}`;
  console.log(`  -> [OK] Game server listening independently on ${endpoint} (room: "village-hub")\n`);

  const rooms = [];

  try {
    // ========================================================================
    // TEST CASE 1: Room Join & Presence Sync
    // ========================================================================
    console.log('--- Test Case 1: Room Join & Presence Sync (M2) ---');

    const clientA = new Client(endpoint);
    const clientB = new Client(endpoint);

    const roomA = await clientA.joinOrCreate('village-hub', {
      authorization: `Bearer ${tokenA}`,
      characterId: USER_A.id,
      name: USER_A.name,
      roomId: 'village-hub',
    });
    rooms.push(roomA);

    const roomB = await clientB.joinOrCreate('village-hub', {
      authorization: `Bearer ${tokenB}`,
      characterId: USER_B.id,
      name: USER_B.name,
      roomId: 'village-hub',
    });
    rooms.push(roomB);

    assert.equal(roomA.roomId, roomB.roomId, 'Both clients must join the same room instance');

    const hubA = createMessageHub(roomA);
    const hubB = createMessageHub(roomB);

    // Wait for authoritative snapshots on both clients showing both players
    const [snapshotA, snapshotB] = await Promise.all([
      hubA.nextMessage('snapshot', (msg) => msg.players?.length === 2),
      hubB.nextMessage('snapshot', (msg) => msg.players?.length === 2),
    ]);

    const idsA = snapshotA.players.map((p) => p.id).sort();
    const idsB = snapshotB.players.map((p) => p.id).sort();
    const expectedIds = [USER_A.id, USER_B.id].sort();

    assert.deepEqual(idsA, expectedIds, 'Client A snapshot must contain both User A and User B');
    assert.deepEqual(idsB, expectedIds, 'Client B snapshot must contain both User A and User B');

    // Verify initial positions and states
    const playerAInB = snapshotB.players.find((p) => p.id === USER_A.id);
    const playerBInA = snapshotA.players.find((p) => p.id === USER_B.id);
    assert.ok(playerAInB, 'User A state must be present in Client B snapshot');
    assert.ok(playerBInA, 'User B state must be present in Client A snapshot');
    assert.equal(playerAInB.hp, 100, 'Player A initial HP must be 100');
    assert.equal(playerBInA.hp, 100, 'Player B initial HP must be 100');

    console.log(`  -> [PASS] Both Client A (${USER_A.name}) and Client B (${USER_B.name}) joined room ${roomA.roomId}`);
    console.log('  -> [PASS] Presence snapshot verified with 2 active players synchronized.\n');

    // ========================================================================
    // TEST CASE 2: Movement Synchronization
    // ========================================================================
    console.log('--- Test Case 2: Movement Synchronization (M2/M3) ---');

    // Client A sends movement intent towards (x=1.5, y=-2.0)
    // Under network protocol rules (createMoveInputIntent), input axes are clamped to [-1.0, 1.0]
    const rawTargetX = 1.5;
    const rawTargetY = -2.0;
    const clampedMoveX = Math.max(-1.0, Math.min(1.0, rawTargetX));
    const clampedMoveY = Math.max(-1.0, Math.min(1.0, rawTargetY));

    // Send movement intent
    roomA.send('intent', { type: 'move', x: clampedMoveX, y: clampedMoveY });

    // Client B observes Client A's position update in authoritative world snapshot
    const movedSnapshot = await hubB.nextMessage('snapshot', (msg) => {
      const p = msg.players?.find((player) => player.id === USER_A.id);
      return p && p.x > 0 && p.y < 0;
    });

    const updatedPlayerA = movedSnapshot.players.find((p) => p.id === USER_A.id);
    assert.ok(updatedPlayerA.x > 0, 'Client B snapshot must reflect positive x position for Client A');
    assert.ok(updatedPlayerA.y < 0, 'Client B snapshot must reflect negative y position for Client A');
    assert.equal(updatedPlayerA.state, 'walk', 'Client A state must transition to walk during movement');

    // Client A stops moving
    roomA.send('intent', { type: 'move', x: 0, y: 0 });

    const restingSnapshot = await hubB.nextMessage('snapshot', (msg) => {
      const p = msg.players?.find((player) => player.id === USER_A.id);
      return p && p.state === 'idle';
    });

    const restingPlayerA = restingSnapshot.players.find((p) => p.id === USER_A.id);
    assert.equal(restingPlayerA.state, 'idle', 'Client A must return to idle state after stopping');

    console.log(`  -> [PASS] Client A moved to x=${updatedPlayerA.x.toFixed(2)}, y=${updatedPlayerA.y.toFixed(2)}`);
    console.log('  -> [PASS] Client B received synchronized snapshot reflecting new position.\n');

    // ========================================================================
    // TEST CASE 3: Server-Authoritative Combat & Hit Event
    // ========================================================================
    console.log('--- Test Case 3: Server-Authoritative Combat & Hit Event (M3) ---');

    // Get initial monster state from snapshot
    const preCombatSnap = await hubA.nextMessage('snapshot');
    const monsterBefore = preCombatSnap.monsters.find((m) => m.id === 'training:0');
    assert.ok(monsterBefore, 'Monster training:0 must exist in authoritative room');
    const initialMonsterHp = monsterBefore.hp;
    assert.equal(initialMonsterHp, 120, 'Initial monster HP must be 120');

    // Both clients listen for broadcast 'damage_dealt' event
    const eventPromiseA = hubA.nextMessage(
      'event',
      (msg) => msg.event?.kind === 'damage_dealt' && msg.event?.targetId === 'training:0'
    );
    const eventPromiseB = hubB.nextMessage(
      'event',
      (msg) => msg.event?.kind === 'damage_dealt' && msg.event?.targetId === 'training:0'
    );

    // Client A dispatches attack intent: seq=1, comboIndex=0
    // Expected damage for comboIndex 0: 10 + 0 * 2 = 10
    const expectedDamage = 10;
    const expectedNewHp = initialMonsterHp - expectedDamage; // 110

    roomA.send('intent', { type: 'attack', seq: 1, comboIndex: 0 });

    const [hitEventA, hitEventB] = await Promise.all([eventPromiseA, eventPromiseB]);

    assert.equal(hitEventA.event.sourceId, roomA.sessionId, 'Event source must be Client A session');
    assert.equal(hitEventA.event.targetId, 'training:0', 'Target entity must be training:0');
    assert.equal(hitEventA.event.amount, expectedDamage, 'Server must compute deterministic damage = 10');
    assert.equal(hitEventA.event.newHp, expectedNewHp, 'Server must calculate new monster HP = 110');

    assert.equal(hitEventB.event.sourceId, roomA.sessionId, 'Client B must receive matching sourceId');
    assert.equal(hitEventB.event.amount, expectedDamage, 'Client B must receive matching damage amount');
    assert.equal(hitEventB.event.newHp, expectedNewHp, 'Client B must receive matching newHp');

    // Subsequent snapshot confirms monster HP update
    const postCombatSnap = await hubB.nextMessage('snapshot', (msg) => {
      const m = msg.monsters?.find((mon) => mon.id === 'training:0');
      return m && m.hp === expectedNewHp;
    });
    assert.equal(
      postCombatSnap.monsters.find((m) => m.id === 'training:0').hp,
      expectedNewHp,
      'Authoritative snapshot must show monster HP reduced to 110'
    );

    console.log(`  -> [PASS] Client A attacked monster training:0 (comboIndex=0, seq=1)`);
    console.log(`  -> [PASS] Server computed ${expectedDamage} damage deterministically (120 -> 110 HP)`);
    console.log('  -> [PASS] Broadcast event damage_dealt received by both Client A & Client B.\n');

    // ========================================================================
    // TEST CASE 4: Anti-Cheat & Fake Damage Rejection
    // ========================================================================
    console.log('--- Test Case 4: Anti-Cheat & Fake Damage Rejection (M3 Anti-Cheat) ---');

    // Subtest 4.1: Client B attempts to forge damage: 999999
    const rejectPromise1 = hubB.nextMessage('reject', (msg) => msg.code === 'MALFORMED');
    roomB.send('intent', {
      type: 'attack',
      seq: 2,
      comboIndex: 1,
      damage: 999999,
    });

    const rejectMsg1 = await rejectPromise1;
    assert.equal(rejectMsg1.code, 'MALFORMED', 'Server must reject forged damage payload with MALFORMED');
    assert.equal(rejectMsg1.intentType, 'attack', 'Reject must target attack intent');

    // Subtest 4.2: Client B attempts to forge gold: 50000
    const rejectPromise2 = hubB.nextMessage('reject', (msg) => msg.code === 'MALFORMED');
    roomB.send('intent', {
      type: 'attack',
      seq: 3,
      comboIndex: 1,
      gold: 50000,
    });

    const rejectMsg2 = await rejectPromise2;
    assert.equal(rejectMsg2.code, 'MALFORMED', 'Server must reject forged gold payload with MALFORMED');

    // Verify monster HP was strictly NOT altered by the cheat attempts
    const verifySnap = await hubB.nextMessage(
      'snapshot',
      (msg) => msg.serverTick > movedSnapshot.serverTick + 5
    );
    const monsterCurrent = verifySnap.monsters.find((m) => m.id === 'training:0');
    assert.equal(
      monsterCurrent.hp,
      expectedNewHp,
      'Monster HP must remain 110 and NOT be changed by forged packets'
    );

    console.log('  -> [PASS] Cheat attempt 1 (damage: 999999) rejected with code MALFORMED');
    console.log('  -> [PASS] Cheat attempt 2 (gold: 50000) rejected with code MALFORMED');
    console.log(`  -> [PASS] Monster HP preserved at ${monsterCurrent.hp} HP (zero client authority).\n`);

    // ========================================================================
    // TEST CASE 5: Party Co-op State Synchronization
    // ========================================================================
    console.log('--- Test Case 5: Party Co-op State Synchronization (M4) ---');

    // Step 5.1: Client A creates party
    const partyCreatePromise = hubA.nextMessage(
      'party_snapshot',
      (msg) => msg.partyId !== null && msg.leaderId === USER_A.id
    );
    roomA.send('party_intent', { action: 'create', requestId: 'party-create-e2e-1' });
    const initialPartyState = await partyCreatePromise;
    const createdPartyId = initialPartyState.partyId;

    assert.ok(createdPartyId, 'Party ID must be generated');
    assert.equal(initialPartyState.leaderId, USER_A.id, 'User A must be the party leader');
    assert.deepEqual(initialPartyState.members, [USER_A.id], 'Party must initially contain User A');

    // Step 5.2: Client A invites Client B
    const invitePromiseB = hubB.nextMessage('party_snapshot', (msg) =>
      msg.invites?.some((inv) => inv.partyId === createdPartyId && inv.leaderId === USER_A.id)
    );
    roomA.send('party_intent', {
      action: 'invite',
      requestId: 'party-invite-e2e-2',
      targetUserId: USER_B.id,
    });
    await invitePromiseB;

    // Step 5.3: Client B accepts the invite
    const partyAcceptA = hubA.nextMessage(
      'party_snapshot',
      (msg) => msg.partyId === createdPartyId && msg.members?.length === 2
    );
    const partyAcceptB = hubB.nextMessage(
      'party_snapshot',
      (msg) => msg.partyId === createdPartyId && msg.members?.length === 2
    );

    roomB.send('party_intent', {
      action: 'accept',
      requestId: 'party-accept-e2e-3',
      partyId: createdPartyId,
    });

    const [syncedPartyA, syncedPartyB] = await Promise.all([partyAcceptA, partyAcceptB]);

    // Verify party synchronization across both clients
    assert.equal(syncedPartyA.partyId, createdPartyId, 'Client A partyId must match');
    assert.equal(syncedPartyB.partyId, createdPartyId, 'Client B partyId must match');
    assert.equal(syncedPartyA.leaderId, USER_A.id, 'Client A leader must be User A');
    assert.equal(syncedPartyB.leaderId, USER_A.id, 'Client B leader must be User A');

    const expectedMembers = [USER_A.id, USER_B.id].sort();
    assert.deepEqual(syncedPartyA.members.sort(), expectedMembers, 'Client A party members must match');
    assert.deepEqual(syncedPartyB.members.sort(), expectedMembers, 'Client B party members must match');

    console.log(`  -> [PASS] Party ${createdPartyId} created by ${USER_A.name}`);
    console.log(`  -> [PASS] Invite sent to and accepted by ${USER_B.name}`);
    console.log(`  -> [PASS] Synchronized party state confirmed on both clients (Leader: ${USER_A.name}, Members: 2).\n`);
  } finally {
    // ========================================================================
    // Cleanup & Tear Down
    // ========================================================================
    console.log('--- Cleanup & Tear Down ---');
    try {
      await Promise.allSettled(rooms.map((r) => r.leave(true)));
      console.log('  -> [OK] All WebSocket client rooms disconnected.');
    } catch {
      /* ignore */
    }

    try {
      await server.gracefullyShutdown(false);
      console.log('  -> [OK] Colyseus server process gracefully shut down.');
    } catch {
      /* ignore */
    }

    try {
      await new Promise((resolve) => jwksServer.close(resolve));
      console.log('  -> [OK] Local JWKS server closed.');
    } catch {
      /* ignore */
    }

    // Restore environment variables
    for (const [key, val] of Object.entries(envBackup)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
    console.log('  -> [OK] Environment variables restored.\n');
  }

  console.log('================================================================');
  console.log('ALL MULTIPLAYER E2E TEST SUITES PASSED (5/5 SUITES)');
  console.log('================================================================');
}

runMultiplayerE2ETests().then(
  () => process.exit(0),
  (err) => {
    console.error('\nMULTIPLAYER E2E TEST FAILED:', err);
    process.exit(1);
  }
);
