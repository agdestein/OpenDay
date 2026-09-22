// Real-time 2D fluid solver on the GPU (WebGL2), in the classic stable-fluids
// style of GPU Gems ch. 38: splat inputs, vorticity confinement, Jacobi
// pressure projection, semi-Lagrangian advection. Everything is tuned for
// looks, not accuracy.
//
// The solver core is adapted from Pavel Dobryakov's WebGL-Fluid-Simulation
// (https://github.com/PavelDoGreat/WebGL-Fluid-Simulation, Copyright (c) 2017
// Pavel Dobryakov, MIT License), rewritten in TypeScript on WebGL2 — see
// shaders.ts for which passes are ported and which are our own.
import {
  MAX_LENSES,
  MAX_OBSTACLES,
  MAX_TURBINES,
  advectionSrc,
  arrowFragmentSrc,
  arrowVertexSrc,
  clearSrc,
  constrainSrc,
  curlSrc,
  displaySrc,
  divergenceSrc,
  gradientSubtractSrc,
  particleFragmentSrc,
  particleUpdateSrc,
  particleVertexSrc,
  pressureSrc,
  probeSrc,
  splatSrc,
  vertexSrc,
  vorticitySrc,
} from './shaders';

/** Obstacle in uv coordinates; radius is a fraction of the screen height. */
export interface Obstacle {
  x: number;
  y: number;
  r: number;
}

/** Which field the display pass colors the screen by. */
export type FieldView = 'dye' | 'speed' | 'pressure' | 'swirl';

/**
 * Magnifier inset: a disk at (x, y) in uv with radius r (screen heights)
 * showing the spot (srcX, srcY) enlarged `zoom` times; `grid` draws the
 * simulation's own cells inside it.
 */
export interface Lens {
  x: number;
  y: number;
  r: number;
  srcX: number;
  srcY: number;
  zoom: number;
  grid: boolean;
}

/** Turbine drag disk in uv coordinates; radius is a fraction of the screen height. */
export interface TurbineDisk {
  x: number;
  y: number;
  r: number;
}

// Simulation grids are a fixed 16:9; the display pass stretches to the canvas.
// Velocities are measured in cells of a 256x144 reference grid per second,
// whatever the actual grid: the game's wind speeds, splat forces and power
// curve then mean the same on every quality tier.
const REF_W = 256;
const REF_H = 144;
/** Quality tiers: [grid width, grid height, pressure iterations]. */
const TIER_HIGH: [number, number, number] = [384, 216, 24];
const TIER_LOW: [number, number, number] = [256, 144, 16];
/** Tracer particles for the wake view: one texel each. */
const PARTICLES_W = 64;
const PARTICLES_H = 40;
/** Tracer streak length, in seconds of travel at the local wind speed. */
const TRAIL_SECONDS = 0.12;
/** Color scales of the pressure and swirl views (field value mapped to full color). */
const PRESSURE_SCALE = 1 / 50;
const CURL_SCALE = 1 / 10;
const DYE_W = 1024;
const DYE_H = 576;

const VELOCITY_DISSIPATION = 0.08;
const DYE_DISSIPATION = 0.45;
const PRESSURE_RELAXATION = 0.8;

interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

interface DoubleTarget {
  read: Target;
  write: Target;
}

class Program {
  handle: WebGLProgram;
  uniforms = new Map<string, WebGLUniformLocation>();

  constructor(
    private gl: WebGL2RenderingContext,
    vertex: WebGLShader,
    fragmentSrc: string,
  ) {
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Shader link failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.deleteShader(fragment);
    this.handle = program;
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i)!;
      this.uniforms.set(info.name, gl.getUniformLocation(program, info.name)!);
    }
  }

  bind(): void {
    this.gl.useProgram(this.handle);
  }

  loc(name: string): WebGLUniformLocation | null {
    return this.uniforms.get(name) ?? null;
  }
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

