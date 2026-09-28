import type { ArcadeGame, GameInstance, Screen } from './types';
import { renderMenu } from './menu';
import { backButton, titleCard, toast } from './hud';
import { IdleWatchdog } from './idle';
import { clearAllScores } from './scores';
import { toggleFullscreen } from '../lib/fullscreen';
import { GL_LOST_EVENT } from '../lib/gl';
import { cappedDpr } from '../lib/util';
import { pick, type Localized } from '../lib/i18n';
import { sound } from '../lib/sound';

const TEXT: Localized<{ clearScores: string; scoresCleared: string }> = {
  en: { clearScores: "Clear all of today's scores and crowns?", scoresCleared: 'Scores cleared' },
  nl: { clearScores: 'Alle scores en kronen van vandaag wissen?', scoresCleared: 'Scores gewist' },
  no: { clearScores: 'Slette alle dagens poeng og kroner?', scoresCleared: 'Poengene er slettet' },
};

/** Clamp dt so a backgrounded tab doesn't produce a huge physics step. */
const MAX_DT = 0.05;
/** A game whose frame throws this many times in a row goes back to the menu. */
const MAX_FRAME_ERRORS = 3;
/** Uncaught errors (from event handlers, promises) within ERROR_WINDOW_MS that send a game back to the menu. */
const MAX_LOOSE_ERRORS = 5;
const ERROR_WINDOW_MS = 10_000;

export class Shell {
  private screen: Screen | null = null;
  private inGame = false;
  private looseErrors: number[] = [];

  private onKey = (e: KeyboardEvent) => {
    // Staff: Ctrl+Shift+Backspace clears the day's boards (the morning's test runs).
    if (e.key === 'Backspace' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      if (window.confirm(pick(TEXT).clearScores)) {
        clearAllScores();
        toast(pick(TEXT).scoresCleared);
      }
      return;
    }
    // On the menu, Escape only closes the about layer (re-rendering it is cheap).
    if (e.key === 'Escape' && (this.inGame || this.root.querySelector('.about-layer'))) this.showMenu();
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) toggleFullscreen();
  };

  constructor(
    private root: HTMLElement,
    private games: ArcadeGame[],
  ) {
    window.addEventListener('keydown', this.onKey);
    root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Every game's buttons give the same soft click.
      if (target.closest?.('.tool-button, .arcade-button, .tile')) sound.play('click');
      // A clicked button keeps focus, and a later Space or Enter would press it
      // again; mouse clicks (detail > 0) let go of it, keyboard ones keep it.
      if (e.detail > 0) target.closest?.('button')?.blur();
    });
    guardBrowserControls();
    keepScreenAwake();
    new IdleWatchdog(() => this.inGame);
    window.addEventListener(GL_LOST_EVENT, () => {
      if (this.inGame) this.showMenu();
    });
    // A game that keeps throwing from its event handlers is broken: back to the menu.
    const onLooseError = () => {
      const now = performance.now();
      this.looseErrors = this.looseErrors.filter((t) => now - t < ERROR_WINDOW_MS);
      this.looseErrors.push(now);
      if (this.inGame && this.looseErrors.length >= MAX_LOOSE_ERRORS) {
        this.looseErrors = [];
        this.showMenu();
      }
    };
    window.addEventListener('error', onLooseError);
    window.addEventListener('unhandledrejection', onLooseError);
    // `?reset-scores` starts the day with empty boards. It is dropped from the
    // address at once, so an idle reset (a reload) doesn't clear them again.
    const url = new URL(location.href);
    if (url.searchParams.has('reset-scores')) {
      clearAllScores();
      url.searchParams.delete('reset-scores');
      history.replaceState(null, '', url);
    }
  }

  showMenu(): void {
    this.inGame = false;
    this.setScreen(
      renderMenu(
        this.games,
        (game) => this.launch(game),
        () => this.showMenu(),
      ),
    );
  }

  launch(game: ArcadeGame): void {
    const element = document.createElement('div');
    element.className = 'screen game-screen';
    const canvas = document.createElement('canvas');
    element.appendChild(canvas);
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay';
    element.appendChild(overlay);

    let dpr = cappedDpr();
    const resize = () => {
      dpr = cappedDpr();
      canvas.width = Math.max(1, Math.round(element.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(element.clientHeight * dpr));
    };
    window.addEventListener('resize', resize);

    let instance: GameInstance;
    try {
      instance = game.create({
        canvas,
        overlay,
        get dpr() {
          return dpr;
        },
        exitToMenu: () => this.showMenu(),
        hasGame: (id) => this.games.some((g) => g.id === id),
        openGame: (id) => {
          const next = this.games.find((g) => g.id === id);
          if (next) this.launch(next);
        },
      });
    } catch (error) {
      console.error(`${game.id}: create failed`, error);
      window.removeEventListener('resize', resize);
      this.showMenu();
      return;
    }

    let raf = 0;
    let last = performance.now();
    let frameErrors = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, MAX_DT);
      last = t;
      try {
        instance.frame(dt);
        frameErrors = 0;
      } catch (error) {
        console.error(`${game.id}: frame failed`, error);
        if (++frameErrors >= MAX_FRAME_ERRORS) {
          this.showMenu();
          return;
        }
      }
      raf = requestAnimationFrame(loop);
    };

    element.appendChild(backButton(() => this.showMenu()));
    element.appendChild(
      titleCard(game, () => {
        try {
          instance.start();
        } catch (error) {
          console.error(`${game.id}: start failed`, error);
          this.showMenu();
          return;
        }
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }),
    );

    this.inGame = true;
    this.setScreen({
      element,
      dispose: () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        try {
          instance.destroy();
        } finally {
          canvas.width = canvas.height = 1;
        }
      },
    });
    resize();
  }

  private setScreen(next: Screen): void {
    const previous = this.screen;
    this.screen = next;
    try {
      previous?.dispose();
    } catch (error) {
      // A game that fails to clean up must not keep the next screen away.
      console.error('screen dispose failed', error);
    } finally {
      this.root.replaceChildren(next.element);
    }
  }
}

/**
 * Keep visitors inside the arcade: no browser context menu (it offers Back,
 * Reload and Inspect), and no page zoom by Ctrl+wheel or Ctrl +/−/0, which the
 * browser would remember for the rest of the day.
 */
function guardBrowserControls(): void {
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_', '0'].includes(e.key)) e.preventDefault();
  });
}

/** Ask the OS not to dim or lock a borrowed laptop's screen while the arcade runs. */
function keepScreenAwake(): void {
  const wakeLock = (navigator as Navigator & {
    wakeLock?: { request(type: 'screen'): Promise<unknown> };
  }).wakeLock;
  if (!wakeLock) return;
  const request = () => {
    if (document.visibilityState === 'visible') wakeLock.request('screen').catch(() => {});
  };
  // Browsers grant it only after a user gesture, and drop it when the tab hides.
  window.addEventListener('pointerdown', request, { once: true });
  document.addEventListener('visibilitychange', request);
}
