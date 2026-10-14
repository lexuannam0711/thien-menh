/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * Authoritative Party Adapter (M4 Client Online Boundary)
 *
 * Client-side adapter for server-authoritative party state:
 * - Validates outgoing party intents (create, invite, accept, decline, leave, kick, transfer_leader, disband).
 * - Enforces fail-closed validation, exact allowed keys, length bounds, and UUID user IDs.
 * - Rejects any client authority claims (no injected hp, damage, gold, etc.).
 * - Consumes validated server party snapshots and reject messages without claiming client authority.
 * - Enforces deep immutability on all party snapshots, invites, and cached state.
 * - Guarantees listener isolation (subscriber errors do not crash adapter or other listeners).
 * - Guarantees clean state reset on disconnect.
 */

import { deepFreeze, FORBIDDEN_CLIENT_AUTHORITY_FIELDS, type ValidationResult, type RejectCode } from './protocol';

export const MAX_PARTY_MEMBERS = 4;
export const MAX_STRING_LENGTH = 64;

export const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_PATTERN.test(val);
}

export function isValidIdentifier(val: unknown, maxLen = MAX_STRING_LENGTH): val is string {
  return typeof val === 'string' && val.length >= 1 && val.length <= maxLen && /^[a-zA-Z0-9:_-]+$/.test(val);
}

export type PartyAction =
  | 'create'
  | 'invite'
  | 'accept'
  | 'decline'
  | 'leave'
  | 'kick'
  | 'transfer_leader'
  | 'disband';

export const PARTY_ACTIONS: readonly PartyAction[] = Object.freeze([
  'create',
  'invite',
  'accept',
  'decline',
  'leave',
  'kick',
  'transfer_leader',
  'disband',
]);

export interface PartyIntent {
  readonly action: PartyAction;
  readonly requestId: string;
  readonly targetUserId?: string;
  readonly partyId?: string;
}

export interface ServerPartyInvite {
  readonly partyId: string;
  readonly leaderId: string;
}

export interface ServerPartySnapshot {
  readonly type: 'party_snapshot';
  readonly partyId: string | null;
  readonly leaderId: string | null;
  readonly members: readonly string[];
  readonly invites: readonly ServerPartyInvite[];
}

export interface ServerPartyReject {
  readonly type: 'party_reject';
  readonly requestId: string;
  readonly code: string;
  readonly reason?: string;
}

export interface ServerPartyEvent {
  readonly type: 'party_event';
  readonly kind: 'party_created' | 'party_disbanded' | 'member_joined' | 'member_left' | 'member_kicked' | 'leader_changed' | 'invite_received';
  readonly partyId?: string;
  readonly userId?: string;
  readonly leaderId?: string;
}

export type ServerPartyMessage =
  | ServerPartySnapshot
  | ServerPartyReject
  | ServerPartyEvent;

export interface PartyState {
  readonly partyId: string | null;
  readonly leaderId: string | null;
  readonly members: readonly string[];
  readonly invites: readonly ServerPartyInvite[];
  readonly isInParty: boolean;
  readonly isLeader: boolean;
  readonly memberCount: number;
}

export const INITIAL_PARTY_STATE: Readonly<PartyState> = Object.freeze({
  partyId: null,
  leaderId: null,
  members: Object.freeze([]),
  invites: Object.freeze([]),
  isInParty: false,
  isLeader: false,
  memberCount: 0,
});

function hasUnknownKeys(obj: Record<string, unknown>, allowedKeys: readonly string[]): string | null {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) return key;
  }
  return null;
}

export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// INTENT FACTORY FUNCTIONS
// ============================================================================

export function createPartyIntent(requestId = generateRequestId()): PartyIntent {
  return deepFreeze({
    action: 'create',
    requestId,
  });
}

export function createInviteIntent(targetUserId: string, requestId = generateRequestId()): PartyIntent {
  return deepFreeze({
    action: 'invite',
    requestId,
    targetUserId,
  });
}

export function createAcceptInviteIntent(partyId: string, requestId = generateRequestId()): PartyIntent {
  return deepFreeze({
    action: 'accept',
    requestId,
    partyId,
  });
}