export class FluidSolver {
  /** False when WebGL2 float render targets are unavailable on this machine. */
  readonly ok: boolean;
  /** Wind speed in reference-grid cells per second; 0 disables wind. */
  wind = 0;
  /**
   * Direction the wind blows toward, in radians: 0 = left to right, positive
   * = turning upward (counterclockwise on screen).
   */
  windAngle = 0;
  /**
   * Vorticity-confinement strength. High values keep stirred swirls lively,
   * but also amplify grid-scale noise into speckle — fine in the dye view,
   * ugly in the wake view, where it shreds the smooth wakes into confetti.
   */
  curlStrength = 25;
  /**
   * Rate (1/s) at which the flow everywhere relaxes toward the uniform wind.
   * It stands in for the turbulent mixing that makes real turbine wakes
   * recover downstream; it also damps the instability that makes a block
   * shed a vortex street, so the toy uses less of it.
   */
  windRelax = 0.6;
  /** Field the screen is colored by. */
  view: FieldView = 'dye';
  /** Discretization view: show the flow on a grid this many cells across; 0 = off. */
  cellsAcross = 0;
  /** Magnifier insets (up to MAX_LENSES). */
  lenses: Lens[] = [];
  /** Velocity arrows on a grid this many arrows across; 0 = off. */
  arrowsAcross = 0;
  /** Show (and advect) the tracer particles: the wake view's moving wind streaks. */
  tracers = false;

  private gl!: WebGL2RenderingContext;
  private programs!: Record<
    | 'advection'
    | 'splat'
    | 'curl'
    | 'vorticity'
    | 'divergence'
    | 'clear'
    | 'pressure'
    | 'gradientSubtract'
    | 'constrain'
    | 'probe'
    | 'display'
    | 'particleUpdate'
    | 'particleDraw'
    | 'arrows',
    Program
  >;
  private velocity!: DoubleTarget;
  private dye!: DoubleTarget;
  private pressure!: DoubleTarget;
  private curl!: Target;
  private divergence!: Target;
  private probeTarget!: Target;
  private particles!: DoubleTarget;
  private dyeReadTarget: Target | null = null;
  private frameCount = 0;
  private probePoints = new Float32Array(MAX_TURBINES * 2);
  private probePixels = new Float32Array(MAX_TURBINES * 4);
  private obstacleData = new Float32Array(MAX_OBSTACLES * 3);
  private obstacleCount = 0;
  private turbineData = new Float32Array(MAX_TURBINES * 3);
  private turbineCount = 0;
  private simW = 0;
  private simH = 0;
  private pressureIterations = 0;

