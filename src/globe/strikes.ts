/**
 * strikes.ts — the nuclear war's flights and blasts on the globe (STORY-126), in the same
 * scene as everything else (rule 1). A missile climbs an arc over the globe trailing a line,
 * a bomber flies low and slowly as a little plane, propaganda's people stream as dots, a
 * defence bursts the weapon in the air, and a hit becomes a nuclear blast: a flash, a
 * fireball, a stem and a mushroom cloud rising up the screen, and a shock ring on the ground.
 *
 * Every length of time is wall time (rule 5): `now` is performance.now(), and `speed` only
 * shortens what is to come. Sprites keep their size on the screen at every zoom, as the
 * pulses do. Lines come from a pool with fixed buffers; nothing is built in a frame. With
 * reduced motion nothing flies: only the end of each thing is shown, briefly.
 */
import * as THREE from 'three';

export type FlightKind = 'missile' | 'bomber' | 'people';

/** Seconds of each flight at 1×, and of a blast. */
export const FLIGHT_S: Record<FlightKind, number> = { missile: 1.8, bomber: 3.4, people: 1.6 };
export const BLAST_S = 4.6;
/** A stopped weapon bursts at this share of its way. */
const STOP_AT = 0.72;
const ARC_POINTS = 64;
const PEOPLE_DOTS = 7;
/** Smoke puffs behind a missile and contrail puffs behind a bomber. */
const TRAIL_PUFFS = 22;

interface Flight {
  kind: FlightKind;
  from: THREE.Vector3;
  to: THREE.Vector3;
  start: number;
  seconds: number;
  /** Where it ends: 1, or STOP_AT for a stopped one. */
  end: number;
  line: THREE.Line | null;
  head: THREE.Sprite[];
  angle: number;
  done: boolean;
  /** The share of the way drawn at the last frame. */
  shown: number;
}

interface Blast { at: THREE.Vector3; start: number; size: number; parts: THREE.Sprite[]; ring: THREE.Mesh; small: boolean; air?: THREE.Vector3 }