export function createDeclineInviteIntent(partyId: string, requestId = generateRequestId()): PartyIntent {
  return deepFreeze({
    action: 'decline',
    requestId,
    partyId,
  });
}

export function createLeavePartyIntent(requestId = generateRequestId()): PartyIntent {
  return deepFreeze({
    action: 'leave',
    requestId,
  });
}

export function createKickMemberIntent(targetUserId: string, requestId = generateRequestId()): PartyIntent {
  return deepFreeze({
    action: 'kick',
    requestId,
    targetUserId,
  });
}

export function createTransferLeaderIntent(targetUserId: string, requestId = generateRequestId()): PartyIntent {
  return deepFreeze({
    action: 'transfer_leader',
    requestId,
    targetUserId,
  });
}

export function createDisbandPartyIntent(requestId = generateRequestId()): PartyIntent {
  return deepFreeze({
    action: 'disband',
    requestId,
  });
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function validatePartyIntent(payload: unknown): ValidationResult<PartyIntent> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Party intent must be a non-null object', code: 'MALFORMED' };
  }

  const raw = payload as Record<string, unknown>;

  // Anti-cheat / anti-authority check
  for (const forbidden of FORBIDDEN_CLIENT_AUTHORITY_FIELDS) {
    if (forbidden in raw) {
      return {
        ok: false,
        error: `Party intent contains unauthorized authority field: "${forbidden}"`,
        code: 'UNAUTHORIZED',
      };
    }
  }

  // Exact allowed keys check
  const allowedKeys = ['action', 'requestId', 'targetUserId', 'partyId'] as const;
  const unknownKey = hasUnknownKeys(raw, allowedKeys);
  if (unknownKey) {
    return { ok: false, error: `Unexpected field in party intent: "${unknownKey}"`, code: 'MALFORMED' };
  }

  const action = raw.action;
  if (typeof action !== 'string' || !(PARTY_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: `Unknown or missing party action: "${String(action)}"`, code: 'UNKNOWN_INTENT' };
  }

  if (typeof raw.requestId !== 'string' || raw.requestId.length < 1 || raw.requestId.length > MAX_STRING_LENGTH) {
    return { ok: false, error: 'requestId must be a non-empty string <= 64 chars', code: 'MALFORMED' };
  }

  // Target user ID validation (must be valid UUID if present or required)
  if (raw.targetUserId !== undefined) {
    if (!isValidUuid(raw.targetUserId)) {
      return { ok: false, error: 'targetUserId must be a valid UUID', code: 'MALFORMED' };
    }
  }

  // Party ID validation (must be valid UUID or identifier <= 64 chars)
  if (raw.partyId !== undefined) {
    if (!isValidIdentifier(raw.partyId)) {
      return { ok: false, error: 'partyId must be a valid identifier <= 64 chars', code: 'MALFORMED' };
    }
  }

  // Action-specific requirement checks
  switch (action as PartyAction) {
    case 'invite':
    case 'kick':
    case 'transfer_leader':
      if (!raw.targetUserId) {
        return { ok: false, error: `Party action "${action}" requires targetUserId`, code: 'MALFORMED' };
      }
      break;
    case 'accept':
    case 'decline':
      if (!raw.partyId) {
        return { ok: false, error: `Party action "${action}" requires partyId`, code: 'MALFORMED' };
      }
      break;
    case 'create':
    case 'leave':
    case 'disband':
      break;
  }

  const validated: PartyIntent = {
    action: action as PartyAction,
    requestId: raw.requestId,
    ...(raw.targetUserId ? { targetUserId: raw.targetUserId as string } : {}),
    ...(raw.partyId ? { partyId: raw.partyId as string } : {}),
  };

  return { ok: true, value: deepFreeze(validated) };
}

