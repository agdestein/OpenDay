// A lost WebGL context (a GPU reset, a driver hiccup, too many contexts) leaves
// a game black and deaf to input. Games that own a WebGL context register its
// canvas here; the shell hears about a loss and goes back to the menu, where
// reopening the game builds a fresh context.

/** Window event the shell listens for. */
export const GL_LOST_EVENT = 'arcade-gl-lost';

/**
 * Report context loss on this canvas to the shell. Call the returned function
 * before losing the context on purpose (in destroy), so that loss is ignored.
 */
export function watchContextLoss(canvas: HTMLCanvasElement): () => void {
  let released = false;
  const onLost = () => {
    if (!released) window.dispatchEvent(new Event(GL_LOST_EVENT));
  };
  canvas.addEventListener('webglcontextlost', onLost);
  return () => {
    released = true;
    canvas.removeEventListener('webglcontextlost', onLost);
  };
}
