export type SoundKey = 'shuffle' | 'play' | 'join' | 'turn' | 'win' | 'lose';

export const SOUND_KEYS: readonly SoundKey[] = ['shuffle', 'play', 'join', 'turn', 'win', 'lose'];

export const SOUND_FILES: Record<SoundKey, string> = {
  shuffle: '/sounds/shuffle.mp3',
  play: '/sounds/play.mp3',
  join: '/sounds/join.mp3',
  turn: '/sounds/turn.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
};

const STORAGE_KEY = 'samloc.sound';

/** Private mode and blocked site data both make localStorage throw; sound stays on by default. */
function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/**
 * Web Audio player for the game cues. iOS only plays from an `AudioContext` resumed inside a user
 * gesture, so `unlock()` runs from the first pointerdown and decoding starts there too. A cue whose
 * file is missing or undecodable is stored as `null` and simply never plays.
 */
class SoundManager {
  enabled = $state(load());

  #ctx: AudioContext | null = null;
  #buffers = new Map<SoundKey, AudioBuffer | null>();

  set(enabled: boolean): void {
    this.enabled = enabled;
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      // Preference stays for this session only.
    }
  }

  unlock(): void {
    if (this.#ctx) {
      void this.#ctx.resume();
      return;
    }
    if (typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    this.#ctx = ctx;
    void ctx.resume();
    for (const key of SOUND_KEYS) void this.#load(ctx, key);
  }

  play(key: SoundKey): void {
    const ctx = this.#ctx;
    const buffer = this.#buffers.get(key);
    if (!this.enabled || !ctx || ctx.state !== 'running' || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }

  async #load(ctx: AudioContext, key: SoundKey): Promise<void> {
    try {
      const res = await fetch(SOUND_FILES[key]);
      if (!res.ok) throw new Error(String(res.status));
      this.#buffers.set(key, await ctx.decodeAudioData(await res.arrayBuffer()));
    } catch {
      this.#buffers.set(key, null);
    }
  }
}

export const sound = new SoundManager();
