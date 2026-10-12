/**
 * pulses.ts — the game's moments glow (STORY-035): a new city, a discovery, bandits on the
 * way, a raid beaten back or a level opened sends a glow and two rings of light out from
 * its tile. A pulse keeps its size on the screen at every zoom level and lasts 1.6 s of
 * wall time (rule 5); with reduced motion the rings stay still and only the glow fades.
 */
import * as THREE from 'three';
import { tileCenter } from './hexTiles';
import { oklchToSrgb } from './colors';

export type PulseKind = 'city' | 'find' | 'raid' | 'victory' | 'unlock' | 'improve';

/** Colour and size (CSS px at full size) of each kind: Kartografi accent, gold and rust. */
const LOOKS: Record<PulseKind, { color: [number, number, number]; px: number }> = {
  city: { color: oklchToSrgb(0.72, 0.13, 290), px: 220 },
  find: { color: oklchToSrgb(0.82, 0.12, 85), px: 180 },
  raid: { color: oklchToSrgb(0.62, 0.17, 35), px: 240 },
  victory: { color: oklchToSrgb(0.8, 0.1, 290), px: 200 },
  unlock: { color: oklchToSrgb(0.78, 0.12, 290), px: 320 },
  improve: { color: oklchToSrgb(0.82, 0.08, 150), px: 90 },
};

export const PULSE_S = 1.6;
/** The second ring follows the first after this many seconds. */
const RING_GAP_S = 0.35;

export interface PulseLook {
  /** Glow and ring diameters in CSS px, and their opacities. */
  glow: number; glowA: number;
  rings: { size: number; a: number }[];
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** How a pulse looks t seconds in, or null when it is over. */
export function pulseLook(kind: PulseKind, t: number, reduceMotion: boolean): PulseLook | null {
  if (t < 0 || t >= PULSE_S) return null;
  const px = LOOKS[kind].px;
  const u = t / PULSE_S;
  // The glow comes up fast and fades slowly
  const glowA = Math.min(1, t / 0.12) * (1 - u) ** 1.5;
  if (reduceMotion) return { glow: px * 0.6, glowA, rings: [] };
  const rings = [0, RING_GAP_S].flatMap(lag => {
    const v = (t - lag) / (PULSE_S - RING_GAP_S);
    return v <= 0 || v >= 1 ? [] : [{ size: px * (0.25 + 0.75 * easeOut(v)), a: (1 - v) ** 2 }];
  });
  return { glow: px * (0.45 + 0.25 * easeOut(u)), glowA, rings };
}

function texture(draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Live { kind: PulseKind; tile: number; start: number; glow: THREE.Sprite; rings: THREE.Sprite[] }

export class PulseLayer {
  readonly group = new THREE.Group();
  private readonly radius: number;
  private readonly live: Live[] = [];
  private readonly glowTex: THREE.CanvasTexture;
  private readonly ringTex: THREE.CanvasTexture;

  constructor(radius: number) {
    this.radius = radius;
    // White, tinted per pulse: a soft glow, and a ring with a soft edge
    this.glowTex = texture(g => {
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    });
    this.ringTex = texture(g => {
      const grad = g.createRadialGradient(64, 64, 44, 64, 64, 62);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.6, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    });
  }

  private sprite(map: THREE.Texture, color: [number, number, number]): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map, color: new THREE.Color().setRGB(...color, THREE.SRGBColorSpace),
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false,
    }));
    s.renderOrder = 20;
    this.group.add(s);
    return s;
  }

  /** A pulse from a tile, starting now (ms, performance.now()). */
  add(kind: PulseKind, tile: number, now: number): void {
    const color = LOOKS[kind].color;
    this.live.push({ kind, tile, start: now, glow: this.sprite(this.glowTex, color), rings: [this.sprite(this.ringTex, color), this.sprite(this.ringTex, color)] });
  }

  /** Pulses running now, for tests. */
  get state(): { kind: PulseKind; tile: number; age: number }[] {
    const now = performance.now();
    return this.live.map(p => ({ kind: p.kind, tile: p.tile, age: (now - p.start) / 1000 }));
  }

  /**
   * Place and fade the pulses for this frame. A sprite without size attenuation keeps its
   * size on the screen: px → scale is px × 2 tan(fov / 2) / screen height.
   */
  update(now: number, camera: THREE.PerspectiveCamera, heightPx: number, reduceMotion: boolean): void {
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / heightPx;
    for (const p of [...this.live]) {
      // A pulse added during this frame starts after the frame's time stamp: its age is 0, not less
      const look = pulseLook(p.kind, Math.max(0, (now - p.start) / 1000), reduceMotion);
      if (!look) {
        for (const s of [p.glow, ...p.rings]) {
          this.group.remove(s);
          s.material.dispose();
        }
        this.live.splice(this.live.indexOf(p), 1);
        continue;
      }
      const at = tileCenter(p.tile).multiplyScalar(this.radius);
      // Hidden on the far side of the globe
      const facing = at.dot(camera.position) > this.radius * this.radius;
      p.glow.position.copy(at);
      p.glow.scale.setScalar(look.glow * perPx);
      p.glow.material.opacity = look.glowA;
      p.glow.visible = facing;
      p.rings.forEach((s, i) => {
        const ring = look.rings[i];
        s.visible = facing && !!ring;
        if (!ring) return;
        s.position.copy(at);
        s.scale.setScalar(ring.size * perPx);
        s.material.opacity = ring.a;
      });
    }
  }
}
