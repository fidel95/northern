#!/usr/bin/env python3
"""Draws the line-art house used for service cards that have no job photo yet.

    python3 tools/make-house-art.py

We have real photographs of window work and nothing yet for roofing,
gutters, siding, doors or concrete. Stock photography would put a stranger's
roof on a card that implies it is ours, so those cards show this drawing
instead: one house, with the part that service covers drawn in, and the rest
left in pencil. It echoes the logo's three rooflines on purpose.

Output is a <g id="np-house"> inside a hidden <svg>, written between the
markers

    <!-- house-art:start -->  ...  <!-- house-art:end -->

in every HTML file that carries them (only index.html today). Pages draw it
with <use href="#np-house"/> and pick a crop with the outer viewBox.

Nothing here has a colour. Every shape carries a class (h-wall, h-roof,
h-line...) that css/site.css paints from design-system tokens. Every shape
that belongs to a service also has a twin directly above it (classes
"hl hl-roof", "hl hl-gutter", ...) whose opacity is a custom property
(--hl-roof, ...). Set that property to 1 on the <svg> and the part is drawn
in; the property inherits into the <use> instance, which a class selector on
the card could not reach. Keeping each twin next to its base, rather than in
one overlay on top, means the main house still covers the wings behind it
when a wing is highlighted.

Coordinates are in a 960 x 600 box; ground is y = 460.
"""
import glob
import os
import random
import re

ROOT = os.path.join(os.path.dirname(__file__), '..')
GROUND = 460


def f(n):
    return f'{n:g}'


def poly(pts):
    return 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts) + 'Z'


def rect(x, y, w, h):
    return f'M{f(x)} {f(y)}h{f(w)}v{f(h)}h{f(-w)}Z'


def hlines(x0, x1, y0, y1, step):
    return ''.join(f'M{f(x0)} {f(y)}H{f(x1)}' for y in range(y0, y1 + 1, step))


def tri_courses(left, apex, right, step):
    """Shingle courses across a triangle, from the eave line up to the ridge."""
    (lx, ly), (ax, ay), (rx, _) = left, apex, right
    d = ''
    y = ly - step
    while y > ay + step * 0.8:
        t = (ly - y) / (ly - ay)
        x0 = lx + (ax - lx) * t + 3
        x1 = rx + (ax - rx) * t - 3
        d += f'M{f(round(x0, 1))} {f(y)}H{f(round(x1, 1))}'
        y -= step
    return d


def window(x, y, w, h, cross=True):
    frame = rect(x, y, w, h)
    glass = rect(x + 5, y + 5, w - 10, h - 10)
    mull = (f'M{f(x + w / 2)} {f(y + 5)}V{f(y + h - 5)}' if cross else '') + f'M{f(x + 5)} {f(y + h / 2)}H{f(x + w - 5)}'
    sill = rect(x - 4, y + h, w + 8, 5)
    return frame, glass, mull, sill


def pines(seed):
    """Background treeline behind the house."""
    rng = random.Random(seed)
    d = ''
    for x in list(range(-10, 980, 34)):
        x += rng.uniform(-10, 10)
        h = rng.uniform(150, 290)
        w = h * rng.uniform(0.3, 0.38)
        tiers = 9
        pts = [(x - 3, GROUND), (x - 3, GROUND - 8)]
        left, right = [], []
        for i in range(tiers + 1):
            t = i / tiers
            y = GROUND - 8 - (h - 8) * t
            half = (w / 2) * (1 - t)
            left += [(x - half, y), (x - half * 0.55, y - h / tiers * 0.5)]
            right += [(x + half, y), (x + half * 0.55, y - h / tiers * 0.5)]
        pts += left + [(x, GROUND - h - 4)] + right[::-1] + [(x + 3, GROUND - 8), (x + 3, GROUND)]
        d += poly([(round(px), round(py)) for px, py in pts])
    return d


TWIN = {  # base class -> class of its drawn-in twin
    'h-roof': 'hl-fill', 'h-wall': 'hl-fill', 'h-frame': 'hl-fill', 'h-door': 'hl-fill',
    'h-gutter': 'hl-fill', 'h-slab': 'hl-fill', 'h-glass': 'hl-glass',
    'h-course': 'hl-course', 'h-line': 'hl-course', 'h-pipe': 'hl-pipe', 'h-knob': 'hl-course',
}