export function validatePartySnapshot(payload: unknown): ValidationResult<ServerPartySnapshot> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Party snapshot must be a non-null object', code: 'MALFORMED' };
  }

  const raw = payload as Record<string, unknown>;

  const allowedKeys = ['type', 'partyId', 'leaderId', 'members', 'invites'] as const;
  const unknownKey = hasUnknownKeys(raw, allowedKeys);
  if (unknownKey) {
    return { ok: false, error: `Unexpected field in party snapshot: "${unknownKey}"`, code: 'MALFORMED' };
  }

  if (raw.type !== 'party_snapshot') {
    return { ok: false, error: 'Party snapshot type must be "party_snapshot"', code: 'MALFORMED' };
  }

  // Validate partyId
  let partyId: string | null = null;
  if (raw.partyId !== null) {
    if (!isValidIdentifier(raw.partyId)) {
      return { ok: false, error: 'partyId must be null or a valid identifier <= 64 chars', code: 'MALFORMED' };
    }
    partyId = raw.partyId as string;
  }

  // Validate leaderId
  let leaderId: string | null = null;
  if (raw.leaderId !== null) {
    if (!isValidUuid(raw.leaderId)) {
      return { ok: false, error: 'leaderId must be null or a valid UUID', code: 'MALFORMED' };
    }
    leaderId = raw.leaderId as string;
  }

  // Validate members array
  if (!Array.isArray(raw.members)) {
    return { ok: false, error: 'members must be an array of user IDs', code: 'MALFORMED' };
  }

  if (raw.members.length > MAX_PARTY_MEMBERS) {
    return { ok: false, error: `Party members count exceeds maximum limit of ${MAX_PARTY_MEMBERS}`, code: 'MALFORMED' };
  }

  const members: string[] = [];
  for (const member of raw.members) {
    if (!isValidUuid(member)) {
      return { ok: false, error: 'Each member in party snapshot must be a valid UUID', code: 'MALFORMED' };
    }
    members.push(member);
  }

  // Enforce consistency:
  if (partyId === null) {
    if (leaderId !== null || members.length > 0) {
      return { ok: false, error: 'Party snapshot with null partyId must have null leaderId and empty members', code: 'MALFORMED' };
    }
  } else {
    if (leaderId === null) {
      return { ok: false, error: 'Active party must have a non-null leaderId', code: 'MALFORMED' };
    }
    if (!members.includes(leaderId)) {
      return { ok: false, error: 'Party leader must be a member of the party', code: 'MALFORMED' };
    }
  }

  // Validate invites array
  if (!Array.isArray(raw.invites)) {
    return { ok: false, error: 'invites must be an array', code: 'MALFORMED' };
  }

  const invites: ServerPartyInvite[] = [];
  for (const inv of raw.invites) {
    if (!inv || typeof inv !== 'object' || Array.isArray(inv)) {
      return { ok: false, error: 'Each invite must be an object', code: 'MALFORMED' };
    }
    const invRaw = inv as Record<string, unknown>;
    if (!isValidIdentifier(invRaw.partyId)) {
      return { ok: false, error: 'Invite partyId must be a valid identifier <= 64 chars', code: 'MALFORMED' };
    }
    if (!isValidUuid(invRaw.leaderId)) {
      return { ok: false, error: 'Invite leaderId must be a valid UUID', code: 'MALFORMED' };
    }
    invites.push(Object.freeze({
      partyId: invRaw.partyId as string,
      leaderId: invRaw.leaderId as string,
    }));
  }

  const validated: ServerPartySnapshot = {
    type: 'party_snapshot',
    partyId,
    leaderId,
    members: Object.freeze(members),
    invites: Object.freeze(invites),
  };

  return { ok: true, value: deepFreeze(validated) };
}

export function validatePartyReject(payload: unknown): ValidationResult<ServerPartyReject> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Party reject must be a non-null object', code: 'MALFORMED' };
  }

  const raw = payload as Record<string, unknown>;
  if (raw.type !== 'party_reject') {
    return { ok: false, error: 'Party reject type must be "party_reject"', code: 'MALFORMED' };
  }

  if (typeof raw.requestId !== 'string' || raw.requestId.length < 1 || raw.requestId.length > MAX_STRING_LENGTH) {
    return { ok: false, error: 'requestId must be a non-empty string <= 64 chars', code: 'MALFORMED' };
  }

  if (typeof raw.code !== 'string' || raw.code.length < 1 || raw.code.length > MAX_STRING_LENGTH) {
    return { ok: false, error: 'code must be a non-empty string <= 64 chars', code: 'MALFORMED' };
  }

  if (raw.reason !== undefined && (typeof raw.reason !== 'string' || raw.reason.length > 256)) {
    return { ok: false, error: 'reason must be a string <= 256 chars', code: 'MALFORMED' };
  }

  const validated: ServerPartyReject = {
    type: 'party_reject',
    requestId: raw.requestId,
    code: raw.code,
    ...(typeof raw.reason === 'string' ? { reason: raw.reason } : {}),
  };

  return { ok: true, value: deepFreeze(validated) };
}

