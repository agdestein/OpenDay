# Promo images

Stills of the arcade for posters and slides (the images themselves live in `promo/`,
with `0-overzicht.jpg` as the pick sheet). Made by driving the real games in headless
Chromium over the DevTools protocol and screenshotting at 2–3× device scale, then
laying them out in `compose.html` and screenshotting that at 3840×2160 (slide) and
3508×4961 (A3 at 300 dpi).

```sh
cd app && npx vite --port 5199 --strictPort &      # the scripts expect this port
cd tools/promo
node cdp.mjs ./s_wind.mjs                          # vortex street  -> build/shots/wind_street.png
node cdp.mjs ./s_games.mjs                         # outbreak ob_1, etc.
node cdp.mjs ./s_clean.mjs                         # UI-free flood / detective / creature
node cdp.mjs ./s_hero.mjs                          # hi-res flood + vortex street, landscape and portrait
node cdp.mjs ./s_farm2.mjs                         # hi-res wind farm without HUD text
./crop.sh                                          # six mosaic tiles
cp compose.html build/ && node cdp.mjs ./s_compose.mjs   # -> build/out/*.png
```

Simulations are random, so reruns differ; the file names picked in `crop.sh` and
`compose.html` (e.g. which storm frame) were chosen by eye and may need re-picking.
`s_all.mjs` just opens every game, for a quick look.

For a band of free space at the top (for event logos), pass `tt` (title top, % of
height) and `sh` (push the image down, %): the A3 sent for the 2026 poster was
`compose.html?d=street&s=P&tt=15&sh=8`.