def build():
    out = []

    def add(cls, d, svc=None):
        out.append(f'<path class="{cls}" d="{d}"/>')
        # Each part's highlight twin sits directly above it in paint order, so
        # whatever stands in front of the part still covers its highlight.
        if svc:
            out.append(f'<path class="hl hl-{svc} {TWIN[cls]}" d="{d}"/>')

    def add_window(win, svc='window'):
        fr, gl, mu, si = win
        add('h-frame', fr, svc); add('h-glass', gl, svc); add('h-line', mu, svc); add('h-frame', si, svc)

    add('h-tree', pines(11))
    add('h-ground', rect(0, GROUND, 960, 140))

    # --- Right wing: garage, the logo's right-hand peak --------------------
    wing_l, wing_apex, wing_r = (548, 338), (735, 226), (922, 338)
    add('h-wall', rect(596, 330, 286, GROUND - 330), 'siding')
    add('h-course', hlines(596, 882, 346, GROUND - 6, 12), 'siding')
    add('h-door', rect(648, 372, 186, GROUND - 372), 'door')
    add('h-line', hlines(648, 834, 394, GROUND - 6, 22), 'door')
    add('h-roof', poly([wing_l, wing_apex, wing_r]), 'roof')
    add('h-course', tri_courses(wing_l, wing_apex, wing_r, 12), 'roof')
    add('h-gutter', rect(544, 338, 382, 8), 'gutter')
    add('h-pipe', f'M904 346V{GROUND - 10}q0 8 10 8h8', 'gutter')

    # --- Left wing: the smaller left-hand peak -----------------------------
    lw_l, lw_apex, lw_r = (60, 352), (196, 262), (332, 352)
    add('h-wall', rect(84, 344, 210, GROUND - 344), 'siding')
    add('h-course', hlines(84, 294, 360, GROUND - 6, 12), 'siding')
    add_window(window(128, 382, 92, 58))
    add('h-roof', poly([lw_l, lw_apex, lw_r]), 'roof')
    add('h-course', tri_courses(lw_l, lw_apex, lw_r, 12), 'roof')
    add('h-gutter', rect(56, 352, 280, 8), 'gutter')
    add('h-pipe', f'M76 360V{GROUND - 10}q0 8 -10 8h-8', 'gutter')

    # --- Main house: the centre peak ---------------------------------------
    m_l, m_apex, m_r = (226, 270), (430, 76), (634, 270)
    add('h-wall', rect(268, 262, 324, GROUND - 262), 'siding')
    add('h-course', hlines(268, 592, 290, GROUND - 6, 12), 'siding')
    # Upper floor: three windows. Lower floor: one either side of the door.
    for w in (window(296, 296, 64, 64), window(398, 296, 64, 64), window(500, 296, 64, 64),
              window(286, 380, 92, 62), window(482, 380, 92, 62)):
        add_window(w)
    add('h-door', rect(406, 372, 46, GROUND - 372), 'door')
    add('h-line', rect(413, 380, 32, 30) + rect(413, 418, 32, 34), 'door')
    add('h-glass', rect(456, 372, 14, GROUND - 372), 'door')
    add('h-knob', 'M446 416a2 2 0 1 0 0.1 0Z', 'door')
    add('h-roof', poly([(396, 366), (480, 366), (474, 356), (402, 356)]), 'roof')  # canopy
    add('h-roof', poly([m_l, m_apex, m_r]), 'roof')
    add('h-course', tri_courses(m_l, m_apex, m_r, 13), 'roof')
    add('h-frame', rect(416, 150, 28, 34), 'roof')  # gable vent
    add('h-line', hlines(420, 440, 158, 178, 6), 'roof')
    add('h-gutter', rect(222, 270, 416, 9), 'gutter')
    add('h-pipe', f'M278 279V{GROUND - 10}q0 8 -10 8h-8M582 279V{GROUND - 10}q0 8 10 8h8', 'gutter')

    # --- Concrete: stoop and step, front walk, driveway --------------------
    add('h-slab', rect(396, GROUND, 88, 10) + rect(388, GROUND + 10, 104, 10)
        + poly([(404, GROUND + 20), (476, GROUND + 20), (488, 600), (392, 600)])
        + poly([(648, GROUND), (834, GROUND), (902, 600), (590, 600)]), 'concrete')
    add('h-line', 'M399 526H481M396 564H484M741 460V600M627 507H853M609 553H877', 'concrete')

    return ('<svg class="house-defs" width="0" height="0" aria-hidden="true" focusable="false">'
            '<defs><g id="np-house">' + ''.join(out) + '</g></defs></svg>')


def main():
    art = build()
    block = f'<!-- house-art:start -->\n{art}\n<!-- house-art:end -->'
    pat = re.compile(r'<!-- house-art:start -->.*?<!-- house-art:end -->', re.S)
    hits = 0
    for path in glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True):
        if '/node_modules/' in path:
            continue
        with open(path) as fh:
            html = fh.read()
        if '<!-- house-art:start -->' not in html:
            continue
        with open(path, 'w') as fh:
            fh.write(pat.sub(lambda m: block, html))
        hits += 1
        print('updated', os.path.relpath(path, ROOT))
    if not hits:
        print(art)
    print(len(art), 'bytes')


if __name__ == '__main__':
    main()
