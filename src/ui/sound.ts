/**
 * sound.ts — the nuclear war's sounds (STORY-127): every sound is made here with Web Audio
 * from oscillators and noise, no sound files (section 3). The context starts only on the
 * player's first tap or key, it is suspended while the tab is hidden, and without Web Audio
 * every call does nothing. The choice to mute is kept in localStorage.
 */

export type SoundKind =
  | 'launch' | 'bomber' | 'blast' | 'burst' | 'horn' | 'type' | 'factory'
  | 'cow' | 'weight' | 'quake' | 'ufo' | 'fall' | 'win';

export const SOUND_KINDS: SoundKind[] = ['launch', 'bomber', 'blast', 'burst', 'horn', 'type', 'factory', 'cow', 'weight', 'quake', 'ufo', 'fall', 'win'];

const MUTE_KEY = 'globeciv3.nuclear.muted';
/** The typewriter clicks at most once in this many ms. */
export const TYPE_MS = 40;

export interface Sounds {
  play(kind: SoundKind, size?: number): void;
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  /** Whether the audio has started (after the first gesture), for tests. */
  readonly started: boolean;
}

/** Reads the kept choice; false when storage is not there. */
export function keptMute(storage: Pick<Storage, 'getItem'> | null): boolean {
  try { return storage?.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
export function keepMute(storage: Pick<Storage, 'setItem'> | null, muted: boolean): void {
  try { storage?.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode: the choice lasts the visit */ }
}

/** Whether a typewriter click may sound now, given the last one's time. */
export const typeDue = (now: number, last: number) => now - last >= TYPE_MS;

export function createSounds(win: Window | null = typeof window === 'undefined' ? null : window): Sounds {
  const storage = (() => { try { return win?.localStorage ?? null; } catch { return null; } })();
  let muted = keptMute(storage);
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let lastType = -Infinity;
  const Ctor: typeof AudioContext | undefined = (win as any)?.AudioContext ?? (win as any)?.webkitAudioContext;

  const start = () => {
    if (ctx || !Ctor) return;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      // Two seconds of white noise for the bangs, the engines and the rumble
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) >>> 0; d[i] = (seed / 4294967296) * 2 - 1; }
    } catch {
      ctx = null;
    }
  };
  if (win) {
    const once = () => { start(); void ctx?.resume?.(); };
    win.addEventListener('pointerdown', once, { capture: true });
    win.addEventListener('keydown', once, { capture: true });
    win.document?.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (win.document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
  }

  /** A tone: an oscillator from one frequency to another, its loudness rising and falling. */
  function tone(type: OscillatorType, from: number, to: number, at: number, length: number, peak = 0.5, glide: 'lin' | 'exp' = 'exp', through?: AudioNode) {
    const c = ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, at);
    if (glide === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + length);
    else o.frequency.linearRampToValueAtTime(to, at + length);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.03, length / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    o.connect(g).connect(through ?? master!);
    o.start(at);
    o.stop(at + length + 0.05);
    return o;
  }

  /** Noise through a filter whose frequency glides from one to another. */
  function hiss(filter: BiquadFilterType, from: number, to: number, at: number, length: number, peak = 0.6, q = 0.7) {
    const c = ctx!;
    const src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + length);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.02, length / 6));
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(f).connect(g).connect(master!);
    src.start(at, Math.random() * 1.5);
    src.stop(at + length + 0.05);
  }

  function play(kind: SoundKind, size = 1) {
    if (muted || !ctx || !master || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.01;
    switch (kind) {
      case 'launch':
        hiss('bandpass', 600, 2400, t, 1.3, 0.35, 0.8);
        tone('sawtooth', 200, 1200, t, 1.2, 0.12);
        break;
      case 'bomber': {
        // Two engines slightly out of tune, beating
        tone('sawtooth', 78, 72, t, 2.6, 0.12, 'lin');
        tone('sawtooth', 81, 76, t, 2.6, 0.12, 'lin');
        hiss('lowpass', 400, 300, t, 2.6, 0.1);
        break;
      }
      case 'blast': {
        const length = 1.6 + 0.6 * size;
        hiss('lowpass', 2200, 70, t, length, 0.9);
        tone('sine', 70, 32, t, length * 0.8, 0.8);
        break;
      }
      case 'burst':
        hiss('bandpass', 1800, 500, t, 0.35, 0.5, 1.2);
        break;
      case 'horn':
        [392, 523, 659].forEach((f, i) => tone('square', f, f, t + i * 0.16, i === 2 ? 0.45 : 0.15, 0.12, 'lin'));
        break;
      case 'type': {
        const now = ctx.currentTime * 1000;
        if (!typeDue(now, lastType)) return;
        lastType = now;
        hiss('bandpass', 3200, 2600, t, 0.025, 0.25, 4);
        break;
      }
      case 'factory':
        tone('square', 220, 180, t, 0.12, 0.15);
        tone('square', 330, 260, t + 0.18, 0.12, 0.15);
        hiss('highpass', 4000, 3000, t + 0.18, 0.08, 0.2);
        break;
      case 'cow': {
        // A deep "moo": a saw through a vowel-like band with a slow wobble
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 700;
        f.Q.value = 3;
        f.connect(master);
        const o = tone('sawtooth', 145, 105, t, 1.3, 0.6, 'exp', f);
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 5;
        depth.gain.value = 4;
        lfo.connect(depth).connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + 1.35);
        break;
      }
      case 'weight':
        tone('sine', 1500, 300, t, 0.9, 0.2);
        tone('sine', 90, 40, t + 0.9, 0.5, 0.7);
        hiss('lowpass', 600, 80, t + 0.9, 0.5, 0.5);
        break;
      case 'quake':
        hiss('lowpass', 140, 60, t, 2.2, 0.8);
        tone('sine', 38, 30, t, 2.2, 0.5, 'lin');
        break;
      case 'ufo': {
        const o = tone('sine', 700, 900, t, 1.6, 0.25, 'lin');
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 7;
        depth.gain.value = 120;
        lfo.connect(depth).connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + 1.65);
        break;
      }
      case 'fall':
        [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.98, t + i * 0.28, 0.5, 0.25, 'lin'));
        break;
      case 'win':
        [262, 330, 392, 523].forEach((f, i) => tone('square', f, f, t + i * 0.14, i === 3 ? 0.6 : 0.13, 0.12, 'lin'));
        break;
    }
  }

  return {
    play,
    get muted() { return muted; },
    setMuted(m: boolean) {
      muted = m;
      keepMute(storage, m);
    },
    get started() { return ctx !== null; },
  };
}
