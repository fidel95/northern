"""Writes the six animated roof-shape drawings into roofing/index.html.

    python3 tools/make-roof-shapes.py

Each drawing is an inline <svg> (inline so it can use the page's CSS
variables) made of four layers, which css/roofing.css animates in order:
the walls, the roof outline drawing itself in, the shingle courses, and
rain-blue flow lines showing which way water leaves that roof.

The output replaces everything between <!-- roof-shapes:start --> and
<!-- roof-shapes:end --> in roofing/index.html; the copy beside each
drawing lives in SHAPES below.
"""
import pathlib
import re

W, H, GROUND = 320, 200, 180

# name, slug, roof polygon, wall polygon, flow paths, course spacing, copy, how water leaves
SHAPES = [
    dict(slug='gable', name='Gable',
         roof=[(56, 112), (160, 40), (264, 112)],
         wall=[(72, 112), (248, 112), (248, 180), (72, 180)],
         flows=['M160 50 L70 110', 'M160 50 L250 110'],
         water='Two ways, off the long sides',
         copy='Two slopes meeting at a ridge, with a triangle of wall at each end. The shape most people draw when they draw a house.'),
    dict(slug='hip', name='Hip',
         roof=[(54, 112), (112, 54), (208, 54), (266, 112)],
         wall=[(70, 112), (250, 112), (250, 180), (70, 180)],
         flows=['M160 60 L160 108', 'M110 64 L64 108', 'M210 64 L256 108'],
         water='All four sides',
         copy='Slopes on every side, meeting at a short ridge. No gable walls for the wind to catch, and the gutters run all the way around.'),
    dict(slug='gambrel', name='Gambrel',
         roof=[(54, 112), (84, 72), (160, 40), (236, 72), (266, 112)],
         wall=[(70, 112), (250, 112), (250, 180), (70, 180)],
         flows=['M160 46 L90 72 L62 108', 'M160 46 L230 72 L258 108'],
         water='Two ways, picking up speed on the steep lower pitch',
         copy='Two pitches on each side, shallow above and steep below: the barn roof. The steep lower slope makes room for a full upstairs.'),
    dict(slug='mansard', name='Mansard',
         roof=[(60, 112), (80, 62), (102, 48), (218, 48), (240, 62), (260, 112)],
         wall=[(72, 112), (248, 112), (248, 180), (72, 180)],
         flows=['M150 52 L150 62 L150 108', 'M170 52 L170 62 L170 108'],
         water='Off a low top, then down the near-vertical sides',
         copy='Almost vertical lower slopes, often with dormers, under a low top. A whole top floor tucked inside the roof.',
         dormers=[(108, 76), (190, 76)]),
    dict(slug='shed', name='Shed',
         roof=[(54, 60), (266, 98), (266, 110), (54, 72)],
         wall=[(70, 75), (250, 107), (250, 180), (70, 180)],
         flows=['M66 66 L258 100'],
         water='One way, to a single gutter',
         copy='A single slope from a high side to a low one. Common on additions, porches and modern houses.'),
    dict(slug='flat', name='Flat / low-slope',
         roof=[(62, 92), (258, 92), (258, 104), (62, 104)],
         wall=[(72, 104), (248, 104), (248, 180), (72, 180)],
         flows=['M88 97 L246 97', 'M248 104 L248 130'],
         water='Gently, to a drain or scupper',
         copy='Never truly flat: a slight pitch carries water to a drain or scupper. Covered with a continuous membrane rather than shingles.',
         parapet=True),
]


def pts(poly):
    return ' '.join(f'{x},{y}' for x, y in poly)


def courses(poly, step):
    """Horizontal shingle lines clipped to the roof polygon."""
    ys = [y for _, y in poly]
    top, bottom = min(ys), max(ys)
    out = []
    y = bottom - step
    while y > top + 3:
        xs = []
        for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
            if (y1 - y) * (y2 - y) < 0:
                xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            if b - a > 12:
                out.append((a + 5, y, b - 5))
        y -= step
    return out


