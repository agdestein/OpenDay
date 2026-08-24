/** What the shell provides to a running game. */
export interface GameHost {
  /** Full-screen canvas; the shell resizes its backing store on window resize. */
  canvas: HTMLCanvasElement;
  /**
   * DOM layer on top of the canvas for game UI (toolbars, messages). The layer
   * itself ignores pointer events; its children receive them. Discarded with
   * the screen, so games need not clean it up.
   */
  overlay: HTMLElement;
  /** Device pixel ratio of the backing store (world coordinates are CSS pixels). */
  readonly dpr: number;
  /** Leave the game and return to the menu. */
  exitToMenu(): void;
}

export interface GameInstance {
  /** Called once, after the player dismisses the title card. */
  start(): void;
  /** Called every animation frame with the time step in seconds (clamped by the shell). */
  frame(dt: number): void;
  /** Remove all listeners and resources; the canvas is discarded afterwards. */
  destroy(): void;
}

export interface ArcadeGame {
  id: string;
  title: string;
  /** One sentence for parents, shown on the menu tile and title card. */
  scienceLine: string;
  /** Menu tile art (for now: an emoji). */
  tileEmoji: string;
  create(host: GameHost): GameInstance;
}

/** A full-screen view managed by the shell (menu or game). */
export interface Screen {
  element: HTMLElement;
  dispose(): void;
}
