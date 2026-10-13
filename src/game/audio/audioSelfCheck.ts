/**
 * Tự kiểm tra tất định Trình quản lý Âm thanh (Audio Manager Deterministic Self-Check)
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Kiểm tra các tính năng:
 * 1. Danh mục hiệu ứng âm thanh (Cue Registry: đầy đủ âm thanh chiến đấu & UI, tham số hợp lệ).
 * 2. Cấu hình bất biến (Immutable Config).
 * 3. An toàn khi môi trường không có AudioContext (Safe Fallback).
 * 4. Trạng thái Master Mute, Master Volume & Móc nối cài đặt (Persistence Settings Hooks / SoundManagerLike).
 * 5. Giới hạn số lượng hiệu ứng đồng thời (Bounded SFX Concurrency & Voice Stealing).
 * 6. Cơ chế Mở khóa âm thanh (Unlock).
 */

import {
  AudioManager,
  BUILTIN_CUES,
  DEFAULT_AUDIO_CONFIG,
  createMockAudioContext,
  type AudioCueName,
  type CombatCueName,
  type MusicContext,
  type UICueName,
  type CueDefinition,
  type StorageLike,
} from './AudioManager';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Audio self-check assertion failed: ${message}`);
  }
}

export function runAudioSelfCheck(): true {
  // =========================================================================
  // 1. Kiểm tra Cấu hình Bất biến (Immutable Config)
  // =========================================================================
  assert(Object.isFrozen(DEFAULT_AUDIO_CONFIG), 'DEFAULT_AUDIO_CONFIG must be frozen');
  assert(DEFAULT_AUDIO_CONFIG.maxConcurrency > 0, 'Default concurrency must be positive');
  assert(DEFAULT_AUDIO_CONFIG.masterVolume >= 0 && DEFAULT_AUDIO_CONFIG.masterVolume <= 1, 'Default volume in [0, 1]');
  assert(DEFAULT_AUDIO_CONFIG.musicVolume === 1, 'Default musicVolume must be 1 (channel 1 preserve mix)');
  assert(DEFAULT_AUDIO_CONFIG.sfxVolume === 1, 'Default sfxVolume must be 1 (channel 1 preserve mix)');

  const customManager = new AudioManager({
    masterVolume: 0.5,
    musicVolume: 0.6,
    sfxVolume: 0.4,
    initialMuted: true,
    maxConcurrency: 4,
    autoUnlockOnInteraction: false,
  });
  assert(Object.isFrozen(customManager.config), 'Manager instance config must be frozen');
  assert(customManager.config.masterVolume === 0.5, 'Custom master volume preserved');
  assert(customManager.config.musicVolume === 0.6, 'Custom music volume preserved');
  assert(customManager.config.sfxVolume === 0.4, 'Custom sfx volume preserved');
  assert(customManager.config.initialMuted === true, 'Custom initial muted preserved');
  assert(customManager.config.maxConcurrency === 4, 'Custom max concurrency preserved');
  assert(customManager.config.autoUnlockOnInteraction === false, 'Custom autoUnlock preserved');
  customManager.destroy();

  // =========================================================================
  // 2. Kiểm tra Danh mục Hiệu ứng Âm thanh (Cue Registry)
  // =========================================================================
  const requiredCombatCues: readonly CombatCueName[] = [
    'sword_slash',
    'hit_impact',
    'player_hurt',
    'dodge',
    'skill_earth',
    'skill_flame',
    'boss_roar',
    'boss_impact',
    'item_pickup',
    'victory',
    'defeat',
  ];

  const requiredUICues: readonly UICueName[] = [
    'ui_click',
    'ui_confirm',
    'ui_cancel',
    'ui_open',
    'ui_close',
    'menu_select',
  ];

  for (const combatCue of requiredCombatCues) {
    assert(combatCue in BUILTIN_CUES, `Combat cue "${combatCue}" must exist in BUILTIN_CUES`);
    const def = BUILTIN_CUES[combatCue];
    assert(def.category === 'combat', `Cue "${combatCue}" must be category "combat"`);
    assert(def.layers.length > 0, `Cue "${combatCue}" must have at least 1 layer`);
    assert(typeof def.description === 'string' && def.description.length > 0, `Cue "${combatCue}" description valid`);
    assert(typeof def.defaultVolume === 'number' && def.defaultVolume > 0, `Cue "${combatCue}" defaultVolume valid`);
  }

  for (const uiCue of requiredUICues) {
    assert(uiCue in BUILTIN_CUES, `UI cue "${uiCue}" must exist in BUILTIN_CUES`);
    const def = BUILTIN_CUES[uiCue];
    assert(def.category === 'ui', `Cue "${uiCue}" must be category "ui"`);
    assert(def.layers.length > 0, `Cue "${uiCue}" must have at least 1 layer`);
    assert(typeof def.description === 'string' && def.description.length > 0, `Cue "${uiCue}" description valid`);
    assert(typeof def.defaultVolume === 'number' && def.defaultVolume > 0, `Cue "${uiCue}" defaultVolume valid`);
  }

  // Kiểm tra tính toàn vẹn cấu trúc từng Layer của tất cả Cues
  for (const [cueName, cueDef] of Object.entries(BUILTIN_CUES)) {
    assert(Object.isFrozen(cueDef), `Cue "${cueName}" definition must be frozen`);
    assert(cueDef.id === cueName, `Cue id "${cueDef.id}" must match key "${cueName}"`);
    for (let index = 0; index < cueDef.layers.length; index += 1) {
      const layer = cueDef.layers[index];
      assert(Object.isFrozen(layer), `Layer ${index} of cue "${cueName}" must be frozen`);
      assert(['sine', 'square', 'triangle', 'sawtooth'].includes(layer.shape), `Layer ${index} of "${cueName}" has valid shape`);
      assert(layer.startFrequency > 0, `Layer ${index} of "${cueName}" startFrequency must be > 0`);
      assert(layer.duration > 0, `Layer ${index} of "${cueName}" duration must be > 0`);
      if (layer.initialGain !== undefined) {
        assert(layer.initialGain >= 0 && layer.initialGain <= 1, `Layer ${index} of "${cueName}" initialGain valid`);
      }
      if (layer.pitchPoints) {
        for (const pp of layer.pitchPoints) {
          assert(pp.timeOffset >= 0, `Pitch point timeOffset must be >= 0`);
          assert(pp.frequency > 0, `Pitch point frequency must be > 0`);
        }
      }
      if (layer.gainPoints) {
        for (const gp of layer.gainPoints) {
          assert(gp.timeOffset >= 0, `Gain point timeOffset must be >= 0`);
          assert(gp.gain >= 0 && gp.gain <= 1, `Gain point value must be in [0, 1]`);
        }
      }
    }
  }

  // =========================================================================
  // 3. Kiểm tra An toàn khi Không có WebAudio (Safe Fallback / Headless)
  // =========================================================================
  const headlessManager = new AudioManager({
    customAudioContext: null,
    autoUnlockOnInteraction: false,
  });
  // Khi không có AudioContext, không được ném ngoại lệ ở bất kỳ hàm nào
  assert(typeof headlessManager.isSupported() === 'boolean', 'isSupported returns boolean');
  assert(headlessManager.getActiveVoiceCount() === 0, 'No active voices initially');
  assert(headlessManager.playCue('sword_slash') === null, 'playCue returns null safely without context');
  assert(headlessManager.startMusic('menu') === false, 'music safely refuses without context');
  assert(headlessManager.stopAllVoices() === undefined, 'stopAllVoices no-ops safely');
  assert(typeof headlessManager.isMuted() === 'boolean', 'isMuted works');
  assert(headlessManager.getMusicVolume() === 1.0, 'headless default music volume is 1');
  assert(headlessManager.getSfxVolume() === 1.0, 'headless default sfx volume is 1');
  assert(headlessManager.setMusicVolume(0.5) === 0.5, 'headless setMusicVolume works');
  assert(headlessManager.getMusicVolume() === 0.5, 'headless music volume updated');
  assert(headlessManager.setMusicVolume(NaN) === 0.5, 'headless setMusicVolume rejects NaN');
  assert(headlessManager.setSfxVolume(0.4) === 0.4, 'headless setSfxVolume works');
  assert(headlessManager.getSfxVolume() === 0.4, 'headless sfx volume updated');
  assert(headlessManager.setSfxVolume(Infinity) === 0.4, 'headless setSfxVolume rejects Infinity');
  assert(headlessManager.getSettingsSnapshot().musicVolume === 0.5, 'headless snapshot has musicVolume');
  assert(headlessManager.getSettingsSnapshot().sfxVolume === 0.4, 'headless snapshot has sfxVolume');
  headlessManager.destroy();

  // =========================================================================
  // 4. Kiểm tra Master Mute, Volume & Đồng bộ Cài đặt (Settings Hooks)
  // =========================================================================
  const mockCtx = createMockAudioContext();
  const audio = new AudioManager({
    customAudioContext: mockCtx,
    initialMuted: false,
    masterVolume: 0.75,
    maxConcurrency: 3,
    autoUnlockOnInteraction: false,
  });

  assert(audio.isSupported() === true, 'Audio supported with mock context');
  assert(audio.isMuted() === false, 'Initial state is not muted');
  assert((audio.mute as boolean) === false, 'SoundManagerLike mute getter matches');
  assert(audio.getMasterVolume() === 0.75, 'Initial volume matches config');
  assert(audio.getMusicVolume() === 1.0, 'Initial music volume is 1 (channel 1 default)');
  assert(audio.getSfxVolume() === 1.0, 'Initial sfx volume is 1 (channel 1 default)');

  // Kiểm tra Event Listeners khi đổi trạng thái Mute & Volume
  const listenerStore = new Map<string, unknown>();
  listenerStore.set('muteCalled', false);
  listenerStore.set('lastMute', false);
  const unsubscribeMute = audio.onMuteChange((muted) => {
    listenerStore.set('muteCalled', true);
    listenerStore.set('lastMute', muted);
  });

  listenerStore.set('volCalled', false);
  listenerStore.set('lastVol', 0);
  const unsubscribeVol = audio.onVolumeChange((vol) => {
    listenerStore.set('volCalled', true);
    listenerStore.set('lastVol', vol);
  });

  // Bật Mute
  const toggledMuted = audio.toggleMute();
  assert(toggledMuted === true, 'toggleMute returns true');
  assert(audio.isMuted() === true, 'isMuted is now true');
  assert((audio.mute as boolean) === true, 'mute property is true');
  assert(listenerStore.get('muteCalled') === true && listenerStore.get('lastMute') === true, 'mute listener fired');

  // Thay đổi thông qua setter của SoundManagerLike
  audio.mute = false;
  assert(audio.isMuted() === false, 'mute setter to false updates isMuted');
  assert(listenerStore.get('lastMute') === false, 'mute listener fired on setter');

  // Hủy đăng ký listener
  unsubscribeMute();
  listenerStore.set('muteCalled', false);
  audio.setMuted(true);
  assert(listenerStore.get('muteCalled') === false, 'unsubscribed mute listener not called');

  // Đổi âm lượng
  audio.setMasterVolume(0.9);
  assert(audio.getMasterVolume() === 0.9, 'master volume updated');
  assert(listenerStore.get('volCalled') === true && listenerStore.get('lastVol') === 0.9, 'volume listener fired');

  // Giới hạn biên độ âm lượng [0, 1]
  audio.setMasterVolume(1.8);
  assert(audio.getMasterVolume() === 1.0, 'volume clamped to 1.0');
  audio.setMasterVolume(-0.4);
  assert(audio.getMasterVolume() === 0.0, 'volume clamped to 0.0');
  unsubscribeVol();

  // Từ chối giá trị runtime không hợp lệ (Reject non-finite/incorrect runtime input, return previous)
  audio.setMasterVolume(0.75);
  assert(audio.setMasterVolume(NaN) === 0.75, 'setMasterVolume rejects NaN and returns previous');
  assert(audio.getMasterVolume() === 0.75, 'master volume unchanged after NaN');
  assert(audio.setMasterVolume(Infinity) === 0.75, 'setMasterVolume rejects Infinity');
  assert(audio.setMasterVolume(-Infinity) === 0.75, 'setMasterVolume rejects -Infinity');
  assert(audio.setMasterVolume('invalid' as unknown as number) === 0.75, 'setMasterVolume rejects string');

  assert(audio.setMusicVolume(NaN) === 1.0, 'setMusicVolume rejects NaN and returns previous');
  assert(audio.getMusicVolume() === 1.0, 'music volume unchanged after NaN');
  assert(audio.setMusicVolume(Infinity) === 1.0, 'setMusicVolume rejects Infinity');
  assert(audio.setMusicVolume(-Infinity) === 1.0, 'setMusicVolume rejects -Infinity');
  assert(audio.setMusicVolume('invalid' as unknown as number) === 1.0, 'setMusicVolume rejects string');

  assert(audio.setSfxVolume(NaN) === 1.0, 'setSfxVolume rejects NaN and returns previous');
  assert(audio.getSfxVolume() === 1.0, 'sfx volume unchanged after NaN');
  assert(audio.setSfxVolume(Infinity) === 1.0, 'setSfxVolume rejects Infinity');
  assert(audio.setSfxVolume(-Infinity) === 1.0, 'setSfxVolume rejects -Infinity');
  assert(audio.setSfxVolume(null as unknown as number) === 1.0, 'setSfxVolume rejects null');

  // Giới hạn biên độ âm lượng kênh con
  assert(audio.setMusicVolume(1.8) === 1.0, 'music volume clamped to 1.0');
  assert(audio.setMusicVolume(-0.4) === 0.0, 'music volume clamped to 0.0');
  assert(audio.setSfxVolume(1.8) === 1.0, 'sfx volume clamped to 1.0');
  assert(audio.setSfxVolume(-0.4) === 0.0, 'sfx volume clamped to 0.0');

  // Kiểm tra Snapshot & Đồng bộ cài đặt (Settings synchronization)
  audio.syncFromSettings({ muted: false, masterVolume: 0.65, musicVolume: 0.5, sfxVolume: 0.6 });
  const snapshot = audio.getSettingsSnapshot();
  assert(snapshot.muted === false, 'snapshot muted matches');
  assert(snapshot.masterVolume === 0.65, 'snapshot volume matches');
  assert(snapshot.musicVolume === 0.5, 'snapshot musicVolume matches');
  assert(snapshot.sfxVolume === 0.6, 'snapshot sfxVolume matches');

  // Đồng bộ từng phần không ghi đè trường bị bỏ qua
  audio.syncFromSettings({ muted: true });
  assert(audio.isMuted() === true, 'muted updated');
  assert(audio.getMasterVolume() === 0.65, 'master volume untouched by partial sync');
  assert(audio.getMusicVolume() === 0.5, 'music volume untouched by partial sync');
  assert(audio.getSfxVolume() === 0.6, 'sfx volume untouched by partial sync');

  // Giá trị không hợp lệ trong syncFromSettings bị bỏ qua
  audio.syncFromSettings({ masterVolume: NaN, musicVolume: Infinity, sfxVolume: 'bad' as unknown as number });
  assert(audio.getMasterVolume() === 0.65, 'master volume preserved invalid sync');
  assert(audio.getMusicVolume() === 0.5, 'music volume preserved invalid sync');
  assert(audio.getSfxVolume() === 0.6, 'sfx volume preserved invalid sync');

  // Kiểm tra Lưu trữ Bền vững (Storage roundtrip)
  const memoryStore = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, val) => { memoryStore.set(key, val); },
  };

  const saved = audio.saveToStorage(mockStorage, 'test-audio-key');
  assert(saved === true, 'saveToStorage succeeded');
  assert(memoryStore.has('test-audio-key'), 'storage has test key');

  audio.setMuted(false);
  audio.setMasterVolume(0.2);
  audio.setMusicVolume(0.1);
  audio.setSfxVolume(0.1);
  const loaded = audio.loadFromStorage(mockStorage, 'test-audio-key');
  assert(loaded === true, 'loadFromStorage succeeded');
  assert(audio.isMuted() === true, 'restored muted true from storage');
  assert(audio.getMasterVolume() === 0.65, 'restored volume 0.65 from storage');
  assert(audio.getMusicVolume() === 0.5, 'restored music volume 0.5 from storage');
  assert(audio.getSfxVolume() === 0.6, 'restored sfx volume 0.6 from storage');

  // Tương thích lưu trữ cũ: trường bị thiếu giữ nguyên mặc định (legacy missing fields preserve defaults)
  const legacyJson = JSON.stringify({ muted: false, masterVolume: 0.9 });
  mockStorage.setItem('legacy-audio-key', legacyJson);
  audio.setMusicVolume(0.3);
  audio.setSfxVolume(0.4);
  const loadedLegacy = audio.loadFromStorage(mockStorage, 'legacy-audio-key');
  assert(loadedLegacy === true, 'loadFromStorage legacy succeeded');
  assert(audio.isMuted() === false, 'restored legacy muted');
  assert(audio.getMasterVolume() === 0.9, 'restored legacy master volume');
  assert(audio.getMusicVolume() === 1.0, 'legacy missing musicVolume preserved default 1.0');
  assert(audio.getSfxVolume() === 1.0, 'legacy missing sfxVolume preserved default 1.0');

  // =========================================================================
  // 4.5. Kiểm tra Kênh Gain Nodes, Routing, Isolation, Live Volume & Destroy
  // =========================================================================
  const channelMock = createMockAudioContext();
  const channelAudio = new AudioManager({
    customAudioContext: channelMock,
    masterVolume: 0.8,
    musicVolume: 1.0,
    sfxVolume: 1.0,
    autoUnlockOnInteraction: false,
  });

  const gains = (channelMock as unknown as { createdGains: Array<{ gain: { value: number }; connections: unknown[]; isDisconnected?: boolean }> }).createdGains;
  assert(Array.isArray(gains) && gains.length >= 3, 'At least 3 gain nodes created (master, music, sfx)');
  const [masterGain, musicGain, sfxGain] = gains;

  assert(masterGain.connections.includes(channelMock.destination), 'master gain connects to destination');
  assert(musicGain.connections.includes(masterGain), 'music gain connects to master gain');
  assert(sfxGain.connections.includes(masterGain), 'sfx gain connects to master gain');

  // Phát nhạc nền: định tuyến vào musicGain
  const musicVoice = channelAudio.playCue('music_menu');
  assert(musicVoice !== null, 'music voice created');
  const musicVoiceGains = gains.filter((g) => g.connections.includes(musicGain));
  assert(musicVoiceGains.length === 1, 'exactly 1 voiceGain routed to musicGain');
  const musicVoiceGain = musicVoiceGains[0];
  assert(!musicVoiceGain.connections.includes(sfxGain), 'music voice does NOT route to sfxGain');

  // Phát hiệu ứng chiến đấu: định tuyến vào sfxGain
  const sfxVoice = channelAudio.playCue('sword_slash');
  assert(sfxVoice !== null, 'sfx voice created');
  const sfxVoiceGains = gains.filter((g) => g.connections.includes(sfxGain));
  assert(sfxVoiceGains.length === 1, 'exactly 1 voiceGain routed to sfxGain');
  const sfxVoiceGain = sfxVoiceGains[0];
  assert(!sfxVoiceGain.connections.includes(musicGain), 'sfx voice does NOT route to musicGain');

  const getGainVal = (node: { gain: { value: number } }) => node.gain.value;

  // Độc lập âm lượng giữa 2 kênh (Channel isolation)
  channelAudio.setMusicVolume(0.35);
  assert(getGainVal(musicGain) === 0.35, 'music gain updated to 0.35');
  assert(getGainVal(sfxGain) === 1.0, 'sfx gain isolated from music volume change');

  channelAudio.setSfxVolume(0.45);
  assert(getGainVal(sfxGain) === 0.45, 'sfx gain updated to 0.45');
  assert(getGainVal(musicGain) === 0.35, 'music gain isolated from sfx volume change');

  // Thay đổi âm lượng kênh tác động trực tiếp lên giọng đang phát (Live volume changes)
  channelAudio.setMusicVolume(0.2);
  assert(getGainVal(musicGain) === 0.2, 'live music volume updated on channel gain node');
  assert(getGainVal(musicVoiceGain) > 0, 'voice gain intact, channel node controls live mix');

  // Tắt tiếng master ảnh hưởng cả 2 kênh
  channelAudio.setMuted(true);
  assert(getGainVal(masterGain) === 0, 'master gain is 0 on mute (affects both channels)');
  channelAudio.setMuted(false);
  assert(getGainVal(masterGain) === 0.8, 'master gain restored');

  // Hủy giải phóng: ngắt kết nối các kênh
  channelAudio.destroy();
  assert(masterGain.isDisconnected === true, 'master gain disconnected on destroy');
  assert(musicGain.isDisconnected === true, 'music gain disconnected on destroy');
  assert(sfxGain.isDisconnected === true, 'sfx gain disconnected on destroy');

  // =========================================================================
  // 5. Kiểm tra Giới hạn Concurrency (Bounded SFX Concurrency) & Voice Stealing
  // =========================================================================
  // audio đã được cấu hình maxConcurrency: 3
  assert(audio.config.maxConcurrency === 3, 'maxConcurrency is 3');
  assert(audio.getActiveVoiceCount() === 0, 'active voices initially 0');

  const voice1 = audio.playCue('ui_click');
  assert(voice1 !== null, 'voice 1 created');
  assert(audio.getActiveVoiceCount() === 1, 'active voice count is 1');

  const voice2 = audio.playCue('sword_slash');
  assert(voice2 !== null, 'voice 2 created');
  assert(audio.getActiveVoiceCount() === 2, 'active voice count is 2');

  const voice3 = audio.playCue('hit_impact');
  assert(voice3 !== null, 'voice 3 created');
  assert(audio.getActiveVoiceCount() === 3, 'active voice count is 3 (max capacity)');

  // Phát hiệu ứng thứ 4 vượt quá giới hạn concurrency:
  // Voice cũ nhất (voice1) phải bị ngắt và loại bỏ, tổng số giọng vẫn <= 3
  const voice4 = audio.playCue('skill_earth');
  assert(voice4 !== null, 'voice 4 created');
  assert(audio.getActiveVoiceCount() === 3, 'active voice count strictly bounded to 3');

  const activeVoices = audio.getActiveVoices();
  const activeIds = activeVoices.map((v) => v.id);
  assert(!activeIds.includes(voice1.id), 'oldest voice1 was evicted (voice stealing)');
  assert(activeIds.includes(voice2.id), 'voice2 still active');
  assert(activeIds.includes(voice3.id), 'voice3 still active');
  assert(activeIds.includes(voice4.id), 'voice4 is active');

  // Dừng 1 giọng đơn lẻ
  voice2.stop();
  assert(audio.getActiveVoiceCount() === 2, 'active voice count decremented after manual stop');

  // Dừng toàn bộ các giọng đang phát
  audio.stopAllVoices();
  assert(audio.getActiveVoiceCount() === 0, 'stopAllVoices cleared all active voices');

  const musicContexts: readonly MusicContext[] = [
    'menu', 'village', 'forest', 'swamp', 'mountain', 'combat', 'boss', 'final-boss', 'victory', 'ending',
  ];
  for (const context of musicContexts) {
    assert(audio.getCueDefinition(`music_${context}`) !== undefined, `music context ${context} is registered`);
  }
  assert(audio.startMusic('village') === true, 'music starts with supported context');
  audio.pauseMusic();
  audio.resumeMusic();
  audio.stopMusic();
  assert(audio.getActiveVoiceCount() === 0, 'stopMusic clears music voices');

  // =========================================================================
  // 6. Kiểm tra Mở khóa Âm thanh (Unlock)
  // =========================================================================
  const unlockMock = createMockAudioContext();
  const unlockAudio = new AudioManager({
    customAudioContext: unlockMock,
    autoUnlockOnInteraction: false,
  });
  assert(unlockAudio.isUnlocked() === false, 'Initially suspended in mock context');
  void unlockAudio.unlock().then((success) => {
    assert(success === true, 'unlock resolved to true');
    assert(unlockAudio.isUnlocked() === true, 'audio is now unlocked');
    unlockAudio.destroy();
  });

  // =========================================================================
  // 7. Kiểm tra Đăng ký Hiệu ứng Tùy biến (Custom Cue Registration)
  // =========================================================================
  const customCue: CueDefinition = {
    id: 'custom_chime',
    category: 'combat',
    description: 'Âm thanh thần khí tùy biến',
    defaultVolume: 0.8,
    layers: [
      {
        shape: 'sine',
        startFrequency: 1000,
        duration: 0.1,
      },
    ],
  };
  audio.registerCue('custom_chime', customCue);
  assert(audio.hasCue('custom_chime') === true, 'custom cue registered');
  assert(audio.getCueDefinition('custom_chime')?.id === 'custom_chime', 'getCueDefinition returns custom cue');

  audio.destroy();
  return true;
}

// Chạy tự kiểm tra tất định ngay khi module khởi tạo
export const AUDIO_SELF_CHECK_RESULT: true = runAudioSelfCheck();

// Tự thực thi khi được chạy trực tiếp bằng Node.js
const proc = (globalThis as unknown as { process?: { argv?: string[]; exit?: (code: number) => void } }).process;
if (proc?.argv && proc.argv[1]?.includes('audioSelfCheck')) {
  try {
    runAudioSelfCheck();
    // eslint-disable-next-line no-console
    console.log('Audio self-check: PASS');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    proc.exit?.(1);
  }
}