  /** lowQuality starts on the coarse tier (for machines known to be slow). */
  constructor(
    private canvas: HTMLCanvasElement,
    lowQuality = false,
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
    });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
      this.ok = false;
      return;
    }
    this.gl = gl;
    this.ok = true;

    // One shared quad covering the screen.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);

    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
    const particleVertex = compileShader(gl, gl.VERTEX_SHADER, particleVertexSrc);
    const arrowVertex = compileShader(gl, gl.VERTEX_SHADER, arrowVertexSrc);
    this.programs = {
      advection: new Program(gl, vertex, advectionSrc),
      splat: new Program(gl, vertex, splatSrc),
      curl: new Program(gl, vertex, curlSrc),
      vorticity: new Program(gl, vertex, vorticitySrc),
      divergence: new Program(gl, vertex, divergenceSrc),
      clear: new Program(gl, vertex, clearSrc),
      pressure: new Program(gl, vertex, pressureSrc),
      gradientSubtract: new Program(gl, vertex, gradientSubtractSrc),
      constrain: new Program(gl, vertex, constrainSrc),
      probe: new Program(gl, vertex, probeSrc),
      display: new Program(gl, vertex, displaySrc),
      particleUpdate: new Program(gl, vertex, particleUpdateSrc),
      particleDraw: new Program(gl, particleVertex, particleFragmentSrc),
      arrows: new Program(gl, arrowVertex, arrowFragmentSrc),
    };
    gl.deleteShader(vertex);
    gl.deleteShader(particleVertex);
    gl.deleteShader(arrowVertex);

    this.dye = this.createDouble(DYE_W, DYE_H, gl.RGBA16F, gl.RGBA);
    this.createSimTargets(...(lowQuality ? TIER_LOW : TIER_HIGH));
    // RGBA32F so readPixels(RGBA, FLOAT) is guaranteed; never sampled, so NEAREST.
    this.probeTarget = this.createTarget(MAX_TURBINES, 1, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    // Cleared to zero lifetime, so every particle respawns on the first update.
    const particleTarget = () =>
      this.createTarget(PARTICLES_W, PARTICLES_H, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    this.particles = { read: particleTarget(), write: particleTarget() };
  }

  setObstacles(obstacles: Obstacle[]): void {
    this.obstacleCount = Math.min(obstacles.length, MAX_OBSTACLES);
    for (let i = 0; i < this.obstacleCount; i++) {
      this.obstacleData[i * 3] = obstacles[i].x;
      this.obstacleData[i * 3 + 1] = obstacles[i].y;
      this.obstacleData[i * 3 + 2] = obstacles[i].r;
    }
  }

  setTurbines(turbines: TurbineDisk[]): void {
    this.turbineCount = Math.min(turbines.length, MAX_TURBINES);
    for (let i = 0; i < this.turbineCount; i++) {
      this.turbineData[i * 3] = turbines[i].x;
      this.turbineData[i * 3 + 1] = turbines[i].y;
      this.turbineData[i * 3 + 2] = turbines[i].r;
    }
  }

  /**
   * Read back the velocity (grid cells/sec) at up to MAX_TURBINES uv points,
   * as [vx0, vy0, vx1, vy1, ...]. One GPU pass + one tiny synchronous
   * readPixels; call sparingly (a few times per second is fine).
   */
  sampleVelocities(points: { x: number; y: number }[]): Float32Array {
    const gl = this.gl;
    const n = Math.min(points.length, MAX_TURBINES);
    const out = new Float32Array(n * 2);
    if (n === 0) return out;
    for (let i = 0; i < n; i++) {
      this.probePoints[i * 2] = points[i].x;
      this.probePoints[i * 2 + 1] = points[i].y;
    }
    const p = this.programs.probe;
    p.bind();
    gl.uniform2fv(p.loc('uPoints[0]'), this.probePoints);
    this.bindTexture(p.loc('uVelocity'), this.velocity.read.tex, 0);
    this.blit(this.probeTarget);
    gl.readPixels(0, 0, n, 1, gl.RGBA, gl.FLOAT, this.probePixels);
    for (let i = 0; i < n; i++) {
      out[i * 2] = this.probePixels[i * 4];
      out[i * 2 + 1] = this.probePixels[i * 4 + 1];
    }
    return out;
  }

  /** Add momentum (grid cells/sec) around uv point (x, y). */
  splatVelocity(x: number, y: number, dx: number, dy: number, radius = 0.0025): void {
    this.splat(this.velocity, x, y, dx, dy, 0, radius);
  }

  /** Add dye color around uv point (x, y). */
  splatDye(x: number, y: number, r: number, g: number, b: number, radius = 0.0025): void {
    this.splat(this.dye, x, y, r, g, b, radius);
  }

  step(dt: number): void {
    const gl = this.gl;
    const texel: [number, number] = [1 / this.simW, 1 / this.simH];
    const p = this.programs;

    // Vorticity confinement keeps small swirls alive on the coarse grid.
    p.curl.bind();
    gl.uniform2f(p.curl.loc('uTexel'), texel[0], texel[1]);
    this.bindTexture(p.curl.loc('uVelocity'), this.velocity.read.tex, 0);
    this.blit(this.curl);

    p.vorticity.bind();
    gl.uniform2f(p.vorticity.loc('uTexel'), texel[0], texel[1]);
    gl.uniform1f(p.vorticity.loc('uStrength'), this.curlStrength);
    gl.uniform1f(p.vorticity.loc('uDt'), dt);
    this.bindTexture(p.vorticity.loc('uVelocity'), this.velocity.read.tex, 0);
    this.bindTexture(p.vorticity.loc('uCurl'), this.curl.tex, 1);
    this.blit(this.velocity.write);
    this.swap(this.velocity);

    // Wind inflow and obstacles, applied before projection so the pressure
    // solve routes the flow around the obstacles.
    p.constrain.bind();
    gl.uniform2f(p.constrain.loc('uTexel'), texel[0], texel[1]);
    gl.uniform1f(p.constrain.loc('uAspect'), this.aspect());
    gl.uniform1i(p.constrain.loc('uCount'), this.obstacleCount);
    gl.uniform3fv(p.constrain.loc('uObstacles[0]'), this.obstacleData);
    const [wx, wy] = this.windVector();
    gl.uniform2f(p.constrain.loc('uWind'), wx, wy);
    gl.uniform1f(p.constrain.loc('uRelax'), this.windRelax);
    gl.uniform2f(p.constrain.loc('uWindDir'), Math.cos(this.windAngle), Math.sin(this.windAngle));
    gl.uniform1f(p.constrain.loc('uDt'), dt);
    gl.uniform1i(p.constrain.loc('uTurbineCount'), this.turbineCount);
    gl.uniform3fv(p.constrain.loc('uTurbines[0]'), this.turbineData);
    this.bindTexture(p.constrain.loc('uVelocity'), this.velocity.read.tex, 0);
    this.blit(this.velocity.write);
    this.swap(this.velocity);

    // Pressure projection.
    p.divergence.bind();
    gl.uniform2f(p.divergence.loc('uTexel'), texel[0], texel[1]);
    this.bindTexture(p.divergence.loc('uVelocity'), this.velocity.read.tex, 0);
    this.blit(this.divergence);

    p.clear.bind();
    gl.uniform1f(p.clear.loc('uValue'), PRESSURE_RELAXATION);
    this.bindTexture(p.clear.loc('uTexture'), this.pressure.read.tex, 0);
    this.blit(this.pressure.write);
    this.swap(this.pressure);

    const open = this.openEdges();
    p.pressure.bind();
    gl.uniform2f(p.pressure.loc('uTexel'), texel[0], texel[1]);
    gl.uniform4fv(p.pressure.loc('uOpen'), open);
    this.bindTexture(p.pressure.loc('uDivergence'), this.divergence.tex, 1);
    for (let i = 0; i < this.pressureIterations; i++) {
      this.bindTexture(p.pressure.loc('uPressure'), this.pressure.read.tex, 0);
      this.blit(this.pressure.write);
      this.swap(this.pressure);
    }

    p.gradientSubtract.bind();
    gl.uniform2f(p.gradientSubtract.loc('uTexel'), texel[0], texel[1]);
    gl.uniform4fv(p.gradientSubtract.loc('uOpen'), open);
    this.bindTexture(p.gradientSubtract.loc('uPressure'), this.pressure.read.tex, 0);
    this.bindTexture(p.gradientSubtract.loc('uVelocity'), this.velocity.read.tex, 1);
    this.blit(this.velocity.write);
    this.swap(this.velocity);

    // Advection.
    p.advection.bind();
    gl.uniform2f(p.advection.loc('uVelToUv'), 1 / REF_W, 1 / REF_H);
    gl.uniform1f(p.advection.loc('uDt'), dt);
    gl.uniform1f(p.advection.loc('uDissipation'), VELOCITY_DISSIPATION);
    gl.uniform4f(p.advection.loc('uBase'), wx, wy, 0, 0);
    this.bindTexture(p.advection.loc('uVelocity'), this.velocity.read.tex, 0);
    this.bindTexture(p.advection.loc('uSource'), this.velocity.read.tex, 0);
    this.blit(this.velocity.write);
    this.swap(this.velocity);

    gl.uniform1f(p.advection.loc('uDissipation'), DYE_DISSIPATION);
    gl.uniform4f(p.advection.loc('uBase'), 0, 0, 0, 0);
    this.bindTexture(p.advection.loc('uVelocity'), this.velocity.read.tex, 0);
    this.bindTexture(p.advection.loc('uSource'), this.dye.read.tex, 1);
    this.blit(this.dye.write);
    this.swap(this.dye);

    if (this.tracers) {
      p.particleUpdate.bind();
      gl.uniform2f(p.particleUpdate.loc('uVelToUv'), 1 / REF_W, 1 / REF_H);
      gl.uniform1f(p.particleUpdate.loc('uDt'), dt);
      gl.uniform1ui(p.particleUpdate.loc('uFrame'), ++this.frameCount);
      this.bindTexture(p.particleUpdate.loc('uParticles'), this.particles.read.tex, 0);
      this.bindTexture(p.particleUpdate.loc('uVelocity'), this.velocity.read.tex, 1);
      this.blit(this.particles.write);
      this.swap(this.particles);
    }
  }

  /**
   * Read the dye back on a coarse w x h grid, as RGBA per cell, rows from the
   * bottom. One small resample pass and one readPixels; call it a few times
   * per second at most.
   */
  readDye(w: number, h: number): Float32Array {
    const gl = this.gl;
    if (!this.dyeReadTarget || this.dyeReadTarget.w !== w || this.dyeReadTarget.h !== h) {
      if (this.dyeReadTarget) this.deleteTarget(this.dyeReadTarget);
      this.dyeReadTarget = this.createTarget(w, h, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    }
    this.resample(this.dye.read, this.dyeReadTarget);
    const out = new Float32Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, out);
    return out;
  }

  /** The simulation grid actually in use (depends on the quality tier). */
  get gridSize(): [number, number] {
    return [this.simW, this.simH];
  }

  /** Cells down the screen for a given cells-across count, so cells come out square. */
  cellsDown(across: number): number {
    return Math.max(1, Math.round(across / this.aspect()));
  }

  /** Draw to the canvas, colored by `view`, with any cells, lenses, arrows and tracers. */
  render(): void {
    const gl = this.gl;
    const p = this.programs.display;
    p.bind();
    gl.uniform1f(p.loc('uAspect'), this.aspect());
    gl.uniform1i(p.loc('uCount'), this.obstacleCount);
    gl.uniform3fv(p.loc('uObstacles[0]'), this.obstacleData);
    gl.uniform1i(p.loc('uView'), ['dye', 'speed', 'pressure', 'swirl'].indexOf(this.view));
    gl.uniform1f(p.loc('uWind'), this.wind);
    gl.uniform1f(p.loc('uPressureScale'), PRESSURE_SCALE);
    gl.uniform1f(p.loc('uCurlScale'), CURL_SCALE);
    const across = this.cellsAcross;
    gl.uniform2f(p.loc('uCells'), across, across > 0 ? this.cellsDown(across) : 0);
    gl.uniform2f(p.loc('uCanvas'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    const lenses = this.lenses.slice(0, MAX_LENSES);
    gl.uniform1i(p.loc('uLensCount'), lenses.length);
    if (lenses.length > 0) {
      gl.uniform4fv(p.loc('uLens[0]'), lenses.flatMap((l) => [l.x, l.y, l.r, l.zoom]));
      gl.uniform3fv(p.loc('uLensSrc[0]'), lenses.flatMap((l) => [l.srcX, l.srcY, l.grid ? 1 : 0]));
    }
    this.bindTexture(p.loc('uDye'), this.dye.read.tex, 0);
    this.bindTexture(p.loc('uVelocity'), this.velocity.read.tex, 1);
    this.bindTexture(p.loc('uPressure'), this.pressure.read.tex, 2);
    this.bindTexture(p.loc('uCurl'), this.curl.tex, 3);
    this.blit(null);
    if (this.tracers) this.drawTracers();
    if (this.arrowsAcross > 0) this.drawArrows(this.arrowsAcross);
  }

  /** One velocity arrow per grid point, alpha-blended over the field. */
  private drawArrows(across: number): void {
    const gl = this.gl;
    const p = this.programs.arrows;
    p.bind();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const down = this.cellsDown(across);
    gl.uniform2f(p.loc('uGrid'), across, down);
    gl.uniform2f(p.loc('uCanvas'), w, h);
    gl.uniform1f(p.loc('uWidth'), Math.max(1.5, h / 450));
    // Speed (reference cells/sec) at which an arrow reaches ~63% of full length.
    gl.uniform1f(p.loc('uRefSpeed'), 60);
    this.bindTexture(p.loc('uVelocity'), this.velocity.read.tex, 0);
    gl.disableVertexAttribArray(0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // A soft dark outline first, so white arrows stay readable on bright smoke.
    const outline = Math.max(1, h / 900);
    gl.uniform1f(p.loc('uOutline'), outline);
    gl.uniform4f(p.loc('uColor'), 0, 0, 0, 0.55);
    gl.drawArrays(gl.TRIANGLES, 0, across * down * 9);
    gl.uniform1f(p.loc('uOutline'), 0);
    gl.uniform4f(p.loc('uColor'), 0.95, 0.97, 1, 1);
    gl.drawArrays(gl.TRIANGLES, 0, across * down * 9);
    gl.disable(gl.BLEND);
    gl.enableVertexAttribArray(0);
  }

  /** Additive soft streaks over the displayed field, one quad per particle. */
  private drawTracers(): void {
    const gl = this.gl;
    const p = this.programs.particleDraw;
    p.bind();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    gl.uniform2f(p.loc('uVelToUv'), 1 / REF_W, 1 / REF_H);
    gl.uniform2f(p.loc('uCanvas'), w, h);
    gl.uniform1f(p.loc('uTrail'), TRAIL_SECONDS);
    // About 2 px on a 1080p screen, scaling with the canvas.
    gl.uniform1f(p.loc('uWidth'), Math.max(1.5, h / 520));
    gl.uniform1f(p.loc('uOpacity'), 0.4);
    this.bindTexture(p.loc('uParticles'), this.particles.read.tex, 0);
    this.bindTexture(p.loc('uVelocity'), this.velocity.read.tex, 1);
    // The streaks are built from gl_VertexID alone; the shared quad attribute
    // must be off, or WebGL would range-check 4 quad vertices against ours.
    gl.disableVertexAttribArray(0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.TRIANGLES, 0, PARTICLES_W * PARTICLES_H * 6);
    gl.disable(gl.BLEND);
    gl.enableVertexAttribArray(0);
  }

  /**
   * Clear dye and pressure, and set the velocity to the current wind
   * everywhere — the steady state of an empty wind tunnel — so a fresh round
   * starts in full wind instead of in still air that must first be blown
   * away. (Obstacles are the caller's state.)
   */
  reset(): void {
    const [wx, wy] = this.windVector();
    for (const target of [this.velocity.read, this.velocity.write]) {
      this.clearTarget(target, [wx, wy, 0, 1]);
    }
    for (const target of [this.dye.read, this.dye.write, this.pressure.read, this.pressure.write]) {
      this.clearTarget(target);
    }
  }

  /**
   * Called once if frame times are poor on this machine: drop to the coarse
   * grid. The current flow is resampled, not reset, so a running wind-farm
   * round carries on without a hiccup.
   */
  reduceQuality(): void {
    const oldVelocity = this.velocity;
    const oldPressure = this.pressure;
    const oldCurl = this.curl;
    const oldDivergence = this.divergence;
    this.createSimTargets(...TIER_LOW);
    this.resample(oldVelocity.read, this.velocity.read);
    this.resample(oldPressure.read, this.pressure.read);
    for (const t of [oldVelocity.read, oldVelocity.write, oldPressure.read, oldPressure.write]) {
      this.deleteTarget(t);
    }
    this.deleteTarget(oldCurl);
    this.deleteTarget(oldDivergence);
  }

  destroy(): void {
    if (!this.ok) return;
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  // ---- internals ----

  /** Aspect used to keep obstacle circles round on the actual canvas. */
  private aspect(): number {
    return this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
  }

  /**
   * Add a Gaussian blob in place, with additive blending restricted (scissor)
   * to the blob's footprint. A full-texture pass per splat would cost more
   * than the whole solver step: the wind streaks alone splat ~9 times per
   * frame into the 1024x576 dye texture.
   */
  private splat(
    target: DoubleTarget,
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    radius: number,
  ): void {
    const gl = this.gl;
    const aspect = this.aspect();
    const t = target.read;
    // exp(-d^2 / radius) < 1e-3 beyond this distance (screen-height units).
    const reach = Math.sqrt(radius * 6.91);
    const x0 = Math.max(0, Math.floor((x - reach / aspect) * t.w));
    const x1 = Math.min(t.w, Math.ceil((x + reach / aspect) * t.w));
    const y0 = Math.max(0, Math.floor((y - reach) * t.h));
    const y1 = Math.min(t.h, Math.ceil((y + reach) * t.h));
    if (x1 <= x0 || y1 <= y0) return;
    const p = this.programs.splat;
    p.bind();
    gl.uniform1f(p.loc('uAspect'), aspect);
    gl.uniform2f(p.loc('uPoint'), x, y);
    gl.uniform3f(p.loc('uColor'), r, g, b);
    gl.uniform1f(p.loc('uRadius'), radius);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x0, y0, x1 - x0, y1 - y0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.blit(t);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
  }

  /**
   * Wind vector in reference-grid cells/sec pointing along windAngle as seen
   * on screen. Grid cells are only square on a 16:9 canvas, so the vertical
   * part is corrected for the canvas aspect.
   */
  private windVector(): [number, number] {
    const dx = Math.cos(this.windAngle);
    const dy = (Math.sin(this.windAngle) * this.aspect() * REF_H) / REF_W;
    const n = Math.hypot(dx, dy);
    return [(this.wind * dx) / n, (this.wind * dy) / n];
  }

  /**
   * Which edges (left, right, bottom, top) are open outflows with pressure
   * pinned to zero: those the wind clearly blows out through, or just the
   * right edge in still air. Inflow and parallel edges stay closed.
   */
  private openEdges(): [number, number, number, number] {
    if (this.wind <= 0) return [0, 1, 0, 0];
    const dx = Math.cos(this.windAngle);
    const dy = Math.sin(this.windAngle);
    const out = (d: number) => (d > 0.15 ? 1 : 0);
    return [out(-dx), out(dx), out(-dy), out(dy)];
  }

  /** (Re)create the simulation-grid targets for a quality tier. */
  private createSimTargets(w: number, h: number, iterations: number): void {
    const gl = this.gl;
    this.simW = w;
    this.simH = h;
    this.pressureIterations = iterations;
    this.velocity = this.createDouble(w, h, gl.RG16F, gl.RG);
    this.pressure = this.createDouble(w, h, gl.R16F, gl.RED);
    this.curl = this.createTarget(w, h, gl.R16F, gl.RED);
    this.divergence = this.createTarget(w, h, gl.R16F, gl.RED);
  }

  /** Copy a field into a target of a different size (bilinear). */
  private resample(from: Target, to: Target): void {
    const p = this.programs.clear;
    p.bind();
    this.gl.uniform1f(p.loc('uValue'), 1);
    this.bindTexture(p.loc('uTexture'), from.tex, 0);
    this.blit(to);
  }

  private deleteTarget(target: Target): void {
    this.gl.deleteFramebuffer(target.fbo);
    this.gl.deleteTexture(target.tex);
  }

  private blit(target: Target | null): void {
    const gl = this.gl;
    if (target) {
      gl.viewport(0, 0, target.w, target.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private bindTexture(loc: WebGLUniformLocation | null, tex: WebGLTexture, unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  private createTarget(
    w: number,
    h: number,
    internalFormat: number,
    format: number,
    type: number = this.gl.HALF_FLOAT,
    filter: number = this.gl.LINEAR,
  ): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    const fbo = gl.createFramebuffer()!;
    const target = { fbo, tex, w, h };
    this.clearTarget(target);
    return target;
  }

  /** Fill a target with a constant (clearBufferfv: float values are not clamped). */
  private clearTarget(target: Target, value: [number, number, number, number] = [0, 0, 0, 1]): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.tex, 0);
    gl.clearBufferfv(gl.COLOR, 0, value);
  }

  private createDouble(w: number, h: number, internalFormat: number, format: number): DoubleTarget {
    return {
      read: this.createTarget(w, h, internalFormat, format),
      write: this.createTarget(w, h, internalFormat, format),
    };
  }

  private swap(target: DoubleTarget): void {
    const tmp = target.read;
    target.read = target.write;
    target.write = tmp;
  }
}
