/** False on iPhone Safari, which has no Fullscreen API for regular elements. */
export const fullscreenSupported = !!document.documentElement.requestFullscreen;

export function toggleFullscreen(): void {
  if (!fullscreenSupported) return;
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen();
  }
}