function canvasTexture(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const radial = (stops: [number, string][]) => (g: CanvasRenderingContext2D, s: number) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
};

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export class StrikeLayer {
  readonly group = new THREE.Group();
  private readonly radius: number;
  private readonly flights: Flight[] = [];
  private readonly blasts: Blast[] = [];
  private readonly linePool: THREE.Line[] = [];
  private readonly tex: Record<'glow' | 'fire' | 'puff' | 'plane' | 'dot' | 'ring' | 'rocket', THREE.Texture>;
  /** For tests and screenshots only: everything this many times slower (1: real time). */
  slow = 1;
  private readonly tmp = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly headAt = new THREE.Vector3();
  private readonly aheadAt = new THREE.Vector3();
  private readonly hereAt = new THREE.Vector3();
  /** One ring for every blast, scaled per blast. */
  private readonly ringGeometry = new THREE.RingGeometry(0.7, 1, 48);
  private readonly tmp2 = new THREE.Vector3();

  constructor(radius: number) {
    this.radius = radius;
    this.tex = {
      glow: canvasTexture(radial([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']])),
      fire: canvasTexture(radial([[0, 'rgba(255,250,220,1)'], [0.35, 'rgba(255,190,90,0.95)'], [0.7, 'rgba(230,90,40,0.6)'], [1, 'rgba(160,40,20,0)']])),
      dot: canvasTexture(radial([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]), 32),
      ring: canvasTexture((g, s) => {
        const grad = g.createRadialGradient(s / 2, s / 2, s * 0.36, s / 2, s / 2, s / 2);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, s, s);
      }),
      // A puff of cloud: soft lumps in a round
      puff: canvasTexture((g, s) => {
        const lumps: [number, number, number][] = [[0.5, 0.55, 0.34], [0.32, 0.5, 0.24], [0.68, 0.5, 0.24], [0.42, 0.34, 0.22], [0.6, 0.34, 0.2], [0.5, 0.7, 0.22]];
        for (const [x, y, r] of lumps) {
          const grad = g.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
          grad.addColorStop(0, 'rgba(255,255,255,0.95)');
          grad.addColorStop(0.7, 'rgba(255,255,255,0.7)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = grad;
          g.fillRect(0, 0, s, s);
        }
      }),
      // A missile seen from the side, pointing up: a white body, a red nose and fins
      rocket: canvasTexture((g, s) => {
        g.translate(s / 2, s / 2);
        g.lineWidth = s * 0.025;
        g.strokeStyle = '#2a2620';
        g.fillStyle = '#ffb347';
        g.beginPath(); g.moveTo(-s * 0.05, s * 0.3); g.lineTo(0, s * 0.48); g.lineTo(s * 0.05, s * 0.3); g.fill();
        g.fillStyle = '#f4f1ea';
        g.beginPath(); g.moveTo(-s * 0.07, -s * 0.22); g.lineTo(s * 0.07, -s * 0.22); g.lineTo(s * 0.07, s * 0.3); g.lineTo(-s * 0.07, s * 0.3); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#d8434f';
        g.beginPath(); g.moveTo(-s * 0.07, -s * 0.22); g.quadraticCurveTo(0, -s * 0.5, s * 0.07, -s * 0.22); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-s * 0.07, s * 0.14); g.lineTo(-s * 0.17, s * 0.32); g.lineTo(-s * 0.07, s * 0.28); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(s * 0.07, s * 0.14); g.lineTo(s * 0.17, s * 0.32); g.lineTo(s * 0.07, s * 0.28); g.closePath(); g.fill(); g.stroke();
      }),
      // A little plane seen from above, pointing up (rotated along its way)
      plane: canvasTexture((g, s) => {
        g.translate(s / 2, s / 2);
        g.fillStyle = '#f4f1ea';
        g.strokeStyle = '#2a2620';
        g.lineWidth = s * 0.03;
        g.beginPath();
        g.moveTo(0, -s * 0.42);
        g.lineTo(s * 0.06, -s * 0.1);
        g.lineTo(s * 0.42, s * 0.08);
        g.lineTo(s * 0.42, s * 0.16);
        g.lineTo(s * 0.06, s * 0.1);
        g.lineTo(s * 0.05, s * 0.3);
        g.lineTo(s * 0.16, s * 0.38);
        g.lineTo(s * 0.16, s * 0.43);
        g.lineTo(0, s * 0.4);
        g.lineTo(-s * 0.16, s * 0.43);
        g.lineTo(-s * 0.16, s * 0.38);
        g.lineTo(-s * 0.05, s * 0.3);
        g.lineTo(-s * 0.06, s * 0.1);
        g.lineTo(-s * 0.42, s * 0.16);
        g.lineTo(-s * 0.42, s * 0.08);
        g.lineTo(-s * 0.06, -s * 0.1);
        g.closePath();
        g.fill();
        g.stroke();
      }),
    };
  }

  private sprite(map: THREE.Texture, color: THREE.ColorRepresentation, additive: boolean, order = 21): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, depthTest: false, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: false }));
    s.renderOrder = order;
    this.group.add(s);
    return s;
  }

  private line(color: THREE.ColorRepresentation): THREE.Line {
    const l = this.linePool.pop() ?? new THREE.Line(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_POINTS * 3), 3)),
      // Depth-tested: the part of an arc behind the globe is hidden by it
      new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }),
    );
    (l.material as THREE.LineBasicMaterial).color.set(color);
    (l.material as THREE.LineBasicMaterial).opacity = 0.9;
    l.renderOrder = 20;
    l.geometry.setDrawRange(0, 0);
    l.visible = true;
    this.group.add(l);
    return l;
  }

  private release(f: Flight) {
    if (f.line) {
      this.group.remove(f.line);
      this.linePool.push(f.line);
    }
    for (const s of f.head) {
      this.group.remove(s);
      s.material.dispose();
    }
  }

  /** The point at share t of a flight, at its height over the globe. */
  private at(f: Flight, t: number, out: THREE.Vector3): THREE.Vector3 {
    out.copy(f.from).lerp(f.to, t);
    // A near-antipodal pair would lerp through the centre: bend it round a side (before normalising)
    if (out.lengthSq() < 0.25) out.add(this.side.copy(f.from).cross(f.to).lengthSq() > 1e-6 ? this.side.normalize().multiplyScalar(Math.sin(Math.PI * t)) : this.side.set(0, Math.sin(Math.PI * t), 0));
    out.normalize();
    const h = f.kind === 'missile' ? this.radius * (0.06 + 0.32 * f.angle / Math.PI) * Math.sin(Math.PI * t)
      : f.kind === 'bomber' ? this.radius * (0.025 + 0.02 * Math.sin(Math.PI * t))
        : this.radius * 0.05 * Math.sin(Math.PI * t);
    return out.multiplyScalar(this.radius + h);
  }

  /**
   * A flight from one unit point to another starting now, `stopped` if a defence bursts it
   * on the way. Returns its seconds at this speed: the panel waits as long.
   */
  launch(kind: FlightKind, from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, now: number, speed: number, stopped = false): number {
    const seconds = FLIGHT_S[kind] / speed;
    const f: Flight = {
      kind, from: from.clone().normalize(), to: to.clone().normalize(), start: now, seconds, end: stopped ? STOP_AT : 1,
      line: kind === 'people' ? null : this.line(kind === 'missile' ? color : '#efe9d8'), head: [], angle: from.angleTo(to), done: false, shown: 0,
    };
    if (kind === 'missile') {
      f.head.push(this.sprite(this.tex.glow, color, true), this.sprite(this.tex.rocket, '#ffffff', false, 22));
      for (let i = 0; i < TRAIL_PUFFS; i++) f.head.push(this.sprite(this.tex.puff, '#d9d6cf', false, 20));
    } else if (kind === 'bomber') {
      f.head.push(this.sprite(this.tex.plane, '#ffffff', false, 22));
      for (let i = 0; i < TRAIL_PUFFS; i++) f.head.push(this.sprite(this.tex.dot, '#ffffff', false, 20));
    }
    else for (let i = 0; i < PEOPLE_DOTS; i++) f.head.push(this.sprite(this.tex.dot, color, true));
    if (f.line) (f.line.material as THREE.LineBasicMaterial).opacity = kind === 'bomber' ? 0.5 : 0.9;
    this.flights.push(f);
    return seconds * f.end;
  }

  /** A burst in the air at a point over the globe: a defence's hit or a bomber going down. */
  private burst(at: THREE.Vector3, now: number) {
    const n = this.blasts.length;
    this.blast(at, 0, now, true);
    this.blasts[n].air = at.clone();
  }

  /** A nuclear blast at a unit point starting now, its size by the warhead's class 0 … 3; `small` for a puff. */
  blast(at: THREE.Vector3, cls: number, now: number, small = false): number {
    const size = small ? 0.9 : [1.3, 1.6, 2.0, 2.6][Math.max(0, Math.min(3, cls))] ?? 1.6;
    const parts = [
      this.sprite(this.tex.glow, '#ffffff', true, 24), // flash
      this.sprite(this.tex.fire, '#ffffff', true, 23), // fireball
      ...(small ? [] : [
        this.sprite(this.tex.puff, '#8a6d58', false, 22), // stem, low
        this.sprite(this.tex.puff, '#a37f62', false, 22), // stem, high
        this.sprite(this.tex.puff, '#e7c49a', false, 22), // cap
        this.sprite(this.tex.puff, '#d6a978', false, 22), // cap, left
        this.sprite(this.tex.puff, '#d6a978', false, 22), // cap, right
        this.sprite(this.tex.fire, '#ff8a3c', true, 23), // the cap's glowing underside
        this.sprite(this.tex.puff, '#6f5a4a', false, 21), // dust at the foot
      ]),
    ];
    const ring = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({ map: this.tex.ring, color: '#ffd6a0', transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    ring.renderOrder = 19;
    ring.visible = !small;
    this.group.add(ring);
    this.blasts.push({ at: at.clone().normalize(), start: now, size, parts, ring, small });
    return small ? BLAST_S * 0.4 : BLAST_S;
  }

  /** Flights and blasts running now, for tests: their kind and age in seconds. */
  get state(): { flights: { kind: FlightKind; age: number; shown: number; end: number; start: number; seconds: number }[]; blasts: { age: number; small: boolean }[] } {
    const now = performance.now();
    return {
      flights: this.flights.map(f => ({ kind: f.kind, age: (now - f.start) / 1000, shown: f.shown, end: f.end, start: f.start, seconds: f.seconds })),
      blasts: this.blasts.map(b => ({ age: (now - b.start) / 1000, small: b.small })),
    };
  }

  /** Everything off at once: a skip, or leaving the war. */
  clear() {
    for (const f of this.flights.splice(0)) this.release(f);
    for (const b of this.blasts.splice(0)) this.dropBlast(b);
  }

  private dropBlast(b: Blast) {
    for (const s of b.parts) {
      this.group.remove(s);
      s.material.dispose();
    }
    this.group.remove(b.ring);
    (b.ring.material as THREE.Material).dispose();
  }

  update(now: number, camera: THREE.PerspectiveCamera, heightPx: number, reduceMotion: boolean): void {
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / heightPx;
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    // A sprite is hidden when the globe stands between it and the camera
    const cam = camera.position;
    const facing = (p: THREE.Vector3) => {
      const d = this.tmp2.copy(p).sub(cam);
      const len = d.length();
      d.divideScalar(len);
      const along = -cam.dot(d);
      if (along <= 0 || along >= len) return true;
      return cam.lengthSq() - along * along > this.radius * this.radius * 0.995;
    };
    for (const f of [...this.flights]) {
      const raw = (now - f.start) / 1000 / this.slow / f.seconds;
      // Reduced motion: no flight, only its end for a moment
      const t = reduceMotion ? f.end : Math.min(f.end, raw);
      f.shown = t;
      // Reduced motion: a stopped weapon bursts at once where it was stopped
      if (reduceMotion && f.end < 1 && !f.done) {
        f.done = true;
        this.burst(this.at(f, f.end, new THREE.Vector3()), now);
      }
      // A stopped weapon bursts in the air where it was stopped
      if (raw >= f.end && f.end < 1 && !f.done) {
        f.done = true;
        this.burst(this.at(f, f.end, new THREE.Vector3()), now);
      }
      // Reduced motion: the end shows for a moment of wall time, not a share of the flight
      if (reduceMotion ? (now - f.start) / 1000 / this.slow >= 0.35 : raw >= f.end + 0.15) {
        this.flights.splice(this.flights.indexOf(f), 1);
        this.release(f);
        continue;
      }
      if (f.line) {
        const pos = f.line.geometry.getAttribute('position') as THREE.BufferAttribute;
        const n = Math.max(2, Math.ceil(t * (ARC_POINTS - 1)) + 1);
        for (let i = 0; i < n; i++) {
          this.at(f, (t * i) / (n - 1), this.tmp);
          pos.setXYZ(i, this.tmp.x, this.tmp.y, this.tmp.z);
        }
        pos.needsUpdate = true;
        f.line.geometry.setDrawRange(0, n);
        f.line.geometry.computeBoundingSphere();
        (f.line.material as THREE.LineBasicMaterial).opacity = (f.kind === 'bomber' ? 0.5 : 0.9) * (raw > f.end ? 1 - (raw - f.end) / 0.15 : 1);
      }
      const head = this.at(f, t, this.headAt);
      const flying = raw < f.end;
      // The heading on the screen, for the missile's and the plane's nose
      const ahead = this.at(f, Math.min(1, t + 0.02), this.aheadAt).project(camera);
      const here = this.hereAt.copy(head).project(camera);
      const heading = Math.atan2(ahead.y - here.y, (ahead.x - here.x) * camera.aspect) - Math.PI / 2;
      if (f.kind === 'missile' || f.kind === 'bomber') {
        const missile = f.kind === 'missile';
        const [first, second] = f.head;
        if (missile) {
          first.position.copy(head);
          first.scale.setScalar(46 * perPx);
          first.visible = facing(head) && flying;
          second.position.copy(head);
          second.scale.setScalar(34 * perPx);
          second.material.rotation = heading;
          second.visible = facing(head) && flying;
        } else {
          first.position.copy(head);
          first.scale.setScalar(40 * perPx);
          first.material.rotation = heading;
          first.visible = facing(head) && flying;
        }
        // The trail: puffs left behind along the way, the oldest fading and growing
        const puffs = f.head.slice(missile ? 2 : 1);
        puffs.forEach((s, i) => {
          const back = (i + 1) / puffs.length;
          const u = t - back * (missile ? 0.45 : 0.3);
          const fadeOut = raw > f.end ? 1 - clamp01((raw - f.end) / 0.15) : 1;
          if (u <= 0.005) { s.visible = false; return; }
          const at = this.at(f, u, s.position);
          s.scale.setScalar((missile ? 10 + 16 * back : 4 + 3 * back) * perPx);
          s.material.opacity = (missile ? 0.85 : 0.7) * (1 - back) * fadeOut;
          s.visible = facing(at) && s.material.opacity > 0.02;
        });
      } else {
        f.head.forEach((s, i) => {
          const u = clamp01(t - (i / PEOPLE_DOTS) * 0.35) / 0.65;
          const at = this.at(f, Math.min(1, u), s.position);
          s.scale.setScalar(7 * perPx);
          s.visible = facing(at) && u > 0 && u < 1;
        });
      }
    }
    for (const b of [...this.blasts]) {
      const age = (now - b.start) / 1000 / this.slow;
      // Reduced motion: the cloud stands still, briefly
      const length = (b.small ? 0.4 : 1) * (reduceMotion ? 1.6 : BLAST_S);
      if (age >= length) {
        this.blasts.splice(this.blasts.indexOf(b), 1);
        this.dropBlast(b);
        continue;
      }
      const ground = b.air ? this.tmp.copy(b.air) : this.tmp.copy(b.at).multiplyScalar(this.radius * 1.001);
      const visible = facing(b.air ?? ground.clone().multiplyScalar(1.002));
      // The world length of one screen pixel at the blast
      const px = perPx * ground.distanceTo(camera.position);
      const u = age / length;
      const k = b.size;
      const fade = 1 - smooth(clamp01((u - 0.7) / 0.3));
      const up = (h: number) => ground.clone().addScaledVector(camUp, h * px * k);
      // A sprite `w` × `h` px (h defaults to w)
      const set = (s: THREE.Sprite | undefined, pos: THREE.Vector3, w: number, opacity: number, h = w) => {
        if (!s) return;
        s.position.copy(pos);
        s.scale.set(Math.max(0.001, w * k * perPx), Math.max(0.001, h * k * perPx), 1);
        s.material.opacity = opacity;
        s.visible = visible && opacity > 0.01;
      };
      const [flash, fire, stemLow, stemHigh, cap, capL, capR, capGlow, dust] = b.parts;
      // The flash: white and wide for the first moment
      set(flash, ground, 170 * (0.4 + smooth(clamp01(age / 0.12))), reduceMotion ? 0.6 * (1 - u) : 1 - smooth(clamp01(age / 0.5)));
      if (b.small) {
        set(fire, ground, 40, 1 - u);
        continue;
      }
      // The fireball grows and rises on a narrow stem, then cools into a wide, flat cap with a
      // glowing underside; dust spreads at the foot (a cartoon of a mushroom cloud)
      const rise = reduceMotion ? 1 : smooth(clamp01(age / 1.8));
      const capY = 62 * rise;
      const spread = 1 + 0.45 * smooth(clamp01((age - 0.9) / 2.2));
      set(fire, up(8 + capY * 0.9), 30 + 26 * rise, (1 - smooth(clamp01((age - 1.1) / 1.2))) * 0.95);
      set(stemLow, up(10 + 12 * rise), 14 + 6 * rise, rise * 0.9 * fade, 26 + 10 * rise);
      set(stemHigh, up(18 + 30 * rise), 12 + 6 * rise, rise * 0.9 * fade, 30 + 16 * rise);
      set(cap, up(capY + 8), 64 * spread, rise * 0.97 * fade, 38 * spread);
      const side = camUp.clone().cross(ground.clone().sub(camera.position).normalize()).normalize();
      set(capL, up(capY + 1).addScaledVector(side, 24 * spread * px * k), 40 * spread, rise * 0.95 * fade, 26 * spread);
      set(capR, up(capY + 1).addScaledVector(side, -24 * spread * px * k), 40 * spread, rise * 0.95 * fade, 26 * spread);
      set(capGlow, up(capY - 2), 70 * spread, rise * 0.75 * (1 - smooth(clamp01((age - 1.0) / 2.4))), 22 * spread);
      set(dust, up(3), 46 + 50 * rise, 0.85 * rise * fade, 16 + 10 * rise);
      // The shock ring on the ground, lying flat on the globe
      const r = (reduceMotion ? 50 : 20 + 120 * smooth(clamp01(age / 1.4))) * px * k;
      b.ring.position.copy(ground);
      b.ring.lookAt(ground.clone().multiplyScalar(2));
      b.ring.scale.setScalar(r);
      (b.ring.material as THREE.MeshBasicMaterial).opacity = (1 - smooth(clamp01(age / 1.6))) * 0.8;
      b.ring.visible = visible;
    }
  }
}
