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

## Adding a service-area page

There is no generator for these. They were scaffolded once and are now plain
hand-maintained HTML like every other page in the repo, which is the point —
a generator would quietly clobber any edit made to a page afterwards.

To add a city, copy `service-area/carmel/index.html` and change:

1. `<title>`, the meta description, `og:title`/`og:description`, and `canonical`
   + `og:url` (three places carry the slug).
2. Both JSON-LD blocks: `areaServed.name`, `containedInPlace.name`, the `url`,
   and the last `BreadcrumbList` item.
3. The hero: county eyebrow, `page-hero__watermark`, `<h1>`, and the lede.
4. The three `card-cell` blocks under "What we see in … homes" — these are the
   reason the page is worth having. Write about that city's actual housing
   stock. Six real pages beat fourteen templated ones; a thin duplicate is
   worse than no page.
5. The `-carmel` suffix on the six lead-form `id`/`for` pairs, and the default
   `<textarea>` text.
6. The "Also serving nearby" links, on the new page and on the six existing
   ones.

Then add it to `sitemap.xml` and to the card grid on `service-area/index.html`.

## `make-style-diagrams.py`

Regenerates the window and door style diagrams in `assets/styles/`.

```sh
python3 tools/make-style-diagrams.py
```

These fill the product cards on `/windows/` and `/doors/` that no photograph
of our own work covers — the awning window, and all six door styles. They are
diagrams rather than photographs on purpose. The open-license image pools are
mostly manufacturer marketing shots (the top "casement window" result is an
Andersen photo under CC BY-ND), and a competitor's product does not belong on
a card quoting our prices. A diagram also answers the question the card is
actually asked: how the style opens.

Replace any of them the day a real installation photo exists — the markup is
the same `<img>` either way.

## `csp-hash.py`

`_headers` pins the visualizer's inline `<script type="importmap">` by SHA-256,
so any edit to that block — a three.js version bump, a reformat — stops the
browser running it and the visualizer silently never loads.

```sh
python3 tools/csp-hash.py
```

Prints the current hash and exits non-zero if `_headers` is stale. Run it after
`vendor-three.mjs` or any edit to `visualizer/index.html`'s import map.

To test the policy before deploying, serve the site with the headers applied
rather than trusting it in production — a broken `form-action` takes the lead
forms down silently.
