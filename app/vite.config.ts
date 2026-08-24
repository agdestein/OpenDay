import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works at any URL depth
  // (GitHub Pages serves from /OpenDay/, kiosk machines from /).
  base: './',
});
