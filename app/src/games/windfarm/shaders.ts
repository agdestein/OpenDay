// GLSL sources for the stable-fluids solver (semi-Lagrangian advection,
// Jacobi pressure projection, vorticity confinement). Tuned for looks, not
// accuracy: the edges are outflow-only (enforced in the constrain pass), not
// proper no-slip walls.
//
// The core solver shaders (advection, splat, curl, vorticity, divergence,
// clear, pressure, gradient subtract) are adapted from Pavel Dobryakov's
// WebGL-Fluid-Simulation, ported to GLSL ES 3.0:
//   https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
//   Copyright (c) 2017 Pavel Dobryakov, MIT License.
// The constrain (wind/obstacles/turbines), probe, and display passes are our
// own additions.

export const MAX_OBSTACLES = 16;
export const MAX_TURBINES = 16;

export const vertexSrc = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const header = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 frag;
`;

/**
 * Velocity is stored in cells of a fixed reference grid per second (see
 * fluid.ts), so uVelToUv converts it to uv units independent of the actual
 * grid resolution.
 */
export const advectionSrc = `${header}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uVelToUv;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uVelToUv;
  frag = texture(uSource, coord) / (1.0 + uDissipation * uDt);
}
`;

/** A Gaussian blob, added onto the target with additive blending. */
export const splatSrc = `${header}
uniform float uAspect;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  frag = vec4(exp(-dot(p, p) / uRadius) * uColor, 0.0);
}
`;

export const curlSrc = `${header}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
  frag = vec4(0.5 * ((R - L) - (T - B)), 0.0, 0.0, 1.0);
}
`;

export const vorticitySrc = `${header}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uDt;
void main() {
  float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 1e-4;
  force *= uStrength * C * vec2(1.0, -1.0);
  vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
  frag = vec4(velocity, 0.0, 1.0);
}
`;

export const divergenceSrc = `${header}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  frag = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}
`;

/** Multiplies a texture by a constant (used to relax the previous pressure). */
export const clearSrc = `${header}
uniform sampler2D uTexture;
uniform float uValue;
void main() {
  frag = uValue * texture(uTexture, vUv);
}
`;

// The right edge is an open outflow: pressure is pinned to zero just outside
// it (Dirichlet), so air leaves freely instead of piling up against a wall.
// The other edges keep the clamp-to-edge (zero-gradient) condition.
const outflowPressure = `
float sampleR(sampler2D p, vec2 uv, vec2 texel) {
  return uv.x + texel.x > 1.0 ? 0.0 : texture(p, uv + vec2(texel.x, 0.0)).x;
}
`;

export const pressureSrc = `${header}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
${outflowPressure}
void main() {
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = sampleR(uPressure, vUv, uTexel);
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float divergence = texture(uDivergence, vUv).x;
  frag = vec4(0.25 * (L + R + B + T - divergence), 0.0, 0.0, 1.0);
}
`;

export const gradientSubtractSrc = `${header}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
${outflowPressure}
void main() {
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = sampleR(uPressure, vUv, uTexel);
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 velocity = texture(uVelocity, vUv).xy - 0.5 * vec2(R - L, T - B);
  frag = vec4(velocity, 0.0, 1.0);
}
`;

/** Wind inflow at the left edge, outflow-only walls, zero velocity inside obstacles. */
export const constrainSrc = `${header}
uniform sampler2D uVelocity;
uniform float uAspect;
uniform int uCount;
uniform vec3 uObstacles[${MAX_OBSTACLES}];
uniform float uWind;
uniform float uDt;
uniform vec2 uTexel;
uniform int uTurbineCount;
uniform vec3 uTurbines[${MAX_TURBINES}];
// Drag rate at the disk center (1/s); the Gaussian profile integrates to about
// the same total drag as the old 0.8-radius-wide hard disk at 8/s.
const float DISK_DRAG = 14.0;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy;
  if (uWind > 0.0) {
    // Gentle relaxation toward a uniform wind everywhere (a constant field is
    // divergence-free, so the pressure projection preserves it), plus a strong
    // pull in the inflow strip at the left edge.
    float inflow = smoothstep(0.06, 0.0, vUv.x);
    velocity = mix(velocity, vec2(uWind, 0.0), min(1.0, uDt * (0.6 + inflow * 10.0)));
  }
  // Edges are open outflow: an edge texel must never hold inward velocity.
  // Advection clamps its backtrace at the walls, so an edge texel with inward
  // velocity samples itself and re-injects that velocity every frame — and the
  // divergence stencil clamps too, so the pressure solve can't see the jet. A
  // burst rebounding off a wall would otherwise seed a runaway inflow. The
  // left edge stays open for the deliberate wind inflow.
  if (vUv.x < uTexel.x && uWind <= 0.0) velocity.x = min(velocity.x, 0.0);
  if (vUv.x > 1.0 - uTexel.x) velocity.x = max(velocity.x, 0.0);
  if (vUv.y < uTexel.y) velocity.y = min(velocity.y, 0.0);
  if (vUv.y > 1.0 - uTexel.y) velocity.y = max(velocity.y, 0.0);
  // Turbines are porous drag disks (actuator disks), not solid obstacles: they
  // slow the flow passing through, leaving a momentum-deficit wake downstream.
  // The disk weight is smooth — a thin Gaussian across the flow direction and
  // soft rotor tips — because a hard-edged disk only a few cells wide drags
  // each grid row by a different amount, and the wind carries those rows
  // downstream as stripes.
  for (int i = 0; i < ${MAX_TURBINES}; i++) {
    if (i >= uTurbineCount) break;
    float r = uTurbines[i].z;
    vec2 t = (vUv - uTurbines[i].xy) / r;
    t.x *= uAspect;
    float w = exp(-t.x * t.x * 15.0) * (1.0 - smoothstep(0.75, 1.1, abs(t.y)));
    velocity *= exp(-DISK_DRAG * w * uDt);
  }
  // Solid obstacles, with a soft edge about 1.5 cells wide so the stair-stepped
  // grid outline doesn't seed grid-scale noise.
  float soft = 1.5 * uTexel.y;
  for (int i = 0; i < ${MAX_OBSTACLES}; i++) {
    if (i >= uCount) break;
    vec2 d = vUv - uObstacles[i].xy;
    d.x *= uAspect;
    velocity *= smoothstep(uObstacles[i].z - soft, uObstacles[i].z, length(d));
  }
  frag = vec4(velocity, 0.0, 1.0);
}
`;

/**
 * Samples velocity at up to MAX_TURBINES uv points into an Nx1 target, so the
 * game layer can read local wind speeds back with a single tiny readPixels.
 */
export const probeSrc = `${header}
uniform sampler2D uVelocity;
uniform vec2 uPoints[${MAX_TURBINES}];
void main() {
  vec2 v = texture(uVelocity, uPoints[int(gl_FragCoord.x)]).xy;
  frag = vec4(v, 0.0, 1.0);
}
`;

export const displaySrc = `${header}
uniform sampler2D uDye;
uniform sampler2D uVelocity;
uniform float uAspect;
uniform int uCount;
uniform vec3 uObstacles[${MAX_OBSTACLES}];
uniform float uWakeMode;
uniform float uWind;

