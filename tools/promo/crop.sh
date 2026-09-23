#!/bin/sh
# Crop the chosen game shots (build/shots) into the six mosaic tiles (build/tiles).
# Boxes are in 1920x1080 CSS pixels of the scale-2 shots (f_L3 is scale 3, cropped in device pixels).
cd "$(dirname "$0")/build" && mkdir -p tiles
crop() { magick shots/$1.png -crop $(($4*2))x$(($5*2))+$(($2*2))+$(($3*2)) +repage -resize 2400x1500^ -gravity center -extent 2400x1500 -quality 93 tiles/$6.jpg; }
magick shots/f_L3.png -crop 3120x1950+0+200 +repage -resize 2400x1500 -quality 93 tiles/farm.jpg
crop wind_street 216 70 1504 940 street
crop ob_1 0 45 1330 831 outbreak
crop c_flood_7991 250 40 1400 875 flood
crop c_det 150 105 1408 880 detective
crop c_creature 0 160 1152 720 creature
