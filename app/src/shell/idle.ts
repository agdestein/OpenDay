// Kiosk reset for an unattended stand. With `?idle` (90 s) or `?idle=180`, a
// game left alone shows a short countdown and then the page reloads: back to
// the menu, in the machine's own language and sound setting, with any stuck
// state gone. On the menu nothing happens unless a visitor changed the
// language or muted the machine. Off by default, so nobody reading a science
// explainer at home gets kicked out mid-sentence.
//
// The watchdog runs on its own timer, not in a game's frame loop, so a game
// that freezes still gets reset.

import { forgetLangChoice, getLang, pick, type Localized } from '../lib/i18n';
import { sound } from '../lib/sound';

const TEXT: Localized<{ still: string; resetIn: (s: number) => string }> = {
  en: { still: 'Still playing? Move the mouse! 👆', resetIn: (s) => `Back to the start in ${s}…` },
  nl: { still: 'Speel je nog? Beweeg de muis! 👆', resetIn: (s) => `Over ${s} tellen terug naar het begin…` },
  no: { still: 'Spiller du fortsatt? Rør på musa! 👆', resetIn: (s) => `Tilbake til start om ${s} …` },
};

const params = new URLSearchParams(location.search);

/** Milliseconds without input before a reset (Infinity: off). */
export const IDLE_LIMIT_MS = idleLimitFromUrl();
/** How long the countdown shows before the reset. */
const WARNING_MS = Math.min(10_000, IDLE_LIMIT_MS / 2);

function idleLimitFromUrl(): number {
  const param = params.get('idle');
  if (param === null) return Infinity;
  const seconds = Number(param);
  return (param === '' || !(seconds > 0) ? 90 : seconds) * 1000;
}

/** Whether a visitor switched the language or the sound away from this machine's defaults. */
function visitorChangedMachine(): boolean {
  const urlLang = params.get('lang');
  const defaultLang = urlLang === 'nl' || urlLang === 'no' ? urlLang : 'en';
  return getLang() !== defaultLang || sound.muted !== (params.get('sound') === 'off');
}

/** Back to a fresh page with the machine's defaults. */
export function resetMachine(): void {
  forgetLangChoice();
  sound.forgetChoice();
  location.reload();
}

export class IdleWatchdog {
  private lastInput = performance.now();
  private banner: HTMLElement | null = null;

  /** `inGame` tells whether a game (rather than the menu) is on screen. */
  constructor(private inGame: () => boolean) {
    if (IDLE_LIMIT_MS === Infinity) return;
    // Capture phase: the initials entry stops key events from bubbling.
    for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel']) {
      window.addEventListener(type, this.note, { capture: true, passive: true });
    }
    window.setInterval(this.tick, 250);
  }

  private note = () => {
    this.lastInput = performance.now();
    this.banner?.remove();
    this.banner = null;
  };

  private tick = () => {
    const idle = performance.now() - this.lastInput;
    if (!this.inGame()) {
      if (idle >= IDLE_LIMIT_MS && visitorChangedMachine()) resetMachine();
      return;
    }
    if (idle >= IDLE_LIMIT_MS) resetMachine();
    else if (idle >= IDLE_LIMIT_MS - WARNING_MS) this.showBanner(Math.ceil((IDLE_LIMIT_MS - idle) / 1000));
  };

  private showBanner(seconds: number): void {
    if (!this.banner) {
      this.banner = document.createElement('div');
      this.banner.className = 'idle-banner';
      const still = document.createElement('strong');
      still.textContent = pick(TEXT).still;
      const count = document.createElement('span');
      this.banner.append(still, count);
      document.body.appendChild(this.banner);
    }
    this.banner.lastElementChild!.textContent = pick(TEXT).resetIn(seconds);
  }
}
