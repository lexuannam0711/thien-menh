/**
 * Trình quản lý Âm thanh Web Audio (WebAudio Manager)
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Tính năng chính:
 * - Trình quản lý WebAudio tối giản, an toàn trên trình duyệt và môi trường không có AudioContext.
 * - Cơ chế mở khóa (unlock) an toàn khi người dùng tương tác lần đầu.
 * - Quản lý tắt tiếng tổng (master mute) và âm lượng tổng (master volume).
 * - Giới hạn số lượng hiệu ứng đồng thời (bounded SFX concurrency) với cơ chế tái sử dụng/cắt giảm giọng cũ.
 * - Danh mục âm thanh chiến đấu và giao diện (named combat & UI cues) tổng hợp từ dao động sóng (procedural synthesis),
 *   hoàn toàn không cần tài nguyên âm thanh ngoài hay thư viện phụ thuộc.
 * - Móc nối tương thích lưu trữ cài đặt (persistence-compatible settings hooks), đồng bộ với SettingsModel / SoundManagerLike.
 * - Cấu hình bất biến (immutable config).
 */

export type OscillatorShape = 'sine' | 'square' | 'triangle' | 'sawtooth';

export interface CuePitchPoint {
  readonly timeOffset: number; // Thời gian tính bằng giây từ lúc bắt đầu
  readonly frequency: number;  // Tần số Hz
  readonly curve?: 'linear' | 'exponential' | 'instant';
}

export interface CueGainPoint {
  readonly timeOffset: number; // Thời gian tính bằng giây từ lúc bắt đầu
  readonly gain: number;       // Biên độ 0..1
  readonly curve?: 'linear' | 'exponential';
}

export interface CueLayerDefinition {
  readonly shape: OscillatorShape;
  readonly startFrequency: number;
  readonly duration: number; // Thời lượng tính bằng giây
  readonly initialGain?: number;
  readonly pitchPoints?: readonly CuePitchPoint[];
  readonly gainPoints?: readonly CueGainPoint[];
  readonly delay?: number; // Độ trễ tính bằng giây
  readonly detune?: number; // Cents
}

export interface CueDefinition {
  readonly id: string;
  readonly category: 'combat' | 'ui' | 'system';
  readonly description: string;
  readonly defaultVolume?: number; // Tỉ lệ 0..1 (mặc định: 1.0)
  readonly layers: readonly CueLayerDefinition[];
}

export type CombatCueName =
  | 'sword_slash'
  | 'hit_impact'
  | 'player_hurt'
  | 'dodge'
  | 'skill_earth'
  | 'skill_flame'
  | 'boss_roar'
  | 'boss_impact'
  | 'item_pickup'
  | 'victory'
  | 'defeat';

export type UICueName =
  | 'ui_click'
  | 'ui_confirm'
  | 'ui_cancel'
  | 'ui_open'
  | 'ui_close'
  | 'menu_select';

export type AudioCueName = CombatCueName | UICueName;

export type MusicContext =
  | 'menu'
  | 'village'
  | 'forest'
  | 'swamp'
  | 'mountain'
  | 'combat'
  | 'boss'
  | 'final-boss'
  | 'victory'
  | 'ending';

export interface PlayCueOptions {
  volume?: number;          // Hệ số âm lượng (0..1)
  pitchMultiplier?: number; // Hệ số tần số (mặc định 1.0)
  priority?: number;        // Độ ưu tiên (cao hơn = ít bị ngắt hơn)
}

export interface ActiveVoice {
  readonly id: number;
  readonly cueName: string;
  readonly startTime: number;
  readonly estimatedEndTime: number;
  readonly priority: number;
  stop(): void;
}

export interface AudioSettingsSnapshot {
  readonly muted: boolean;
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface SoundManagerLike {
  mute: boolean;
}

export type AudioContextStateLike = 'suspended' | 'running' | 'closed';

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): AudioParamLike | void;
  linearRampToValueAtTime(value: number, endTime: number): AudioParamLike | void;
  exponentialRampToValueAtTime(value: number, endTime: number): AudioParamLike | void;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): AudioNodeLike | void;
  disconnect(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: OscillatorType;
  readonly frequency: AudioParamLike;
  detune?: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
  onended: ((this: OscillatorNodeLike, ev: Event | unknown) => unknown) | null;
}

export interface AudioContextLike {
  readonly state: AudioContextStateLike;
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
  resume(): Promise<void>;
  close?(): Promise<void>;
}

export interface AudioManagerConfig {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly initialMuted: boolean;
  readonly maxConcurrency: number;
  readonly autoUnlockOnInteraction: boolean;
  readonly customAudioContext?: AudioContextLike | null;
}

export const DEFAULT_AUDIO_CONFIG: Readonly<AudioManagerConfig> = Object.freeze({
  masterVolume: 0.8,
  musicVolume: 1.0,
  sfxVolume: 1.0,
  initialMuted: false,
  maxConcurrency: 6,
  autoUnlockOnInteraction: true,
  customAudioContext: null,
});

export const AUDIO_STORAGE_KEY = 'than-menh-audio-settings-v1';

/**
 * Danh mục hiệu ứng âm thanh thuần tổng hợp (Procedural Sound Registry).
 * Không sử dụng tệp âm thanh bên ngoài, âm thanh được sinh động học từ sóng WebAudio.
 */
