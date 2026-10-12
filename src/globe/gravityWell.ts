/**
 * gravityWell.ts — a press makes a gravity well (STORY-035; the feel of Sami's shader
 * gallery): the stars swirl in toward the pointer and a glow gathers under it, growing
 * while the press lasts and fading after it. The well follows the pointer smoothly.
 *
 * Positions are in "view units": NDC with x scaled by the aspect ratio, so the well is round.
 */
import * as THREE from 'three';

export interface Well {
  /** Where the well is and where the pointer is. */
  x: number; y: number; tx: number; ty: number;
  /** Strength now (0–1) and the strength it moves toward: 1 pressed, 0 released. */
  g: number; target: number;
}

export const newWell = (): Well => ({ x: 0, y: 0, tx: 0, ty: 0, g: 0, target: 0 });

/** A press at x, y: a faded well starts there, a live one moves there. */
export function pressWell(w: Well, x: number, y: number): void {
  if (w.g < 0.05) { w.x = x; w.y = y; }
  w.tx = x; w.ty = y; w.target = 1;
}
export function moveWell(w: Well, x: number, y: number): void { w.tx = x; w.ty = y; }
export function releaseWell(w: Well): void { w.target = 0; }

/** One frame of dt seconds: the well follows the pointer (rate 10/s), its strength the press (6/s). */
export function stepWell(w: Well, dt: number): void {
  const k = Math.min(1, dt * 10);
  w.x += (w.tx - w.x) * k;
  w.y += (w.ty - w.y) * k;
  w.g += (w.target - w.g) * Math.min(1, dt * 6);
  if (w.target === 0 && w.g < 1e-3) w.g = 0;
}

const ACCENT = new THREE.Color('#9184d9');
const ACCENT_LIGHT = new THREE.Color('#b5abfc');

/** Uniforms the star and glow shaders share. */
export function wellUniforms() {
  return {
    wellPos: { value: new THREE.Vector2() },
    wellG: { value: 0 },
    /** 0 with reduced motion: the stars stay put, the glow still shows. */
    wellBend: { value: 1 },
    aspect: { value: 1 },
    time: { value: 0 },
    accent: { value: ACCENT.clone() },
    accentLight: { value: ACCENT_LIGHT.clone() },
  };
}
export type WellUniforms = ReturnType<typeof wellUniforms>;

/**
 * Stars as round points that the well pulls in and turns around itself; near it they brighten
 * toward the accent. Replaces PointsMaterial (size 0.15, attenuated by distance).
 */
export function starMaterial(u: WellUniforms, size: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...u, size: { value: size }, scale: { value: 400 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform vec2 wellPos; uniform float wellG, wellBend, aspect, size, scale;
      varying float vGlow;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec4 clip = projectionMatrix * mv;
        vec2 p = clip.xy / clip.w * vec2(aspect, 1.0);
        vec2 d = p - wellPos;
        float l = dot(d, d);
        float g = wellG * wellBend;
        // Pull in and turn: strongest near the well, nothing far away
        float a = g * 0.9 / (l + 0.12);
        d = mat2(cos(a), sin(a), -sin(a), cos(a)) * d / (1.0 + g * 0.35 / (l + 0.08));
        clip.xy = (wellPos + d) / vec2(aspect, 1.0) * clip.w;
        gl_Position = clip;
        vGlow = wellG * 0.04 / (l + 0.02);
        gl_PointSize = size * scale / -mv.z * (1.0 + min(vGlow, 1.5));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 accentLight;
      varying float vGlow;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = dot(c, c);
        if (r > 0.25) discard;
        gl_FragColor = vec4(mix(vec3(1.0), accentLight, min(vGlow, 1.0)), 1.0 - smoothstep(0.12, 0.25, r));
      }`,
  });
}

/** The glow under the well, over everything, on a quad that covers the screen. */
export function glowMesh(u: WellUniforms): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    // Light adds to what is there (premultiplied: the colour is its own coverage)
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    vertexShader: /* glsl */ `
      varying vec2 vP;
      uniform float aspect;
      void main() { vP = position.xy * vec2(aspect, 1.0); gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec2 wellPos; uniform float wellG, time; uniform vec3 accent, accentLight;
      varying vec2 vP;
      void main() {
        vec2 d = vP - wellPos;
        float i = wellG * 0.012 / (dot(d, d) + 0.004);
        // Saturating light: violet at the edge, nearly white at the core
        vec3 c = 1.0 - exp(-mix(accent, accentLight, 0.5 + 0.5 * sin(time * 0.8)) * i * 1.6);
        gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
      }`,
  }));
  mesh.frustumCulled = false;
  return mesh;
}