export function validatePartyEvent(payload: unknown): ValidationResult<ServerPartyEvent> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Party event must be a non-null object', code: 'MALFORMED' };
  }

  const raw = payload as Record<string, unknown>;
  if (raw.type !== 'party_event') {
    return { ok: false, error: 'Party event type must be "party_event"', code: 'MALFORMED' };
  }

  if (typeof raw.kind !== 'string') {
    return { ok: false, error: 'Party event kind must be a string', code: 'MALFORMED' };
  }

  const validated: ServerPartyEvent = {
    type: 'party_event',
    kind: raw.kind as ServerPartyEvent['kind'],
    ...(typeof raw.partyId === 'string' ? { partyId: raw.partyId } : {}),
    ...(typeof raw.userId === 'string' ? { userId: raw.userId } : {}),
    ...(typeof raw.leaderId === 'string' ? { leaderId: raw.leaderId } : {}),
  };

  return { ok: true, value: deepFreeze(validated) };
}

// ============================================================================
// PARTY ADAPTER CLASS
// ============================================================================

export class PartyAdapter {
  private currentUserId: string | null = null;
  private currentPartyState: Readonly<PartyState> = INITIAL_PARTY_STATE;
  private latestPartySnapshot: Readonly<ServerPartySnapshot> | null = null;
  private lastPartyRejectMsg: Readonly<ServerPartyReject> | null = null;

  // Listeners with strict listener isolation
  private stateListeners = new Set<(state: Readonly<PartyState>) => void>();
  private snapshotListeners = new Set<(snapshot: Readonly<ServerPartySnapshot> | null) => void>();
  private rejectListeners = new Set<(reject: Readonly<ServerPartyReject>) => void>();
  private eventListeners = new Set<(event: Readonly<ServerPartyEvent>) => void>();

  constructor(currentUserId?: string | null) {
    if (currentUserId) {
      this.currentUserId = currentUserId;
    }
  }

  // ============================================================================
  // PUBLIC ACCESSORS (Strictly Read-Only / Server-Authoritative)
  // ============================================================================

  get isAuthoritative(): boolean {
    // Client is NEVER authoritative. Server is always the single source of truth.
    return false;
  }

  get state(): Readonly<PartyState> {
    return this.currentPartyState;
  }

  get partyId(): string | null {
    return this.currentPartyState.partyId;
  }

  get leaderId(): string | null {
    return this.currentPartyState.leaderId;
  }

  get members(): readonly string[] {
    return this.currentPartyState.members;
  }

  get invites(): readonly ServerPartyInvite[] {
    return this.currentPartyState.invites;
  }

  get isInParty(): boolean {
    return this.currentPartyState.isInParty;
  }

  get isLeader(): boolean {
    return this.currentPartyState.isLeader;
  }

  get memberCount(): number {
    return this.currentPartyState.memberCount;
  }

  get latestSnapshot(): Readonly<ServerPartySnapshot> | null {
    return this.latestPartySnapshot;
  }

  get lastReject(): Readonly<ServerPartyReject> | null {
    return this.lastPartyRejectMsg;
  }

  get currentAuthUserId(): string | null {
    return this.currentUserId;
  }

  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
    // Recompute isLeader with current party state
    const isLeader =
      this.currentPartyState.isInParty &&
      this.currentUserId !== null &&
      this.currentPartyState.leaderId === this.currentUserId;

