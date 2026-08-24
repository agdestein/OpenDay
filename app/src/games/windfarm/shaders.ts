// GLSL sources for the stable-fluids solver (semi-Lagrangian advection,
// Jacobi pressure projection, vorticity confinement). Tuned for looks, not
// accuracy: no-slip walls and outflow boundaries are simply not enforced.

export const MAX_OBSTACLES = 16;

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

/** Velocity is stored in sim-grid cells per second. */
export const advectionSrc = `${header}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  frag = texture(uSource, coord) / (1.0 + uDissipation * uDt);
}
`;

export const splatSrc = `${header}
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  frag = vec4(texture(uTarget, vUv).xyz + splat, 1.0);
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

export const pressureSrc = `${header}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
void main() {
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
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
void main() {
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 velocity = texture(uVelocity, vUv).xy - 0.5 * vec2(R - L, T - B);
  frag = vec4(velocity, 0.0, 1.0);
}
`;

/** Wind inflow at the left edge + zero velocity inside obstacles. */
export const constrainSrc = `${header}
uniform sampler2D uVelocity;
uniform float uAspect;
uniform int uCount;
uniform vec3 uObstacles[${MAX_OBSTACLES}];
uniform float uWind;
uniform float uDt;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy;
  if (uWind > 0.0) {
    // Gentle relaxation toward a uniform wind everywhere (a constant field is
    // divergence-free, so the pressure projection preserves it), plus a strong
    // pull in the inflow strip at the left edge.
    float inflow = smoothstep(0.06, 0.0, vUv.x);
    velocity = mix(velocity, vec2(uWind, 0.0), min(1.0, uDt * (0.6 + inflow * 10.0)));
  }
  for (int i = 0; i < ${MAX_OBSTACLES}; i++) {
    if (i >= uCount) break;
    vec2 d = vUv - uObstacles[i].xy;
    d.x *= uAspect;
    if (length(d) < uObstacles[i].z) velocity = vec2(0.0);
  }
  frag = vec4(velocity, 0.0, 1.0);
}
`;

export const displaySrc = `${header}
uniform sampler2D uDye;
uniform float uAspect;
uniform int uCount;
uniform vec3 uObstacles[${MAX_OBSTACLES}];
void main() {
  vec3 color = texture(uDye, vUv).rgb;
  // Dark blue background with a soft vertical gradient.
  vec3 background = mix(vec3(0.02, 0.03, 0.08), vec3(0.05, 0.07, 0.14), vUv.y);
  color = background + color;
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
