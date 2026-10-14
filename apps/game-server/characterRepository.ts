import type { SupabaseClient } from '@supabase/supabase-js';

export type CharacterProgress = Readonly<{
  id: string;
  level: number;
  xp: number;
  gold: number;
  checkpoint: string;
  inventory: readonly unknown[];
  updated_at: string;
}>;

export type CharacterProgressWrite = Readonly<{
  level: number;
  xp: number;
  gold: number;
  checkpoint: string;
  inventory: readonly unknown[];
}>;

type ProgressRpcResult = Readonly<{ applied: boolean; progress: CharacterProgress }>;

export class CharacterRepository {
  public constructor(private readonly db: SupabaseClient) {}

  public async load(characterId: string): Promise<CharacterProgress | null> {
    this.assertCharacterId(characterId);
    const { data, error } = await this.db
      .from('characters')
      .select('id,level,xp,gold,checkpoint,inventory,updated_at')
      .eq('id', characterId)
      .maybeSingle();
    if (error) throw new Error(`Character load failed: ${error.message}`);
    return data as CharacterProgress | null;
  }

  public async save(characterId: string, progress: CharacterProgressWrite, idempotencyKey: string): Promise<ProgressRpcResult> {
    this.assertCharacterId(characterId);
    this.assertWrite(progress, idempotencyKey);
    const { data, error } = await this.db.rpc('save_character_progress', {
      p_character_id: characterId,
      p_level: progress.level,
      p_xp: progress.xp,
      p_gold: progress.gold,
      p_checkpoint: progress.checkpoint,
      p_inventory: progress.inventory,
      p_idempotency_key: idempotencyKey
    });
    if (error) throw new Error(`Character save failed: ${error.message}`);
    return data as ProgressRpcResult;
  }

  private assertCharacterId(value: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid character id');
  }

  private assertWrite(progress: CharacterProgressWrite, idempotencyKey: string): void {
    if (!Number.isInteger(progress.level) || progress.level < 1 || progress.level > 99) throw new Error('Invalid level');
    if (!Number.isInteger(progress.xp) || progress.xp < 0) throw new Error('Invalid xp');
    if (!Number.isInteger(progress.gold) || progress.gold < 0) throw new Error('Invalid gold');
    if (typeof progress.checkpoint !== 'string' || progress.checkpoint.trim() === '') throw new Error('Invalid checkpoint');
    if (!Array.isArray(progress.inventory)) throw new Error('Invalid inventory');
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '' || idempotencyKey.length > 128) throw new Error('Invalid idempotency key');
  }
}