    if (this.currentPartyState.isLeader !== isLeader) {
      this.currentPartyState = deepFreeze({
        ...this.currentPartyState,
        isLeader,
      });
      this.notifyStateListeners();
    }
  }

  isMember(userId: string): boolean {
    return this.currentPartyState.members.includes(userId);
  }

  hasInvite(partyId: string): boolean {
    return this.currentPartyState.invites.some((inv) => inv.partyId === partyId);
  }

  // ============================================================================
  // INGESTION (Authoritative Server State Only)
  // ============================================================================

  applySnapshot(rawSnapshot: unknown): Readonly<ServerPartySnapshot> | null {
    const validation = validatePartySnapshot(rawSnapshot);
    if (!validation.ok || !validation.value) {
      return null;
    }

    const snapshot = validation.value;
    this.latestPartySnapshot = snapshot;

    const isInParty = snapshot.partyId !== null && snapshot.members.length > 0;
    const isLeader =
      isInParty &&
      this.currentUserId !== null &&
      snapshot.leaderId === this.currentUserId;

    this.currentPartyState = deepFreeze({
      partyId: snapshot.partyId,
      leaderId: snapshot.leaderId,
      members: snapshot.members,
      invites: snapshot.invites,
      isInParty,
      isLeader,
      memberCount: snapshot.members.length,
    });

    for (const listener of this.snapshotListeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener isolation: subscriber error must not disrupt adapter
      }
    }

    this.notifyStateListeners();
    return snapshot;
  }

  applyReject(rawReject: unknown): Readonly<ServerPartyReject> | null {
    const validation = validatePartyReject(rawReject);
    if (!validation.ok || !validation.value) {
      return null;
    }

    const reject = validation.value;
    this.lastPartyRejectMsg = reject;

    for (const listener of this.rejectListeners) {
      try {
        listener(reject);
      } catch {
        // Listener isolation
      }
    }

    return reject;
  }

  applyEvent(rawEvent: unknown): Readonly<ServerPartyEvent> | null {
    const validation = validatePartyEvent(rawEvent);
    if (!validation.ok || !validation.value) {
      return null;
    }

    const event = validation.value;
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Listener isolation
      }
    }

    return event;
  }

  handleIncomingMessage(rawMessage: unknown): boolean {
    if (!rawMessage || typeof rawMessage !== 'object') {
      return false;
    }

    const msg = rawMessage as Record<string, unknown>;
    switch (msg.type) {
      case 'party_snapshot':
        return this.applySnapshot(msg) !== null;
      case 'party_reject':
        return this.applyReject(msg) !== null;
      case 'party_event':
        return this.applyEvent(msg) !== null;
      default:
        return false;
    }
  }

  clear(): void {
    this.currentPartyState = INITIAL_PARTY_STATE;
    this.latestPartySnapshot = null;
    this.lastPartyRejectMsg = null;

    for (const listener of this.snapshotListeners) {
      try {
        listener(null);
      } catch {
        // Listener isolation
      }
    }

    this.notifyStateListeners();
  }

  destroy(): void {
    this.clear();
    this.stateListeners.clear();
    this.snapshotListeners.clear();
    this.rejectListeners.clear();
    this.eventListeners.clear();
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  onPartyChange(listener: (state: Readonly<PartyState>) => void): () => void {
    this.stateListeners.add(listener);
    try {
      listener(this.currentPartyState);
    } catch {
      // Listener isolation
    }
    return () => this.stateListeners.delete(listener);
  }

  onPartySnapshot(listener: (snapshot: Readonly<ServerPartySnapshot> | null) => void): () => void {
    this.snapshotListeners.add(listener);
    if (this.latestPartySnapshot) {
      try {
        listener(this.latestPartySnapshot);
      } catch {
        // Listener isolation
      }
    }
    return () => this.snapshotListeners.delete(listener);
  }

  onPartyReject(listener: (reject: Readonly<ServerPartyReject>) => void): () => void {
    this.rejectListeners.add(listener);
    return () => this.rejectListeners.delete(listener);
  }

  onPartyEvent(listener: (event: Readonly<ServerPartyEvent>) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private notifyStateListeners(): void {
    for (const listener of this.stateListeners) {
      try {
        listener(this.currentPartyState);
      } catch {
        // Listener isolation
      }
    }
  }
}
