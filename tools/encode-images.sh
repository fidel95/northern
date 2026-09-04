#!/usr/bin/env sh
# Regenerates the AVIF siblings the site's <picture> elements point at.
#
# The JPEGs stay as the fallback <img src> — they are what a browser without
# AVIF support gets — so this only ever adds files, never replaces one.
# Re-run it after adding or re-exporting any photo, then wire the new file
# into the markup.
#
# Requires: avifenc (libavif), magick (ImageMagick).
set -eu

cd "$(dirname "$0")/.."

# Gallery photos render inside a square, object-fit: cover box that is at most
# ~320 CSS px wide, so 675w covers a 2x display and 340w covers everything
# else. Quality 55 is invisible at that scale and roughly halves the bytes.
for f in assets/gallery/*.jpg; do
  base="${f%.jpg}"
  avifenc -q 55 -s 6 -j all "$f" "$base.avif" >/dev/null
  magick "$f" -resize 340x -strip "/tmp/npcs-small.png"
  avifenc -q 55 -s 6 -j all "/tmp/npcs-small.png" "$base-340.avif" >/dev/null
  rm -f "/tmp/npcs-small.png"
  printf '%-46s %7s -> %7s + %s\n' "$f" \
    "$(wc -c < "$f" | tr -d ' ')" \
    "$(wc -c < "$base.avif" | tr -d ' ')" \
    "$(wc -c < "$base-340.avif" | tr -d ' ')"
done

# The hero is the homepage's LCP element. Its box is wide and short on a
# phone (~366 CSS px) and tall on a desktop, so with object-fit: cover the
# widest source a 2x phone actually needs is ~735px — hence 760w rather than
# 700w, which would tip those devices onto the full-size file instead.
avifenc -q 58 -s 6 -j all assets/hero-home.jpg assets/hero-home.avif >/dev/null
magick assets/hero-home.jpg -resize 760x -strip /tmp/npcs-hero.png
avifenc -q 58 -s 6 -j all /tmp/npcs-hero.png assets/hero-home-760.avif >/dev/null
rm -f /tmp/npcs-hero.png
printf '%-46s %7s -> %7s + %s\n' assets/hero-home.jpg \
  "$(wc -c < assets/hero-home.jpg | tr -d ' ')" \
  "$(wc -c < assets/hero-home.avif | tr -d ' ')" \
  "$(wc -c < assets/hero-home-760.avif | tr -d ' ')"
