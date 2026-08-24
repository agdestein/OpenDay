// Real-time 2D fluid solver on the GPU (WebGL2), in the classic stable-fluids
// style popularized by GPU Gems and Pavel Dobryakov's WebGL-Fluid-Simulation:
// splat inputs, vorticity confinement, Jacobi pressure projection,
// semi-Lagrangian advection. Everything is tuned for looks, not accuracy.
import {
  MAX_OBSTACLES,
  advectionSrc,
  clearSrc,
  constrainSrc,
  curlSrc,
  displaySrc,
  divergenceSrc,
  gradientSubtractSrc,
  pressureSrc,
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

// Simulation grids are a fixed 16:9; the display pass stretches to the canvas.
const SIM_W = 256;
const SIM_H = 144;
const DYE_W = 1024;
const DYE_H = 576;

const VELOCITY_DISSIPATION = 0.08;
const DYE_DISSIPATION = 0.45;
const PRESSURE_RELAXATION = 0.8;
const CURL_STRENGTH = 25;

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
  /** Wind inflow speed in grid cells per second; 0 disables wind. */
  wind = 0;

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
    | 'display',
    Program
  >;
  private velocity!: DoubleTarget;
  private dye!: DoubleTarget;
  private pressure!: DoubleTarget;
  private curl!: Target;
  private divergence!: Target;
  private obstacleData = new Float32Array(MAX_OBSTACLES * 3);
  private obstacleCount = 0;
  private pressureIterations = 24;

  constructor(private canvas: HTMLCanvasElement) {
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
      display: new Program(gl, vertex, displaySrc),
    };
    gl.deleteShader(vertex);

    this.velocity = this.createDouble(SIM_W, SIM_H, gl.RG16F, gl.RG);
    this.pressure = this.createDouble(SIM_W, SIM_H, gl.R16F, gl.RED);
    this.dye = this.createDouble(DYE_W, DYE_H, gl.RGBA16F, gl.RGBA);
    this.curl = this.createTarget(SIM_W, SIM_H, gl.R16F, gl.RED);
    this.divergence = this.createTarget(SIM_W, SIM_H, gl.R16F, gl.RED);
  }

  setObstacles(obstacles: Obstacle[]): void {
    this.obstacleCount = Math.min(obstacles.length, MAX_OBSTACLES);
    for (let i = 0; i < this.obstacleCount; i++) {
      this.obstacleData[i * 3] = obstacles[i].x;
      this.obstacleData[i * 3 + 1] = obstacles[i].y;
      this.obstacleData[i * 3 + 2] = obstacles[i].r;
    }
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
    const texel: [number, number] = [1 / SIM_W, 1 / SIM_H];
    const p = this.programs;

    // Vorticity confinement keeps small swirls alive on the coarse grid.
    p.curl.bind();
    gl.uniform2f(p.curl.loc('uTexel'), texel[0], texel[1]);
    this.bindTexture(p.curl.loc('uVelocity'), this.velocity.read.tex, 0);
    this.blit(this.curl);

    p.vorticity.bind();
    gl.uniform2f(p.vorticity.loc('uTexel'), texel[0], texel[1]);
    gl.uniform1f(p.vorticity.loc('uStrength'), CURL_STRENGTH);
    gl.uniform1f(p.vorticity.loc('uDt'), dt);
    this.bindTexture(p.vorticity.loc('uVelocity'), this.velocity.read.tex, 0);
    this.bindTexture(p.vorticity.loc('uCurl'), this.curl.tex, 1);
    this.blit(this.velocity.write);
    this.swap(this.velocity);

    // Wind inflow and obstacles, applied before projection so the pressure
    // solve routes the flow around the obstacles.
    p.constrain.bind();
    gl.uniform1f(p.constrain.loc('uAspect'), this.aspect());
    gl.uniform1i(p.constrain.loc('uCount'), this.obstacleCount);
    gl.uniform3fv(p.constrain.loc('uObstacles[0]'), this.obstacleData);
    gl.uniform1f(p.constrain.loc('uWind'), this.wind);
    gl.uniform1f(p.constrain.loc('uDt'), dt);
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

    p.pressure.bind();
    gl.uniform2f(p.pressure.loc('uTexel'), texel[0], texel[1]);
    this.bindTexture(p.pressure.loc('uDivergence'), this.divergence.tex, 1);
    for (let i = 0; i < this.pressureIterations; i++) {
      this.bindTexture(p.pressure.loc('uPressure'), this.pressure.read.tex, 0);
      this.blit(this.pressure.write);
      this.swap(this.pressure);
    }

    p.gradientSubtract.bind();
    gl.uniform2f(p.gradientSubtract.loc('uTexel'), texel[0], texel[1]);
    this.bindTexture(p.gradientSubtract.loc('uPressure'), this.pressure.read.tex, 0);
    this.bindTexture(p.gradientSubtract.loc('uVelocity'), this.velocity.read.tex, 1);
    this.blit(this.velocity.write);
    this.swap(this.velocity);

    // Advection.
    p.advection.bind();
    gl.uniform2f(p.advection.loc('uTexel'), texel[0], texel[1]);
    gl.uniform1f(p.advection.loc('uDt'), dt);
    gl.uniform1f(p.advection.loc('uDissipation'), VELOCITY_DISSIPATION);
    this.bindTexture(p.advection.loc('uVelocity'), this.velocity.read.tex, 0);
    this.bindTexture(p.advection.loc('uSource'), this.velocity.read.tex, 0);
    this.blit(this.velocity.write);
    this.swap(this.velocity);

    gl.uniform1f(p.advection.loc('uDissipation'), DYE_DISSIPATION);
    this.bindTexture(p.advection.loc('uVelocity'), this.velocity.read.tex, 0);
    this.bindTexture(p.advection.loc('uSource'), this.dye.read.tex, 1);
    this.blit(this.dye.write);
    this.swap(this.dye);
  }

  render(): void {
    const gl = this.gl;
    const p = this.programs.display;
    p.bind();
    gl.uniform1f(p.loc('uAspect'), this.aspect());
    gl.uniform1i(p.loc('uCount'), this.obstacleCount);
    gl.uniform3fv(p.loc('uObstacles[0]'), this.obstacleData);
    this.bindTexture(p.loc('uDye'), this.dye.read.tex, 0);
    this.blit(null);
  }

  /** Clear dye, velocity, and pressure (obstacles are the caller's state). */
  reset(): void {
    for (const target of [
      this.velocity.read,
      this.velocity.write,
      this.dye.read,
      this.dye.write,
      this.pressure.read,
      this.pressure.write,
    ]) {
      this.clearTarget(target);
    }
  }

  /** Called once if frame times are poor on this machine. */
  reduceQuality(): void {
    this.pressureIterations = 12;
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
    const p = this.programs.splat;
    p.bind();
    gl.uniform1f(p.loc('uAspect'), this.aspect());
    gl.uniform2f(p.loc('uPoint'), x, y);
    gl.uniform3f(p.loc('uColor'), r, g, b);
    gl.uniform1f(p.loc('uRadius'), radius);
    this.bindTexture(p.loc('uTarget'), target.read.tex, 0);
    this.blit(target.write);
    this.swap(target);
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

  private createTarget(w: number, h: number, internalFormat: number, format: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer()!;
    const target = { fbo, tex, w, h };
    this.clearTarget(target);
    return target;
  }

  private clearTarget(target: Target): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
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
