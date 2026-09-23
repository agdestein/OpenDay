// GPU map renderer for Weather Detective: every screen pixel samples the
// temperature grid with a smooth bicubic (B-spline) filter, draws thin
// anti-aliased isotherms, smooth coastlines from the land mask, and
// greys out, blurs and marks with question marks where the computer is
// unsure. The 2D-canvas path in game.ts is the fallback.
import { LUT_RGBA, type Scale } from './render';

/** A grid field covering the map from its north-west corner. */
export interface FieldLayer {
  data: Float32Array;
  nx: number;
  ny: number;
  /** Cell size in km. */
  dx: number;
  dy: number;
}

export interface MapFrame {
  field: FieldLayer;
  /** 'temp': weather colours (°C); 'error': white → red up to `errorFull` °C. */
  mode: 'temp' | 'error';
  scale: Scale;
  errorFull?: number;
  isotherms: boolean;
  /**
   * "Unknown" overlay: how unsure the computer is (spread / prior spread of
   * the local weather) per cell, without NaN. Drawn as a greyed, blurred map
   * with drifting question marks — deliberately nothing like weather.
   */
  fog?: FieldLayer | null;
  /** A second temperature field shown west of `frac` (the reveal wipe). */
  wipe?: { field: FieldLayer; frac: number } | null;
  time: number;
}

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uA, uB, uFog, uLand, uLut, uQ;
uniform vec2 uSizeA, uSizeB, uSizeFog, uSizeLand;
uniform vec2 uExtA, uExtB, uExtFog;
uniform vec2 uKm;
uniform int uMode;
uniform float uLo, uHi, uErrFull, uIso, uFogOn, uHasB, uWipe, uTime, uPx, uAspect, uQSize;

vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}

// Cubic B-spline filtering from four bilinear taps.
float bicubic(sampler2D tex, vec2 uv, vec2 size) {
  vec2 tc = uv * size - 0.5;
  vec2 f = fract(tc);
  tc -= f;
  vec4 xc = cubic(f.x), yc = cubic(f.y);
  vec4 c = tc.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) / size.xxyy;
  float s0 = texture(tex, o.xz).r, s1 = texture(tex, o.yz).r;
  float s2 = texture(tex, o.xw).r, s3 = texture(tex, o.yw).r;
  float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