def shed_courses(poly, n=5):
    """The shed roof is a sloped slab: its courses run along the slope."""
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = poly
    lines = []
    for i in range(1, n):
        t = i / n
        lines.append((x4 + (x1 - x4) * t, y4 + (y1 - y4) * t, x3 + (x2 - x3) * t, y3 + (y2 - y3) * t))
    return lines


def svg(shape):
    s = shape['slug']
    roof, wall = shape['roof'], shape['wall']
    parts = [f'<svg class="roof-art__svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="roof-{s}-t">',
             f'<title id="roof-{s}-t">{shape["name"]} roof. Water runs: {shape["water"].lower()}.</title>',
             f'<path class="r-ground" d="M16 {GROUND}H{W - 16}"/>',
             f'<polygon class="r-wall" points="{pts(wall)}"/>']
    # A door and a window, so the drawing reads as a house.
    floor = GROUND
    wx0 = min(x for x, _ in wall)
    parts.append(f'<rect class="r-wall r-trim" x="{wx0 + 22}" y="{floor - 40}" width="22" height="40"/>')
    parts.append(f'<rect class="r-wall r-trim" x="{wx0 + 64}" y="{floor - 52}" width="34" height="26"/>')
    parts.append(f'<rect class="r-wall r-trim" x="{wx0 + 116}" y="{floor - 52}" width="34" height="26"/>')
    parts.append(f'<polygon class="r-roof" pathLength="1" points="{pts(roof)}"/>')
    if s == 'shed':
        lines = shed_courses(roof)
        for i, (a, b, c, d) in enumerate(lines):
            parts.append(f'<path class="r-course" style="--i:{i}" d="M{a + 6:.1f} {b:.1f}L{c - 6:.1f} {d:.1f}"/>')
    elif shape.get('parapet'):
        parts.append(f'<path class="r-course" style="--i:0" d="M62 88V92M258 88V92M62 88H258"/>')
    else:
        for i, (a, y, b) in enumerate(courses(roof, 12)):
            parts.append(f'<path class="r-course" style="--i:{i}" d="M{a:.1f} {y:.1f}H{b:.1f}"/>')
    for i, (dx, dy) in enumerate(shape.get('dormers', [])):
        parts.append(f'<path class="r-course r-dormer" style="--i:{i + 4}" d="M{dx} {dy + 22}V{dy + 6}L{dx + 11} {dy - 4}L{dx + 22} {dy + 6}V{dy + 22}Z"/>')
    for i, d in enumerate(shape['flows']):
        parts.append(f'<path class="r-flow" style="--i:{i}" pathLength="1" d="{d}"/>')
    parts.append('</svg>')
    return ''.join(parts)


def card(shape):
    return f'''      <li class="roof-card">
        <figure class="roof-art" data-roof="{shape['slug']}">
          {svg(shape)}
          <button type="button" class="roof-art__replay" aria-label="Replay the {shape['name'].lower()} roof drawing">Replay</button>
        </figure>
        <div class="roof-card__body">
          <h3 class="roof-card__name">{shape['name']}</h3>
          <p class="roof-card__copy">{shape['copy']}</p>
          <p class="roof-card__water"><span class="roof-card__drop" aria-hidden="true"></span>Water runs: {shape['water'].lower()}</p>
        </div>
      </li>'''


if __name__ == '__main__':
    page = pathlib.Path(__file__).resolve().parent.parent / 'roofing' / 'index.html'
    html = page.read_text()
    block = '<!-- roof-shapes:start -->\n' + '\n'.join(card(s) for s in SHAPES) + '\n      <!-- roof-shapes:end -->'
    html, n = re.subn(r'<!-- roof-shapes:start -->.*?<!-- roof-shapes:end -->', lambda m: block, html, flags=re.S)
    if n != 1:
        raise SystemExit('roofing/index.html needs exactly one roof-shapes:start/end marker pair')
    page.write_text(html)
    print(f'{page.relative_to(page.parent.parent)}: {len(SHAPES)} roof shapes')
