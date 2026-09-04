# Build tools

Nothing here ships. `.assetsignore` keeps this directory out of the Cloudflare
assets bundle; these are the scripts that regenerate committed artefacts when a
source asset or dependency changes.

## `encode-images.sh`

Regenerates the AVIF siblings the site's `<picture>` elements point at. The
JPEGs stay put as the `<img src>` fallback, so this only ever adds files.

```sh
sh tools/encode-images.sh
```

Run it after adding or re-exporting a photo, then wire the new file into the
markup. Requires `avifenc` (libavif) and `magick` (ImageMagick).

## `vendor-three.mjs`

Mirrors the three.js files the visualizer imports into `js/vendor/three`,
following relative imports until the graph closes.

```sh
node tools/vendor-three.mjs
```

To move to a new three version: bump `V` at the top, run it, and delete
anything it no longer writes. The import map in `visualizer/index.html` and the
decoder paths in `js/visualizer/houseLoader.js` point at the result.

## Fonts

The three families are self-hosted under `assets/fonts/`, with the `@font-face`
rules at the top of `css/base.css`. To regenerate them, fetch the Google Fonts
stylesheet with a modern browser user-agent so it serves woff2:

```sh
curl -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
(KHTML, like Gecko) Chrome/120.0 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,100..125,100..900&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap"
```

Download the `latin` and `latin-ext` woff2 files it lists and copy the
`unicode-range` values across unchanged — they are what keeps a browser from
downloading a subset the page never uses. Space Grotesk serves one variable
file for 400/500/700, so it gets a single face with `font-weight: 400 700`;
Archivo is variable on both weight and width, which the display type relies on
(`font-stretch: 118%`). All three families are OFL.