vec3 tempColor(float t) {
  float x = clamp((t - uLo) / (uHi - uLo), 0.0, 1.0);
  return texture(uLut, vec2(x * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).rgb;
}

// How unsure the computer is at a map position (0 = sure, 1 = no idea).
float unsureAt(vec2 uv) {
  float rel = bicubic(uFog, uv * uExtFog, uSizeFog);
  return clamp((rel - 0.35) / 0.6, 0.0, 1.0);
}

void main() {
  float land = bicubic(uLand, vUv, uSizeLand);
  float aa = fwidth(land) * 0.7 + 1e-4;
  float landA = smoothstep(0.5 - aa, 0.5 + aa, land);
  if (landA <= 0.0) discard;

  bool useB = uHasB > 0.5 && vUv.x < uWipe;
  float unsure = uFogOn > 0.5 && !useB ? unsureAt(vUv) : 0.0;
  float v = useB ? bicubic(uB, vUv * uExtB, uSizeB) : bicubic(uA, vUv * uExtA, uSizeA);
  if (unsure > 0.01) {
    // Out of focus where unsure: average a ring around the pixel.
    vec2 r = unsure * 16.0 * vec2(uPx, uPx * uAspect);
    float acc = v;
    for (int k = 0; k < 8; k++) {
      float ang = float(k) * 0.7854;
      acc += texture(uA, (vUv + r * vec2(cos(ang), sin(ang))) * uExtA).r;
    }
    v = mix(v, acc / 9.0, unsure);
  }
  vec3 col;
  if (uMode == 1 && !useB) {
    float a = clamp(v / uErrFull, 0.0, 1.0);
    col = vec3(1.0 - 0.235 * a, 0.96 - 0.84 * a, 0.92 - 0.8 * a);
  } else {
    col = tempColor(v);
    if (uIso > 0.5) {
      // Thin anti-aliased contour every whole degree (not where unsure).
      float d = abs(fract(v + 0.5) - 0.5);
      float w = fwidth(v);
      float line = 1.0 - smoothstep(0.6 * w, 1.6 * w, d);
      col *= 1.0 - 0.2 * line * (1.0 - unsure);
    }
  }
  if (unsure > 0.0) {
    // Grey it out and scatter drifting question marks over it.
    float g = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(0.34 + 0.35 * g), 0.88 * unsure);
    vec2 px = vec2(vUv.x / uPx, vUv.y / (uPx * uAspect));
    float q = texture(uQ, px / uQSize + vec2(uTime * 0.02, uTime * 0.008)).r;
    col = mix(col, vec3(0.96, 0.97, 1.0), q * smoothstep(0.25, 0.8, unsure) * 0.6);
  }
  if (uHasB > 0.5 && uWipe < 1.0 && abs(vUv.x - uWipe) < 2.0 * uPx) col = vec3(1.0);
  outColor = vec4(col * landA, landA);
}`;

/** Replace NaN cells by the average of their neighbours, spreading outwards (a copy). */
export function fillNaN(field: Float32Array, nx: number, ny: number, passes = 8): Float32Array {
  const out = field.slice();
  let sum = 0, n = 0;
  for (const v of out) if (!Number.isNaN(v)) {
    sum += v;
    n++;
  }
  const mean = n ? sum / n : 0;
  for (let pass = 0; pass < passes; pass++) {
    const src = out.slice();
    let left = 0;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!Number.isNaN(src[k])) continue;
        let s = 0, c = 0;
        if (i > 0 && !Number.isNaN(src[k - 1])) { s += src[k - 1]; c++; }
        if (i < nx - 1 && !Number.isNaN(src[k + 1])) { s += src[k + 1]; c++; }
        if (j > 0 && !Number.isNaN(src[k - nx])) { s += src[k - nx]; c++; }
        if (j < ny - 1 && !Number.isNaN(src[k + nx])) { s += src[k + nx]; c++; }
        if (c) out[k] = s / c;
        else left++;
      }
    if (!left) break;
  }
  for (let k = 0; k < out.length; k++) if (Number.isNaN(out[k])) out[k] = mean;
  return out;
}

export class MapGL {
  readonly canvas = document.createElement('canvas');
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private tex: Record<'A' | 'B' | 'Fog' | 'Land' | 'Lut' | 'Q', WebGLTexture>;
  private loc = new Map<string, WebGLUniformLocation | null>();
  private landSize: [number, number];
  /** Filled copies of fields that contain NaN (truth, error): computed once each. */
  private filled = new WeakMap<Float32Array, Float32Array | null>();

  /** Returns null when WebGL2 is unavailable (the caller falls back to 2D). */
  static create(land: Uint8Array, nx: number, ny: number, widthKm: number, heightKm: number): MapGL | null {
    try {
      return new MapGL(land, nx, ny, widthKm, heightKm);
    } catch (error) {
      console.warn('Weather Detective: no WebGL2 map, using the 2D fallback', error);
      return null;
    }
  }

  private constructor(land: Uint8Array, nx: number, ny: number, private widthKm: number, private heightKm: number) {
    const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const make = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.tex = { A: make(), B: make(), Fog: make(), Land: make(), Lut: make(), Q: make() };
    for (const t of [this.tex.A, this.tex.B, this.tex.Fog]) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array(1));
    }
    // A repeating tile of two question marks (the "unknown" pattern).
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const t2 = tile.getContext('2d')!;
    t2.fillStyle = '#fff';
    t2.font = '800 52px system-ui, sans-serif';
    t2.textAlign = 'center';
    t2.textBaseline = 'middle';
    t2.fillText('?', 32, 34);
    t2.fillText('?', 96, 98);
    const alpha = t2.getImageData(0, 0, 128, 128).data;
    const q = new Uint8Array(128 * 128);
    for (let k = 0; k < q.length; k++) q[k] = alpha[k * 4 + 3];
    gl.bindTexture(gl.TEXTURE_2D, this.tex.Q);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 128, 128, 0, gl.RED, gl.UNSIGNED_BYTE, q);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    const bytes = new Uint8Array(land.length);
    for (let k = 0; k < land.length; k++) bytes[k] = land[k] ? 255 : 0;
    gl.bindTexture(gl.TEXTURE_2D, this.tex.Land);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, nx, ny, 0, gl.RED, gl.UNSIGNED_BYTE, bytes);
    this.landSize = [nx, ny];
    gl.bindTexture(gl.TEXTURE_2D, this.tex.Lut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, LUT_RGBA);
    gl.useProgram(prog);
    ['uA', 'uB', 'uFog', 'uLand', 'uLut', 'uQ'].forEach((name, unit) => gl.uniform1i(this.u(name), unit));
  }

  private u(name: string): WebGLUniformLocation | null {
    if (!this.loc.has(name)) this.loc.set(name, this.gl.getUniformLocation(this.prog, name));
    return this.loc.get(name)!;
  }

  resize(w: number, h: number): void {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private upload(unit: 'A' | 'B' | 'Fog', layer: FieldLayer, sizeName: string, extName: string): void {
    const gl = this.gl;
    let data = layer.data;
    let cached = this.filled.get(data);
    if (cached === undefined) {
      cached = data.some(Number.isNaN) ? fillNaN(data, layer.nx, layer.ny) : null;
      // Only fields that contain NaN are immutable ones (truth, error); keep those.
      if (cached) this.filled.set(data, cached);
    }
    if (cached) data = cached;
    gl.bindTexture(gl.TEXTURE_2D, this.tex[unit]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, layer.nx, layer.ny, 0, gl.RED, gl.FLOAT, data);
    gl.uniform2f(this.u(sizeName), layer.nx, layer.ny);
    gl.uniform2f(this.u(extName), this.widthKm / (layer.nx * layer.dx), this.heightKm / (layer.ny * layer.dy));
  }

  render(f: MapFrame): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.upload('A', f.field, 'uSizeA', 'uExtA');
    gl.uniform1f(this.u('uHasB'), f.wipe ? 1 : 0);
    if (f.wipe) {
      this.upload('B', f.wipe.field, 'uSizeB', 'uExtB');
      gl.uniform1f(this.u('uWipe'), f.wipe.frac);
    }
    gl.uniform1f(this.u('uFogOn'), f.fog ? 1 : 0);
    if (f.fog) this.upload('Fog', f.fog, 'uSizeFog', 'uExtFog');
    gl.uniform2f(this.u('uSizeLand'), this.landSize[0], this.landSize[1]);
    gl.uniform2f(this.u('uKm'), this.widthKm, this.heightKm);
    gl.uniform1i(this.u('uMode'), f.mode === 'error' ? 1 : 0);
    gl.uniform1f(this.u('uLo'), f.scale.lo);
    gl.uniform1f(this.u('uHi'), f.scale.hi);
    gl.uniform1f(this.u('uErrFull'), f.errorFull ?? 2);
    gl.uniform1f(this.u('uIso'), f.isotherms ? 1 : 0);
    gl.uniform1f(this.u('uTime'), f.time);
    gl.uniform1f(this.u('uPx'), 1 / this.canvas.width);
    gl.uniform1f(this.u('uAspect'), this.canvas.width / this.canvas.height);
    // About ten question-mark tiles across the map, whatever its size.
    gl.uniform1f(this.u('uQSize'), this.canvas.width / 10);
    const units: ('A' | 'B' | 'Fog' | 'Land' | 'Lut' | 'Q')[] = ['A', 'B', 'Fog', 'Land', 'Lut', 'Q'];
    units.forEach((name, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[name]);
    });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
