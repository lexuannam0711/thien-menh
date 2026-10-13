export type GraphicsQuality = 'low' | 'medium' | 'high';
export interface GraphicsState { readonly quality: GraphicsQuality; readonly reducedMotion: boolean; }
interface GraphicsStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export const GRAPHICS_STORAGE_KEY = 'than-menh-graphics-v1';

export function normalizeGraphicsSettings(value: unknown): Readonly<GraphicsState> {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const quality = candidate.quality === 'low' || candidate.quality === 'high' ? candidate.quality : 'medium';
  return Object.freeze({ quality, reducedMotion: candidate.reducedMotion === true });
}

export function getGraphicsBudget(state: GraphicsState) {
  return Object.freeze({
    ambientParticles: state.reducedMotion || state.quality === 'low' ? 0 : state.quality === 'high' ? 24 : 10,
    combatSparks: state.reducedMotion ? 0 : state.quality === 'high' ? 8 : state.quality === 'medium' ? 4 : 1,
    cameraShake: !state.reducedMotion && state.quality !== 'low',
  });
}

function safeStorage(): GraphicsStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch { return null; }
}

export class GraphicsSettings {
  private state: Readonly<GraphicsState>;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly storage: GraphicsStorage | null = safeStorage()) {
    try { this.state = normalizeGraphicsSettings(JSON.parse(storage?.getItem(GRAPHICS_STORAGE_KEY) ?? 'null')); }
    catch { this.state = normalizeGraphicsSettings(null); }
  }
  getState(): Readonly<GraphicsState> { return this.state; }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  setQuality(quality: unknown): boolean {
    if (quality !== 'low' && quality !== 'medium' && quality !== 'high') return false;
    return this.save({ ...this.state, quality });
  }
  setReducedMotion(reducedMotion: unknown): boolean {
    if (typeof reducedMotion !== 'boolean') return false;
    return this.save({ ...this.state, reducedMotion });
  }
  getBudget() {
    const systemReducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return getGraphicsBudget({ ...this.state, reducedMotion: this.state.reducedMotion || systemReducedMotion });
  }
  private save(state: GraphicsState): boolean {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
    try {
      if (!this.storage) return false;
      this.storage.setItem(GRAPHICS_STORAGE_KEY, JSON.stringify(this.state));
      return true;
    } catch { return false; }
  }
}

export const graphicsSettings = new GraphicsSettings();
