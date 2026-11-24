import { describe, expect, it } from 'vitest';
import { createSounds, keepMute, keptMute, SOUND_KINDS, TYPE_MS, typeDue } from './sound';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('the nuclear war\'s sounds (STORY-127)', () => {
  it('without Web Audio every sound is silent and nothing throws', () => {
    const s = createSounds(null);
    for (const k of SOUND_KINDS) expect(() => s.play(k)).not.toThrow();
    expect(s.started).toBe(false);
  });

  it('the choice to mute is kept, and a storage that refuses keeps it for the visit', () => {
    const store = memory();
    expect(keptMute(store)).toBe(false);
    keepMute(store, true);
    expect(keptMute(store)).toBe(true);
    keepMute(store, false);
    expect(keptMute(store)).toBe(false);
    const refusing = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    expect(keptMute(refusing)).toBe(false);
    expect(() => keepMute(refusing, true)).not.toThrow();
    expect(keptMute(null)).toBe(false);
  });

  it('the typewriter clicks at most once in its interval', () => {
    expect(typeDue(100, 100 - TYPE_MS)).toBe(true);
    expect(typeDue(100, 100 - TYPE_MS + 1)).toBe(false);
    expect(typeDue(0, -Infinity)).toBe(true);
  });

  it('no sound before the player\'s first gesture: the context is made only then', () => {
    const listeners: Record<string, () => void> = {};
    let made = 0;
    class FakeContext {
      state = 'running';
      currentTime = 0;
      sampleRate = 8000;
      destination = {};
      constructor() { made++; }
      createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x }; }
      createBuffer(_c: number, n: number) { return { getChannelData: () => new Float32Array(n) }; }
      resume() { return Promise.resolve(); }
      suspend() { return Promise.resolve(); }
    }
    const win = {
      AudioContext: FakeContext,
      localStorage: memory(),
      addEventListener: (type: string, f: () => void) => { listeners[type] = f; },
      document: { hidden: false, addEventListener() {} },
    } as unknown as Window;
    const s = createSounds(win);
    expect(made).toBe(0);
    expect(s.started).toBe(false);
    listeners.pointerdown();
    expect(made).toBe(1);
    expect(s.started).toBe(true);
    listeners.keydown();
    expect(made).toBe(1);
    s.setMuted(true);
    expect(s.muted).toBe(true);
    // Muted: nothing is built, so the fake's missing nodes are never asked for
    expect(() => s.play('blast')).not.toThrow();
  });
});
