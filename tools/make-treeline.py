#!/usr/bin/env python3
"""Writes the pine-silhouette strips used at section edges on the site.

    python3 tools/make-treeline.py

Each strip is a single black path on a transparent ground. The site never
shows them as images: css/site.css uses them as CSS masks over a
design-system colour (var(--surface-000) and friends), so the trees always
take the palette of the section they sit in and follow the theme.

The strips tile horizontally (mask-repeat: repeat-x). A tree that crosses
the left or right edge is drawn a second time one tile-width over, so the
part the viewBox cuts off on one side reappears on the other, and a solid
ground band runs along the bottom: the seam between tiles is invisible.

The seed is fixed so the output is reproducible; change it (or the counts)
and re-run to get a different skyline.
"""
import os
import random

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'brand')
W, H = 1440, 160


def tree(cx, base, height, width, rng):
    """One conifer: a trunk stub and alternating tiers up to a sharp tip."""
    tiers = max(4, int(height / 12))
    left, right = [], []
    for i in range(tiers + 1):
        t = i / tiers                       # 0 at the base, 1 at the tip
        y = base - height * t
        half = (width / 2) * (1 - t) ** 0.92
        # Each tier steps in, then flares out: the jagged edge that reads
        # as branches at silhouette scale.
        flare = half * (1.0 + 0.18 * rng.random())
        inner = half * (0.55 + 0.1 * rng.random())
        dy = height / tiers
        left.append((cx - flare, y))
        left.append((cx - inner, y - dy * 0.45))
        right.append((cx + flare, y))
        right.append((cx + inner, y - dy * 0.45))
    tip = (cx + rng.uniform(-0.6, 0.6), base - height - rng.uniform(2, 6))
    trunk = width * 0.06
    pts = [(cx - trunk, H), (cx - trunk, base)] + left + [tip] + right[::-1] + [(cx + trunk, base), (cx + trunk, H)]
    return pts


def strip(seed, count, hmin, hmax, wratio, ground):
    rng = random.Random(seed)
    xs = sorted(rng.uniform(0, W) for _ in range(count))
    paths = []
    for x in xs:
        h = rng.uniform(hmin, hmax)
        w = h * wratio * rng.uniform(0.85, 1.15)
        base = H - ground + rng.uniform(-2, 2)
        pts = tree(x, base, h, w, rng)
        # Wrap: a tree hanging off one edge is repeated on the other.
        shifts = [0]
        if x - w * 0.6 < 0:
            shifts.append(W)
        if x + w * 0.6 > W:
            shifts.append(-W)
        for dx in shifts:
            d = 'M' + 'L'.join(f'{round(px + dx)} {round(py)}' for px, py in pts) + 'Z'
            paths.append(d)
    paths.append(f'M0 {H - ground} H{W} V{H} H0 Z')
    return ''.join(paths)


def write(name, d):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
           f'width="{W}" height="{H}"><path d="{d}"/></svg>\n')
    with open(os.path.join(OUT, name), 'w') as fh:
        fh.write(svg)
    print(name, len(svg), 'bytes')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    # Far ridge: tall, dense, sits behind a band of mist.
    write('pines-far.svg', strip(seed=7, count=62, hmin=70, hmax=140, wratio=0.34, ground=10))
    # Near ridge: fewer, shorter trees in the section colour itself.
    write('pines-near.svg', strip(seed=19, count=34, hmin=36, hmax=92, wratio=0.38, ground=6))
