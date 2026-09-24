// Ready-made skies for Gravity Doodle's toy, each a small lesson you can then
// poke at (throw things in, grab a star):
// - Our Sun: Mercury, Venus, Earth and Mars at their real distances (scaled),
//   with real mass ratios (tiny), so Kepler's law shows: inner planets race.
// - Two suns: a Tatooine-style binary with planets circling both stars.
// - Star dance: three equal stars chasing each other round one figure-8
//   (found by computer: Moore 1993; Chenciner & Montgomery 2000).
// Pure: returns bodies to add; tests/orbits.test.ts checks each sky survives.
import { KINDS, SUN_R, type Body, type Kind } from './physics';

export type PresetName = 'sun' | 'binary' | 'dance';
export const PRESET_ORDER: PresetName[] = ['sun', 'binary', 'dance'];
export const PRESET_EMOJI: Record<PresetName, string> = { sun: '☀️', binary: '🌗', dance: '✨' };

export type PresetBody = Omit<Body, 'id' | 'ax' | 'ay'>;

/**
 * (cx, cy): screen centre; m: the screen's short side; u: unit; gm: the Sun's
 * G·m (the toy's reference mass). `names` label the solar system's planets.
 */
export function preset(name: PresetName, cx: number, cy: number, m: number, u: number, gm: number, names: string[] = []): PresetBody[] {
  const circle = (kind: Kind, r: number, angle: number, mass: number, radius: number, hue: number, extra: Partial<PresetBody> = {}, centralGm = gm): PresetBody => {
    const v = Math.sqrt(centralGm / r);
    return {
      kind,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      vx: -v * Math.sin(angle),
      vy: v * Math.cos(angle),
      gm: mass * gm,
      r: radius,
      hue,
      ...extra,
    };
  };

  if (name === 'sun') {
    // Distances in AU, scaled so Mars sits at 0.45 of the short side. Masses
    // are the real ratios to the Sun, far too small to tug each other.
    const au = (0.45 * m) / 1.524;
    const sun: PresetBody = { kind: 'star', sun: true, x: cx, y: cy, vx: 0, vy: 0, gm, r: SUN_R * u, hue: 45 };
    const planets: [number, number, number, number][] = [
      // AU, mass (Suns), radius (units), hue
      [0.387, 1.7e-7, 6, 30],
      [0.723, 2.4e-6, 10, 48],
      [1.0, 3.0e-6, 10, 212],
      [1.524, 3.2e-7, 8, 12],
    ];
    return [
      sun,
      ...planets.map(([a, mass, r, hue], i) => circle('planet', a * au, 1.3 + 2.1 * i, mass, r * u, hue, { name: names[i] })),
    ];
  }

  if (name === 'binary') {
    // Two stars (0.6 and 0.4 of the Sun) on a tight circle round their
    // centre of mass, and two planets far enough out to be stable.
    const m1 = 0.6;
    const m2 = 0.4;
    const sep = 0.1 * m;
    const total = (m1 + m2) * gm;
    const w = Math.sqrt(total / sep ** 3);
    const r1 = (sep * m2) / (m1 + m2);
    const r2 = (sep * m1) / (m1 + m2);
    const a1: PresetBody = { kind: 'star', sun: true, x: cx + r1, y: cy, vx: 0, vy: w * r1, gm: m1 * gm, r: 20 * u, hue: 45 };
    const a2: PresetBody = { kind: 'star', x: cx - r2, y: cy, vx: 0, vy: -w * r2, gm: m2 * gm, r: 16 * u, hue: 15 };
    return [
      a1,
      a2,
      circle('planet', 0.3 * m, 2.2, KINDS.pebble.mass, KINDS.planet.r * u, 190, {}, total),
      circle('planet', 0.43 * m, 5, KINDS.pebble.mass, KINDS.planet.r * u, 100, {}, total),
    ];
  }

  // The figure-8 choreography (G = m = 1, unit length), scaled so the 8 is
  // about 0.66 of the short side wide: positions × L, speeds × √(gm/L).
  const L = 0.33 * m;
  const k = Math.sqrt(gm / L);
  const x1 = 0.97000436;
  const y1 = -0.24308753;
  const vx3 = -0.93240737;
  const vy3 = -0.86473146;
  const star = (x: number, y: number, vx: number, vy: number, hue: number, sun = false): PresetBody => ({
    kind: 'star',
    sun,
    x: cx + L * x,
    y: cy + L * y,
    vx: k * vx,
    vy: k * vy,
    gm,
    r: 18 * u,
    hue,
  });
  return [
    star(x1, y1, -vx3 / 2, -vy3 / 2, 45, true),
    star(-x1, -y1, -vx3 / 2, -vy3 / 2, 205),
    star(0, 0, vx3, vy3, 12),
  ];
}