export const BUILTIN_CUES: Readonly<Record<AudioCueName, CueDefinition>> = {
  // --- UI Cues ---
  ui_click: {
    id: 'ui_click',
    category: 'ui',
    description: 'Tiếng nhấp chuột / nhấn nút nhanh gọn',
    defaultVolume: 0.45,
    layers: [
      {
        shape: 'triangle',
        startFrequency: 900,
        duration: 0.04,
        initialGain: 0.7,
        pitchPoints: [
          { timeOffset: 0.04, frequency: 1300, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.04, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  ui_confirm: {
    id: 'ui_confirm',
    category: 'ui',
    description: 'Tiếng chuông đồng vang xác nhận lựa chọn menu',
    defaultVolume: 0.6,
    layers: [
      {
        shape: 'sine',
        startFrequency: 523.25, // Đô C5
        duration: 0.16,
        initialGain: 0.8,
        pitchPoints: [
          { timeOffset: 0.16, frequency: 523.25, curve: 'linear' as const },
        ],
        gainPoints: [
          { timeOffset: 0.16, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'triangle',
        startFrequency: 659.25, // Mi E5
        duration: 0.22,
        delay: 0.04,
        initialGain: 0.7,
        pitchPoints: [
          { timeOffset: 0.22, frequency: 659.25, curve: 'linear' as const },
        ],
        gainPoints: [
          { timeOffset: 0.22, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  ui_cancel: {
    id: 'ui_cancel',
    category: 'ui',
    description: 'Âm thanh trầm hủy bỏ / đóng menu',
    defaultVolume: 0.5,
    layers: [
      {
        shape: 'sine',
        startFrequency: 440,
        duration: 0.1,
        initialGain: 0.7,
        pitchPoints: [
          { timeOffset: 0.1, frequency: 220, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.1, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  ui_open: {
    id: 'ui_open',
    category: 'ui',
    description: 'Âm thanh mở hộp thoại / khung hành trang',
    defaultVolume: 0.5,
    layers: [
      {
        shape: 'sine',
        startFrequency: 300,
        duration: 0.09,
        initialGain: 0.6,
        pitchPoints: [
          { timeOffset: 0.09, frequency: 600, curve: 'linear' as const },
        ],
        gainPoints: [
          { timeOffset: 0.09, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  ui_close: {
    id: 'ui_close',
    category: 'ui',
    description: 'Âm thanh đóng hộp thoại / quay lại',
    defaultVolume: 0.5,
    layers: [
      {
        shape: 'sine',
        startFrequency: 580,
        duration: 0.09,
        initialGain: 0.6,
        pitchPoints: [
          { timeOffset: 0.09, frequency: 260, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.09, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  menu_select: {
    id: 'menu_select',
    category: 'ui',
    description: 'Âm thanh di chuyển con trỏ giữa các mục menu',
    defaultVolume: 0.4,
    layers: [
      {
        shape: 'triangle',
        startFrequency: 800,
        duration: 0.03,
        initialGain: 0.5,
        pitchPoints: [
          { timeOffset: 0.03, frequency: 1000, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.03, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  // --- Combat Cues ---
  sword_slash: {
    id: 'sword_slash',
    category: 'combat',
    description: 'Tiếng vung kiếm xé gió sắc lẹm',
    defaultVolume: 0.7,
    layers: [
      {
        shape: 'sawtooth',
        startFrequency: 520,
        duration: 0.11,
        initialGain: 0.8,
        pitchPoints: [
          { timeOffset: 0.11, frequency: 110, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.11, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'triangle',
        startFrequency: 300,
        duration: 0.07,
        initialGain: 0.5,
        pitchPoints: [
          { timeOffset: 0.07, frequency: 80, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.07, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  hit_impact: {
    id: 'hit_impact',
    category: 'combat',
    description: 'Tiếng va chạm đao kiếm trúng mục tiêu',
    defaultVolume: 0.85,
    layers: [
      {
        shape: 'square',
        startFrequency: 180,
        duration: 0.12,
        initialGain: 0.9,
        pitchPoints: [
          { timeOffset: 0.12, frequency: 45, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.12, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'triangle',
        startFrequency: 350,
        duration: 0.09,
        initialGain: 0.6,
        pitchPoints: [
          { timeOffset: 0.09, frequency: 80, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.09, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  player_hurt: {
    id: 'player_hurt',
    category: 'combat',
    description: 'Âm thanh nhân vật nhận sát thương',
    defaultVolume: 0.8,
    layers: [
      {
        shape: 'sawtooth',
        startFrequency: 150,
        duration: 0.18,
        initialGain: 0.85,
        pitchPoints: [
          { timeOffset: 0.18, frequency: 45, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.18, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  dodge: {
    id: 'dodge',
    category: 'combat',
    description: 'Tiếng gió lướt thân né đòn chớp nhoáng',
    defaultVolume: 0.65,
    layers: [
      {
        shape: 'sine',
        startFrequency: 320,
        duration: 0.11,
        initialGain: 0.7,
        pitchPoints: [
          { timeOffset: 0.05, frequency: 680, curve: 'linear' as const },
          { timeOffset: 0.11, frequency: 280, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.11, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  skill_earth: {
    id: 'skill_earth',
    category: 'combat',
    description: 'Thần lực Thổ — Rung chấn mặt đất, khiên hộ thân',
    defaultVolume: 0.9,
    layers: [
      {
        shape: 'triangle',
        startFrequency: 85,
        duration: 0.32,
        initialGain: 0.9,
        pitchPoints: [
          { timeOffset: 0.32, frequency: 32, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.32, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'sine',
        startFrequency: 130,
        duration: 0.22,
        initialGain: 0.75,
        pitchPoints: [
          { timeOffset: 0.22, frequency: 45, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.22, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  skill_flame: {
    id: 'skill_flame',
    category: 'combat',
    description: 'Thần lực Hỏa — Tiếng phóng hỏa cầu thiêu đốt',
    defaultVolume: 0.85,
    layers: [
      {
        shape: 'sawtooth',
        startFrequency: 240,
        duration: 0.24,
        initialGain: 0.8,
        pitchPoints: [
          { timeOffset: 0.12, frequency: 650, curve: 'linear' as const },
          { timeOffset: 0.24, frequency: 180, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.24, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'triangle',
        startFrequency: 400,
        duration: 0.18,
        initialGain: 0.6,
        pitchPoints: [
          { timeOffset: 0.18, frequency: 800, curve: 'linear' as const },
        ],
        gainPoints: [
          { timeOffset: 0.18, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  boss_roar: {
    id: 'boss_roar',
    category: 'combat',
    description: 'Tiếng gầm uy phong chấn động của Thủ lĩnh Hổ Yêu',
    defaultVolume: 0.95,
    layers: [
      {
        shape: 'sawtooth',
        startFrequency: 75,
        duration: 0.45,
        initialGain: 0.9,
        pitchPoints: [
          { timeOffset: 0.2, frequency: 110, curve: 'linear' as const },
          { timeOffset: 0.45, frequency: 38, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.45, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'square',
        startFrequency: 55,
        duration: 0.4,
        detune: 15,
        initialGain: 0.7,
        pitchPoints: [
          { timeOffset: 0.4, frequency: 28, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.4, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  boss_impact: {
    id: 'boss_impact',
    category: 'combat',
    description: 'Cú đập mặt đất cực nặng của Trùm',
    defaultVolume: 1.0,
    layers: [
      {
        shape: 'square',
        startFrequency: 120,
        duration: 0.35,
        initialGain: 0.95,
        pitchPoints: [
          { timeOffset: 0.35, frequency: 30, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.35, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  item_pickup: {
    id: 'item_pickup',
    category: 'combat',
    description: 'Tiếng ngọc quý / đá thần khí phát sáng khi nhặt đồ',
    defaultVolume: 0.7,
    layers: [
      {
        shape: 'sine',
        startFrequency: 880,
        duration: 0.15,
        initialGain: 0.75,
        pitchPoints: [
          { timeOffset: 0.07, frequency: 1174.66, curve: 'linear' as const },
          { timeOffset: 0.15, frequency: 1760, curve: 'linear' as const },
        ],
        gainPoints: [
          { timeOffset: 0.15, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  victory: {
    id: 'victory',
    category: 'combat',
    description: 'Âm sắc chiêng đồng ngũ cung Văn Lang khải hoàn',
    defaultVolume: 0.85,
    layers: [
      {
        shape: 'sine',
        startFrequency: 523.25, // C5
        duration: 0.25,
        initialGain: 0.7,
        gainPoints: [
          { timeOffset: 0.25, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'sine',
        startFrequency: 659.25, // E5
        duration: 0.25,
        delay: 0.1,
        initialGain: 0.7,
        gainPoints: [
          { timeOffset: 0.25, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'sine',
        startFrequency: 783.99, // G5
        duration: 0.25,
        delay: 0.2,
        initialGain: 0.7,
        gainPoints: [
          { timeOffset: 0.25, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'triangle',
        startFrequency: 1046.5, // C6
        duration: 0.35,
        delay: 0.3,
        initialGain: 0.85,
        gainPoints: [
          { timeOffset: 0.35, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },

  defeat: {
    id: 'defeat',
    category: 'combat',
    description: 'Âm sắc chuông trầm u buồn khi gục ngã',
    defaultVolume: 0.75,
    layers: [
      {
        shape: 'sine',
        startFrequency: 392, // G4
        duration: 0.2,
        initialGain: 0.7,
        gainPoints: [
          { timeOffset: 0.2, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'sine',
        startFrequency: 349.23, // F4
        duration: 0.2,
        delay: 0.15,
        initialGain: 0.7,
        gainPoints: [
          { timeOffset: 0.2, gain: 0.001, curve: 'exponential' as const },
        ],
      },
      {
        shape: 'sine',
        startFrequency: 293.66, // D4
        duration: 0.35,
        delay: 0.3,
        initialGain: 0.8,
        pitchPoints: [
          { timeOffset: 0.35, frequency: 220, curve: 'exponential' as const },
        ],
        gainPoints: [
          { timeOffset: 0.35, gain: 0.001, curve: 'exponential' as const },
        ],
      },
    ],
  },
};

// Đóng băng đệ quy toàn bộ danh mục âm thanh mặc định
for (const cue of Object.values(BUILTIN_CUES)) {
  for (const layer of cue.layers) {
    if (layer.pitchPoints) Object.freeze(layer.pitchPoints);
    if (layer.gainPoints) Object.freeze(layer.gainPoints);
    Object.freeze(layer);
  }
  Object.freeze(cue.layers);
  Object.freeze(cue);
}
Object.freeze(BUILTIN_CUES);

const MUSIC_MOTIFS: Readonly<Record<MusicContext, readonly number[]>> = Object.freeze({
  menu: [261.63, 329.63, 392, 523.25],
  village: [293.66, 349.23, 440, 349.23],
  forest: [220, 261.63, 329.63, 261.63],
  swamp: [196, 233.08, 293.66, 233.08],
  mountain: [246.94, 329.63, 392, 329.63],
  combat: [293.66, 392, 493.88, 392],
  boss: [146.83, 174.61, 220, 174.61],
  'final-boss': [110, 146.83, 164.81, 146.83],
  victory: [392, 493.88, 587.33, 783.99],
  ending: [261.63, 329.63, 392, 659.25],
});

function createMusicCue(context: MusicContext): CueDefinition {
  const notes = MUSIC_MOTIFS[context];
  return Object.freeze({
    id: `music_${context}`,
    category: 'system',
    description: `Procedural ${context} music motif`,
    defaultVolume: 0.22,
    layers: [{
      shape: (context === 'boss' || context === 'final-boss' ? 'sawtooth' : 'triangle') as OscillatorShape,
      startFrequency: notes[0],
      duration: 0.62,
      initialGain: 0.35,
      pitchPoints: [{ timeOffset: 0.62, frequency: notes[1], curve: 'linear' as const }],
      gainPoints: [{ timeOffset: 0.62, gain: 0.001, curve: 'exponential' as const }],
    }],
  });
}

const MUSIC_CUES: Readonly<Record<MusicContext, CueDefinition>> = Object.freeze(
  Object.fromEntries(Object.keys(MUSIC_MOTIFS).map((context) => [context, createMusicCue(context as MusicContext)])) as Record<MusicContext, CueDefinition>,
);

/**
 * Trình giả lập Mock Audio Context đơn giản phục vụ kiểm tra tự động và môi trường không có WebAudio.
 */
export function createMockAudioContext(): AudioContextLike & {
  readonly createdGains: Array<GainNodeLike & { connections: AudioNodeLike[]; isDisconnected: boolean }>;
  readonly createdOscillators: Array<OscillatorNodeLike & { connections: AudioNodeLike[]; isDisconnected: boolean }>;
} {
  let currentTimeVal = 0;
  let stateVal: AudioContextStateLike = 'suspended';

  const mockDestination: AudioNodeLike = {
    connect: () => {},
    disconnect: () => {},
  };

  const createParam = (initial = 1): AudioParamLike => {
    let paramVal = initial;
    return {
      get value(): number {
        return paramVal;
      },
      set value(val: number) {
        paramVal = val;
      },
      setValueAtTime(val: number) {
        paramVal = val;
      },
      linearRampToValueAtTime(val: number) {
        paramVal = val;
      },
      exponentialRampToValueAtTime(val: number) {
        paramVal = val;
      },
    };
  };

  const createdGains: Array<GainNodeLike & { connections: AudioNodeLike[]; isDisconnected: boolean }> = [];
  const createdOscillators: Array<OscillatorNodeLike & { connections: AudioNodeLike[]; isDisconnected: boolean }> = [];

  return {
    get state() {
      return stateVal;
    },
    get currentTime() {
      currentTimeVal += 0.01;
      return currentTimeVal;
    },
    destination: mockDestination,
    get createdGains() {
      return createdGains;
    },
    get createdOscillators() {
      return createdOscillators;
    },
    createGain(): GainNodeLike & { connections: AudioNodeLike[]; isDisconnected: boolean } {
      const gainParam = createParam(1);
      const connections: AudioNodeLike[] = [];
      let isDisconnected = false;
      const node = {
        gain: gainParam,
        get connections() {
          return connections;
        },
        get isDisconnected() {
          return isDisconnected;
        },
        connect(destination: AudioNodeLike) {
          connections.push(destination);
          isDisconnected = false;
          return destination;
        },
        disconnect() {
          connections.length = 0;
          isDisconnected = true;
        },
      };
      createdGains.push(node);
      return node;
    },
    createOscillator(): OscillatorNodeLike & { connections: AudioNodeLike[]; isDisconnected: boolean } {
      const freqParam = createParam(440);
      const connections: AudioNodeLike[] = [];
      let isDisconnected = false;
      const node = {
        type: 'sine' as OscillatorType,
        frequency: freqParam,
        detune: createParam(0),
        get connections() {
          return connections;
        },
        get isDisconnected() {
          return isDisconnected;
        },
        start: () => {},
        stop: () => {},
        connect: (destination: AudioNodeLike) => {
          connections.push(destination);
          isDisconnected = false;
          return destination;
        },
        disconnect: () => {
          connections.length = 0;
          isDisconnected = true;
        },
        onended: null,
      };
      createdOscillators.push(node);
      return node;
    },
    resume(): Promise<void> {
      stateVal = 'running';
      return Promise.resolve();
    },
    close(): Promise<void> {
      stateVal = 'closed';
      return Promise.resolve();
    },
  };
}

/**
 * Phát hiện hàm khởi tạo AudioContext an toàn trên trình duyệt mà không gây ngoại lệ.
 */
function resolveAudioContextConstructor(): (new () => AudioContextLike) | null {
  try {
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        AudioContext?: new () => AudioContextLike;
        webkitAudioContext?: new () => AudioContextLike;
      };
      return win.AudioContext || win.webkitAudioContext || null;
    }
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as unknown as {
        AudioContext?: new () => AudioContextLike;
        webkitAudioContext?: new () => AudioContextLike;
      };
      return g.AudioContext || g.webkitAudioContext || null;
    }
  } catch {
    // Không cho phép lỗi thoát ra ngoài
  }
  return null;
}

/**
 * Trình quản lý Âm thanh Web Audio độc lập (AudioManager).
 */
export class AudioManager implements SoundManagerLike {
  public readonly config: Readonly<AudioManagerConfig>;
  private readonly ctx: AudioContextLike | null = null;
  private readonly masterGainNode: GainNodeLike | null = null;
  private readonly musicGainNode: GainNodeLike | null = null;
  private readonly sfxGainNode: GainNodeLike | null = null;
  private readonly cues: Map<string, CueDefinition> = new Map();
  private readonly activeVoices: Map<number, ActiveVoice> = new Map();
  private readonly muteListeners: Set<(muted: boolean) => void> = new Set();
  private readonly volumeListeners: Set<(volume: number) => void> = new Set();

  private muted: boolean;
  private masterVolume: number;
  private musicVolume: number;
  private sfxVolume: number;
  private unlocked = false;
  private voiceSequence = 0;
  private cleanupAutoUnlock: (() => void) | null = null;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private musicContext: MusicContext | null = null;
  private musicStep = 0;
  private readonly musicVoices = new Set<ActiveVoice>();

  constructor(partialConfig?: Partial<AudioManagerConfig>) {
    // 1. Tạo cấu hình bất biến (Immutable Config)
    const merged: AudioManagerConfig = {
      masterVolume: typeof partialConfig?.masterVolume === 'number' && Number.isFinite(partialConfig.masterVolume)
        ? Math.max(0, Math.min(1, partialConfig.masterVolume))
        : DEFAULT_AUDIO_CONFIG.masterVolume,
      musicVolume: typeof partialConfig?.musicVolume === 'number' && Number.isFinite(partialConfig.musicVolume)
        ? Math.max(0, Math.min(1, partialConfig.musicVolume))
        : DEFAULT_AUDIO_CONFIG.musicVolume,
      sfxVolume: typeof partialConfig?.sfxVolume === 'number' && Number.isFinite(partialConfig.sfxVolume)
        ? Math.max(0, Math.min(1, partialConfig.sfxVolume))
        : DEFAULT_AUDIO_CONFIG.sfxVolume,
      initialMuted: typeof partialConfig?.initialMuted === 'boolean'
        ? partialConfig.initialMuted
        : DEFAULT_AUDIO_CONFIG.initialMuted,
      maxConcurrency: typeof partialConfig?.maxConcurrency === 'number' && partialConfig.maxConcurrency > 0
        ? Math.floor(partialConfig.maxConcurrency)
        : DEFAULT_AUDIO_CONFIG.maxConcurrency,
      autoUnlockOnInteraction: typeof partialConfig?.autoUnlockOnInteraction === 'boolean'
        ? partialConfig.autoUnlockOnInteraction
        : DEFAULT_AUDIO_CONFIG.autoUnlockOnInteraction,
      customAudioContext: partialConfig?.customAudioContext ?? null,
    };
    this.config = Object.freeze(merged);

    this.muted = this.config.initialMuted;
    this.masterVolume = this.config.masterVolume;
    this.musicVolume = this.config.musicVolume;
    this.sfxVolume = this.config.sfxVolume;

    // 2. Khởi tạo danh mục âm thanh mặc định
    for (const [name, cue] of Object.entries(BUILTIN_CUES)) {
      this.cues.set(name, cue);
    }
    for (const [name, cue] of Object.entries(MUSIC_CUES)) {
      this.cues.set(`music_${name}`, cue);
    }

    // 3. Khởi tạo AudioContext an toàn
    if (this.config.customAudioContext) {
      this.ctx = this.config.customAudioContext;
    } else {
      const Ctor = resolveAudioContextConstructor();
      if (Ctor) {
        try {
          this.ctx = new Ctor();
        } catch {
          this.ctx = null;
        }
      }
    }

    // 4. Tạo Master Gain Node và 2 Channel Gain Nodes kết nối vào Master
    if (this.ctx) {
      try {
        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.connect(this.ctx.destination);
        this.applyMasterGain();

        this.musicGainNode = this.ctx.createGain();
        this.musicGainNode.connect(this.masterGainNode);
        this.applyMusicGain();

        this.sfxGainNode = this.ctx.createGain();
        this.sfxGainNode.connect(this.masterGainNode);
        this.applySfxGain();
      } catch {
        this.masterGainNode = null;
        this.musicGainNode = null;
        this.sfxGainNode = null;
      }
    }

    // 5. Đăng ký lắng nghe tương tác đầu tiên để unlock
    if (this.config.autoUnlockOnInteraction && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this.setupAutoUnlock();
    }
  }

  /**
   * Khả năng tương thích giao diện SoundManagerLike (cho SettingsModel syncSound).
   */
  get mute(): boolean {
    return this.muted;
  }

  set mute(value: boolean) {
    this.setMuted(value);
  }

  /**
   * Kiểm tra xem AudioContext có khả dụng trên môi trường hiện tại không.
   */
  isSupported(): boolean {
    return this.ctx !== null;
  }

  /**
   * Kiểm tra AudioContext đã được mở khóa âm thanh chưa.
   */
  isUnlocked(): boolean {
    if (!this.ctx) return false;
    return this.unlocked || this.ctx.state === 'running';
  }

  /**
   * Mở khóa AudioContext khi có tương tác người dùng.
   * Luôn an toàn, không ném lỗi ra ngoài.
   */
  async unlock(): Promise<boolean> {
    if (!this.ctx) return false;
    if (this.ctx.state === 'running') {
      this.unlocked = true;
      return true;
    }
    try {
      await this.ctx.resume();
      this.unlocked = (this.ctx.state as string) === 'running';
      return this.unlocked;
    } catch {
      return false;
    }
  }

  private setupAutoUnlock(): void {
    const handleInteraction = () => {
      void this.unlock();
      if (this.cleanupAutoUnlock) {
        this.cleanupAutoUnlock();
        this.cleanupAutoUnlock = null;
      }
    };

    const win = window;
    const opts = { capture: true, passive: true, once: true };
    win.addEventListener('pointerdown', handleInteraction, opts);
    win.addEventListener('keydown', handleInteraction, opts);
    win.addEventListener('touchstart', handleInteraction, opts);

    this.cleanupAutoUnlock = () => {
      win.removeEventListener('pointerdown', handleInteraction, opts);
      win.removeEventListener('keydown', handleInteraction, opts);
      win.removeEventListener('touchstart', handleInteraction, opts);
    };
  }

  // --- Quản lý Mute & Âm lượng ---

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): boolean {
    const normalized = Boolean(muted);
    if (this.muted === normalized) return this.muted;

    this.muted = normalized;
    this.applyMasterGain();
    this.notifyMuteListeners();
    return this.muted;
  }

  toggleMute(): boolean {
    return this.setMuted(!this.muted);
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMasterVolume(volume: number): number {
    if (typeof volume !== 'number' || !Number.isFinite(volume)) {
      return this.masterVolume;
    }
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.masterVolume === clamped) return this.masterVolume;

    this.masterVolume = clamped;
    this.applyMasterGain();
    this.notifyVolumeListeners();
    return this.masterVolume;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setMusicVolume(volume: number): number {
    if (typeof volume !== 'number' || !Number.isFinite(volume)) {
      return this.musicVolume;
    }
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.musicVolume === clamped) return this.musicVolume;

    this.musicVolume = clamped;
    this.applyMusicGain();
    return this.musicVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setSfxVolume(volume: number): number {
    if (typeof volume !== 'number' || !Number.isFinite(volume)) {
      return this.sfxVolume;
    }
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.sfxVolume === clamped) return this.sfxVolume;

    this.sfxVolume = clamped;
    this.applySfxGain();
    return this.sfxVolume;
  }

  private applyMasterGain(): void {
    if (!this.masterGainNode || !this.ctx) return;
    try {
      const targetGain = this.muted ? 0 : this.masterVolume;
      const t = this.ctx.currentTime;
      this.masterGainNode.gain.setValueAtTime(targetGain, t);
    } catch {
      // Bỏ qua lỗi param khi context ở trạng thái đặc biệt
    }
  }

  private applyMusicGain(): void {
    if (!this.musicGainNode || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this.musicGainNode.gain.setValueAtTime(this.musicVolume, t);
    } catch {
      // Bỏ qua
    }
  }

  private applySfxGain(): void {
    if (!this.sfxGainNode || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, t);
    } catch {
      // Bỏ qua
    }
  }

  // --- Móc nối cài đặt (Settings Hooks) ---

  getSettingsSnapshot(): AudioSettingsSnapshot {
    return {
      muted: this.muted,
      masterVolume: this.masterVolume,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
    };
  }

  syncFromSettings(settings?: {
    muted?: boolean;
    masterVolume?: number;
    musicVolume?: number;
    sfxVolume?: number;
  } | null): void {
    if (!settings || typeof settings !== 'object') return;
    if (typeof settings.muted === 'boolean') {
      this.setMuted(settings.muted);
    }
    if (typeof settings.masterVolume === 'number' && Number.isFinite(settings.masterVolume)) {
      this.setMasterVolume(settings.masterVolume);
    }
    if (typeof settings.musicVolume === 'number' && Number.isFinite(settings.musicVolume)) {
      this.setMusicVolume(settings.musicVolume);
    }
    if (typeof settings.sfxVolume === 'number' && Number.isFinite(settings.sfxVolume)) {
      this.setSfxVolume(settings.sfxVolume);
    }
  }

  onMuteChange(listener: (muted: boolean) => void): () => void {
    this.muteListeners.add(listener);
    return () => {
      this.muteListeners.delete(listener);
    };
  }

  onVolumeChange(listener: (volume: number) => void): () => void {
    this.volumeListeners.add(listener);
    return () => {
      this.volumeListeners.delete(listener);
    };
  }

  saveToStorage(storage?: StorageLike | null, key = AUDIO_STORAGE_KEY): boolean {
    const store = storage ?? this.getSafeStorage();
    if (!store) return false;
    try {
      store.setItem(key, JSON.stringify(this.getSettingsSnapshot()));
      return true;
    } catch {
      return false;
    }
  }

  loadFromStorage(storage?: StorageLike | null, key = AUDIO_STORAGE_KEY): boolean {
    const store = storage ?? this.getSafeStorage();
    if (!store) return false;
    try {
      const raw = store.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<AudioSettingsSnapshot>;
      if (typeof parsed.muted === 'boolean') {
        this.setMuted(parsed.muted);
      }
      if (typeof parsed.masterVolume === 'number' && Number.isFinite(parsed.masterVolume)) {
        this.setMasterVolume(parsed.masterVolume);
      }
      this.setMusicVolume(
        typeof parsed.musicVolume === 'number' && Number.isFinite(parsed.musicVolume)
          ? parsed.musicVolume
          : (this.config.musicVolume ?? DEFAULT_AUDIO_CONFIG.musicVolume ?? 1)
      );
      this.setSfxVolume(
        typeof parsed.sfxVolume === 'number' && Number.isFinite(parsed.sfxVolume)
          ? parsed.sfxVolume
          : (this.config.sfxVolume ?? DEFAULT_AUDIO_CONFIG.sfxVolume ?? 1)
      );
      return true;
    } catch {
      return false;
    }
  }

  private getSafeStorage(): StorageLike | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch {
      // Chặn truy cập Storage trong sandbox
    }
    return null;
  }

  private notifyMuteListeners(): void {
    for (const listener of this.muteListeners) {
      try {
        listener(this.muted);
      } catch {
        // Tránh lỗi listener làm đứt luồng
      }
    }
  }

  private notifyVolumeListeners(): void {
    for (const listener of this.volumeListeners) {
      try {
        listener(this.masterVolume);
      } catch {
        // Tránh lỗi listener làm đứt luồng
      }
    }
  }

  // --- Quản lý Danh mục Cue ---

  hasCue(name: string): boolean {
    return this.cues.has(name);
  }

  getCueDefinition(name: string): CueDefinition | undefined {
    return this.cues.get(name);
  }

  getAllCueNames(): readonly string[] {
    return Array.from(this.cues.keys());
  }

  registerCue(name: string, definition: CueDefinition): void {
    this.cues.set(name, Object.freeze(definition));
  }

  // --- Quản lý Concurrency và Phát Âm (Playback) ---

  getActiveVoiceCount(): number {
    return this.activeVoices.size;
  }

  getActiveVoices(): readonly ActiveVoice[] {
    return Array.from(this.activeVoices.values());
  }

  stopAllVoices(): void {
    const voices = Array.from(this.activeVoices.values());
    for (const voice of voices) {
      try {
        voice.stop();
      } catch {
        // Bỏ qua lỗi ngắt
      }
    }
    this.activeVoices.clear();
  }

  startMusic(context: MusicContext): boolean {
    if (!this.ctx) return false;
    if (this.musicContext === context && this.musicTimer !== null) return true;
    this.stopMusic();
    this.musicContext = context;
    this.musicStep = 0;
    this.scheduleMusicStep();
    return true;
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicContext = null;
    this.musicStep = 0;
    for (const voice of this.musicVoices) voice.stop();
    this.musicVoices.clear();
  }

  pauseMusic(): void {
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  resumeMusic(): void {
    if (this.musicContext && this.musicTimer === null) this.scheduleMusicStep();
  }

  private scheduleMusicStep(): void {
    const context = this.musicContext;
    if (!context) return;
    const notes = MUSIC_MOTIFS[context];
    const cue = this.cues.get(`music_${context}`);
    if (cue) {
      const voice = this.playCue(cue.id, { volume: 0.8, priority: -1, pitchMultiplier: notes[this.musicStep % notes.length] / notes[0] });
      if (voice) {
        this.musicVoices.add(voice);
        setTimeout(() => this.musicVoices.delete(voice), 700);
      }
    }
    this.musicStep = (this.musicStep + 1) % notes.length;
    this.musicTimer = setTimeout(() => this.scheduleMusicStep(), 680);
  }

  /**
   * Phát một âm thanh định danh (Cue) với cơ chế giới hạn số lượng đồng thời.
   * Nếu đã đạt ngưỡng tối đa maxConcurrency, giọng cũ nhất sẽ bị ngắt để nhường chỗ.
   */
  playCue(name: AudioCueName | string, options?: PlayCueOptions): ActiveVoice | null {
    if (!this.ctx || !this.masterGainNode || !this.musicGainNode || !this.sfxGainNode) {
      return null;
    }

    const cue = this.cues.get(name);
    if (!cue || cue.layers.length === 0) {
      return null;
    }

    // 1. Kiểm soát giới hạn concurrency (Bounded SFX Concurrency)
    while (this.activeVoices.size >= this.config.maxConcurrency) {
      const oldestVoice = this.findOldestVoice();
      if (oldestVoice) {
        oldestVoice.stop();
        this.activeVoices.delete(oldestVoice.id);
      } else {
        break;
      }
    }

    // 2. Khởi tạo cấu trúc âm thanh
    const voiceId = ++this.voiceSequence;
    const now = this.ctx.currentTime;
    const pitchMultiplier = typeof options?.pitchMultiplier === 'number' && options.pitchMultiplier > 0
      ? options.pitchMultiplier
      : 1.0;
    const cueVol = (cue.defaultVolume ?? 1.0) * (options?.volume ?? 1.0);
    const clampedCueVol = Math.max(0, Math.min(1, cueVol));
    const priority = options?.priority ?? 0;

    let voiceGain: GainNodeLike;
    try {
      voiceGain = this.ctx.createGain();
      voiceGain.gain.setValueAtTime(clampedCueVol, now);
      const targetChannel = typeof name === 'string' && name.startsWith('music_')
        ? this.musicGainNode
        : this.sfxGainNode;
      voiceGain.connect(targetChannel);
    } catch {
      return null;
    }

    const oscillators: OscillatorNodeLike[] = [];
    let maxLayerDuration = 0;

    for (const layer of cue.layers) {
      const delay = layer.delay ?? 0;
      const startTime = now + delay;
      const stopTime = startTime + layer.duration;
      if (delay + layer.duration > maxLayerDuration) {
        maxLayerDuration = delay + layer.duration;
      }

      try {
        const osc = this.ctx.createOscillator();
        const layerGain = this.ctx.createGain();

        osc.type = layer.shape;
        const initialLayerGain = layer.initialGain ?? 1.0;
        layerGain.gain.setValueAtTime(initialLayerGain, startTime);

        // Đường biểu diễn âm lượng theo thời gian (Gain points)
        if (layer.gainPoints) {
          for (const gp of layer.gainPoints) {
            const pointTime = startTime + gp.timeOffset;
            if (gp.curve === 'linear') {
              layerGain.gain.linearRampToValueAtTime(gp.gain, pointTime);
            } else {
              layerGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gp.gain), pointTime);
            }
          }
        }

        // Tần số dao động & Đường cao độ (Pitch points)
        const baseFreq = layer.startFrequency * pitchMultiplier;
        osc.frequency.setValueAtTime(baseFreq, startTime);

        if (layer.detune && osc.detune) {
          osc.detune.setValueAtTime(layer.detune, startTime);
        }

        if (layer.pitchPoints) {
          for (const pp of layer.pitchPoints) {
            const pointTime = startTime + pp.timeOffset;
            const targetFreq = pp.frequency * pitchMultiplier;
            if (pp.curve === 'exponential') {
              osc.frequency.exponentialRampToValueAtTime(Math.max(1, targetFreq), pointTime);
            } else {
              osc.frequency.linearRampToValueAtTime(targetFreq, pointTime);
            }
          }
        }

        osc.connect(layerGain);
        layerGain.connect(voiceGain);

        osc.start(startTime);
        osc.stop(stopTime);
        oscillators.push(osc);
      } catch {
        // Bỏ qua lỗi trên từng layer nếu có sự cố
      }
    }

    if (oscillators.length === 0) {
      try {
        voiceGain.disconnect();
      } catch {
        // Bỏ qua
      }
      return null;
    }

    let isStopped = false;
    const stopFn = () => {
      if (isStopped) return;
      isStopped = true;
      for (const osc of oscillators) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Bỏ qua
        }
      }
      try {
        voiceGain.disconnect();
      } catch {
        // Bỏ qua
      }
      this.activeVoices.delete(voiceId);
    };

    const activeVoice: ActiveVoice = {
      id: voiceId,
      cueName: name,
      startTime: now,
      estimatedEndTime: now + maxLayerDuration,
      priority,
      stop: stopFn,
    };

    // Tự động giải phóng khi dao động cuối cùng kết thúc
    const lastOsc = oscillators[oscillators.length - 1];
    if (lastOsc) {
      lastOsc.onended = () => {
        this.activeVoices.delete(voiceId);
        try {
          voiceGain.disconnect();
        } catch {
          // Bỏ qua
        }
      };
    }

    this.activeVoices.set(voiceId, activeVoice);
    return activeVoice;
  }

  private findOldestVoice(): ActiveVoice | undefined {
    let oldest: ActiveVoice | undefined;
    for (const voice of this.activeVoices.values()) {
      if (!oldest || voice.startTime < oldest.startTime || (voice.startTime === oldest.startTime && voice.id < oldest.id)) {
        oldest = voice;
      }
    }
    return oldest;
  }

  /**
   * Hủy giải phóng tài nguyên.
   */
  destroy(): void {
    if (this.cleanupAutoUnlock) {
      this.cleanupAutoUnlock();
      this.cleanupAutoUnlock = null;
    }
    this.stopMusic();
    this.stopAllVoices();
    this.muteListeners.clear();
    this.volumeListeners.clear();
    if (this.musicGainNode) {
      try {
        this.musicGainNode.disconnect();
      } catch {
        // Bỏ qua
      }
    }
    if (this.sfxGainNode) {
      try {
        this.sfxGainNode.disconnect();
      } catch {
        // Bỏ qua
      }
    }
    if (this.masterGainNode) {
      try {
        this.masterGainNode.disconnect();
      } catch {
        // Bỏ qua
      }
    }
    if (this.ctx && typeof this.ctx.close === 'function') {
      try {
        void this.ctx.close();
      } catch {
        // Bỏ qua
      }
    }
  }
}

/**
 * Thể hiện đơn thể (Singleton instance) sẵn sàng sử dụng.
 */
export const audioManager = new AudioManager();
