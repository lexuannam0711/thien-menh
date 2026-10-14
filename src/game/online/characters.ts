import type { SupabaseClient } from '@supabase/supabase-js';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export const DEFAULT_CHARACTER_NAME = 'Hiệp Sĩ';

export interface CharacterRow {
  readonly id: string;
  readonly user_id: string;
  readonly name: string;
}

export class CharacterLifecycleError extends Error {
  constructor(message = 'Không thể tải thông tin nhân vật. Vui lòng thử lại.') {
    super(message);
    this.name = 'CharacterLifecycleError';
  }
}

export interface GetOrCreateCharacterOptions {
  readonly name?: string;
}

function validateCharacterRow(data: unknown, expectedUserId: string): CharacterRow {
  if (!data || typeof data !== 'object') {
    throw new CharacterLifecycleError('Dữ liệu nhân vật không hợp lệ.');
  }
  const row = data as Record<string, unknown>;
  if (!isValidUuid(row.id)) {
    throw new CharacterLifecycleError('Mã nhận diện nhân vật không hợp lệ.');
  }
  if (row.user_id !== expectedUserId) {
    throw new CharacterLifecycleError('Nhân vật không thuộc quyền sở hữu của tài khoản.');
  }
  if (typeof row.name !== 'string' || row.name.trim().length < 2 || row.name.trim().length > 20) {
    throw new CharacterLifecycleError('Tên nhân vật không hợp lệ.');
  }
  return Object.freeze({
    id: row.id,
    user_id: row.user_id,
    name: row.name.trim(),
  });
}

/**
 * Query or create character for an authenticated user.
 * - Queries characters by user_id
 * - If absent, inserts { user_id, name } with strictly no authority fields
 * - Handles race conditions (concurrent creates) by re-querying on unique constraint conflicts (23505)
 * - Fails closed on invalid UUIDs or corrupted rows without leaking DB internals
 */
export async function getOrCreateCharacter(
  client: SupabaseClient | null | undefined,
  userId: string,
  options?: GetOrCreateCharacterOptions
): Promise<CharacterRow> {
  if (!client) {
    throw new CharacterLifecycleError('Chế độ ngoại tuyến: chưa cấu hình kết nối máy chủ.');
  }

  if (!isValidUuid(userId)) {
    throw new CharacterLifecycleError('Mã tài khoản không hợp lệ.');
  }

  const rawName = options?.name?.trim();
  const characterName = rawName && rawName.length >= 2 && rawName.length <= 20
    ? rawName
    : DEFAULT_CHARACTER_NAME;

  // 1. Query characters table by own user_id
  try {
    const { data, error } = await client
      .from('characters')
      .select('id, user_id, name')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new CharacterLifecycleError();
    }

    if (data) {
      return validateCharacterRow(data, userId);
    }
  } catch (err) {
    if (err instanceof CharacterLifecycleError) throw err;
    throw new CharacterLifecycleError();
  }

  // 2. Character absent -> insert with strictly { user_id, name }
  const insertPayload = {
    user_id: userId,
    name: characterName,
  };

  try {
    const { data: inserted, error: insertError } = await client
      .from('characters')
      .insert(insertPayload)
      .select('id, user_id, name')
      .single();

    if (insertError) {
      // 3. Race condition handling: re-query after unique constraint conflict (23505)
      const errCode = (insertError as { code?: string }).code;
      const errMsg = `${(insertError as { message?: string }).message || ''} ${(insertError as { details?: string }).details || ''}`.toLowerCase();
      const isUniqueConflict = errCode === '23505' || errMsg.includes('duplicate key') || errMsg.includes('unique constraint') || errMsg.includes('already exists');

      if (isUniqueConflict) {
        const { data: retryData, error: retryError } = await client
          .from('characters')
          .select('id, user_id, name')
          .eq('user_id', userId)
          .maybeSingle();

        if (retryError || !retryData) {
          throw new CharacterLifecycleError();
        }
        return validateCharacterRow(retryData, userId);
      }

      throw new CharacterLifecycleError();
    }

    if (!inserted) {
      throw new CharacterLifecycleError();
    }

    return validateCharacterRow(inserted, userId);
  } catch (err) {
    if (err instanceof CharacterLifecycleError) throw err;
    throw new CharacterLifecycleError();
  }
}