// Cubic B-spline texture lookup from four bilinear taps (Sigg & Hadwiger,
// GPU Gems 2 ch. 20). The coarse velocity grid is stretched ~8x onto the
// screen; plain bilinear filtering leaves visible kinks along the grid lines,
// which the colormap then turns into hard edges.
vec4 textureBSpline(sampler2D tex, vec2 uv) {
  vec2 size = vec2(textureSize(tex, 0));
  vec2 st = uv * size - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1;
  vec2 g1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / g0) / size;
  vec2 h1 = (i + 1.5 + w3 / g1) / size;
  return g0.y * (g0.x * texture(tex, h0) + g1.x * texture(tex, vec2(h1.x, h0.y)))
       + g1.y * (g0.x * texture(tex, vec2(h0.x, h1.y)) + g1.x * texture(tex, h1));
}

void main() {
  vec3 color;
  if (uWakeMode > 0.5) {
    // Wake view (wind-farm challenge): hue encodes local wind speed relative
    // to the free stream, so the momentum-deficit wake behind each rotor
    // glows warm against the cool full-speed flow. One continuous ramp
    // (deep red -> orange -> sea blue) rather than narrow bands, so small
    // speed ripples read as gentle shading, not hard-edged blotches.
    // Velocity dissipation drags the free stream below the inflow speed, so
    // normalize against that, not the raw inflow.
    float frac = length(textureBSpline(uVelocity, vUv).xy) / max(0.88 * uWind, 1.0);
    float t = clamp((frac - 0.2) / 0.8, 0.0, 1.0);
    vec3 slow = vec3(0.55, 0.07, 0.07);
    vec3 mid = vec3(0.94, 0.55, 0.12);
    vec3 fast = vec3(0.05, 0.27, 0.44);
    color = mix(mix(slow, mid, smoothstep(0.0, 0.55, t)), fast, smoothstep(0.35, 1.0, t));
    // Keep the dye streaks as brightness only, so the motion of the flow
    // stays visible without recoloring the wake map.
    color += vec3(dot(texture(uDye, vUv).rgb, vec3(0.2126, 0.7152, 0.0722)) * 0.12);
  } else {
    // Dark blue background with a soft vertical gradient.
    vec3 background = mix(vec3(0.02, 0.03, 0.08), vec3(0.05, 0.07, 0.14), vUv.y);
    color = background + texture(uDye, vUv).rgb;
  }
  for (int i = 0; i < ${MAX_OBSTACLES}; i++) {
    if (i >= uCount) break;
    vec2 d = vUv - uObstacles[i].xy;
    d.x *= uAspect;
    float dist = length(d);
    float r = uObstacles[i].z;
    float inside = smoothstep(r, r * 0.96, dist);
    float rim = smoothstep(r, r * 0.9, dist) - smoothstep(r * 0.88, r * 0.8, dist);
    color = mix(color, vec3(0.16, 0.19, 0.26), inside);
    color += rim * vec3(0.25, 0.3, 0.4);
  }
  // Soft tone map so bright dye doesn't clip harshly.
  color = color / (1.0 + 0.35 * color);
  frag = vec4(color, 1.0);
}
`;
