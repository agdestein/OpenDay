import type { ArcadeGame, GameInstance, Screen } from './types';
import { renderMenu } from './menu';
import { backButton, titleCard } from './hud';
import { toggleFullscreen } from '../lib/fullscreen';

/** No input for this long inside a game -> back to the menu (kiosk reset). */
const IDLE_LIMIT_MS = 90_000;
/** Clamp dt so a backgrounded tab doesn't produce a huge physics step. */
const MAX_DT = 0.05;

export class Shell {
  private screen: Screen | null = null;
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.showMenu();
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  };

  constructor(
    private root: HTMLElement,
    private games: ArcadeGame[],
  ) {
    window.addEventListener('keydown', this.onKey);
  }

  showMenu(): void {
    this.setScreen(renderMenu(this.games, (game) => this.launch(game)));
  }

  launch(game: ArcadeGame): void {
    const element = document.createElement('div');
    element.className = 'screen game-screen';
    const canvas = document.createElement('canvas');
    element.appendChild(canvas);
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay';
    element.appendChild(overlay);

    let dpr = window.devicePixelRatio || 1;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(element.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(element.clientHeight * dpr));
    };
    window.addEventListener('resize', resize);

    const instance: GameInstance = game.create({
      canvas,
      overlay,
      get dpr() {
        return dpr;
      },
      exitToMenu: () => this.showMenu(),
    });

    let raf = 0;
    let lastInput = performance.now();
    const noteInput = () => {
      lastInput = performance.now();
    };
    window.addEventListener('pointerdown', noteInput);
    window.addEventListener('pointermove', noteInput);
    window.addEventListener('keydown', noteInput);

    let last = performance.now();
    const loop = (t: number) => {
      if (t - lastInput > IDLE_LIMIT_MS) {
        this.showMenu();
        return;
      }
      const dt = Math.min((t - last) / 1000, MAX_DT);
      last = t;
      instance.frame(dt);
      raf = requestAnimationFrame(loop);
    };

    element.appendChild(backButton(() => this.showMenu()));
    element.appendChild(
      titleCard(game, () => {
        instance.start();
        last = lastInput = performance.now();
        raf = requestAnimationFrame(loop);
      }),
    );

    this.setScreen({
      element,
      dispose: () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointerdown', noteInput);
        window.removeEventListener('pointermove', noteInput);
        window.removeEventListener('keydown', noteInput);
        instance.destroy();
        canvas.width = canvas.height = 1;
      },
    });
    resize();
  }

  private setScreen(next: Screen): void {
    this.screen?.dispose();
    this.screen = next;
    this.root.replaceChildren(next.element);
  }
}
