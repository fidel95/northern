#!/usr/bin/env python3
"""Regenerates the window/door style diagrams in assets/styles/.

These fill the product cards on /windows/ and /doors/ that no photograph of
our own work covers. They are deliberately diagrams and not renders or stock
photography: the question someone actually has on those cards is how the
style opens, which a photograph of a closed door answers badly and a
competitor's marketing shot answers dishonestly.

Drawn to the 4/3 box .door-card__art reserves. Palette is the site's own.

    python3 tools/make-style-diagrams.py
"""
import pathlib

W, H = 800, 600
INK, FRAME, ACID, MUTED = '#161618', '#d9d9d6', '#e9ee1b', '#8a8a91'
SLAB = '#b8b6b0'

DEFS = f'''<defs>
<marker id="a" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
<path d="M0 0 L10 5 L0 10 z" fill="{ACID}"/></marker>
<linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
<stop offset="0" stop-color="#3a464a"/><stop offset="1" stop-color="#232b2e"/></linearGradient>
</defs>'''


def head(label):
    grid = ''.join(f'<line x1="{x}" y1="0" x2="{x}" y2="{H}"/>' for x in range(0, W, 50))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" '
            f'height="{H}" role="img" aria-label="{label}">'
            f'<rect width="{W}" height="{H}" fill="{INK}"/>'
            f'<g stroke="{MUTED}" stroke-width="1" opacity="0.13">{grid}</g>{DEFS}')


def glazed(x, y, w, h, t=16):
    """A frame with a glazed opening."""
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{FRAME}" rx="2"/>'
            f'<rect x="{x+t}" y="{y+t}" width="{w-2*t}" height="{h-2*t}" fill="url(#g)"/>')


def slab(x, y, w, h, lite=True):
    """A solid door leaf, optionally with a glass lite in the upper half."""
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{SLAB}" rx="2"/>'
    if lite:
        lw, lh = w * 0.52, h * 0.30
        s += (f'<rect x="{x+(w-lw)/2}" y="{y+h*0.10}" width="{lw}" height="{lh}" '
              f'fill="url(#g)" rx="2"/>')
    return s


def knob(x, y):
    return f'<circle cx="{x}" cy="{y}" r="10" fill="{ACID}"/>'


def hinge(x1, y1, x2, y2):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{ACID}" '
            f'stroke-width="9" stroke-linecap="round"/>')


def arrow(d):
    return (f'<path d="{d}" fill="none" stroke="{ACID}" stroke-width="6" '
            f'stroke-linecap="round" marker-end="url(#a)"/>')


def swing(x, w, hinge_left=True, inset=30):
    """Elevation symbol for a hinged leaf: a dashed triangle from the two
    corners of the hinge stile converging on the middle of the latch stile.
    This is the view these cards are drawn in, so a plan-view arc would be
    the wrong projection however correct its geometry."""
    hx = x + inset if hinge_left else x + w - inset
    lx = x + w - inset if hinge_left else x + inset
    my = DY + DH / 2
    return (f'<path d="M {hx} {DY+inset} L {lx} {my} L {hx} {DY+DH-inset}" '
            f'fill="none" stroke="{ACID}" stroke-width="4" stroke-dasharray="11 8" '
            f'stroke-linejoin="round" opacity="0.9"/>')


def cap(text):
    return (f'<text x="{W/2}" y="{H-30}" fill="{MUTED}" text-anchor="middle" '
            f'font-family="ui-monospace,SFMono-Regular,monospace" font-size="23" '
            f'letter-spacing="4">{text}</text>')


END = '</svg>'

# ----------------------------------------------------------------- windows
LX, LY, LW, LH = 128, 150, 544, 268          # landscape unit


def awning():
    s = head('Awning window: hinged at the top, swinging outward from the bottom')
    s += glazed(LX, LY, LW, LH)
    s += hinge(LX + 30, LY + 20, LX + LW - 30, LY + 20)
    s += (f'<path d="M {LX+LW/2} {LY+LH-20} C {LX+LW/2+96} {LY+LH+42} '
          f'{LX+LW/2+40} {LY+LH+96} {LX+LW/2-52} {LY+LH+104}" fill="none" '
          f'stroke="{ACID}" stroke-width="5" stroke-dasharray="12 9" '
          f'stroke-linecap="round" marker-end="url(#a)"/>')
    return s + cap('HINGED TOP &#183; OPENS IN RAIN') + END


# ------------------------------------------------------------------- doors
DY, DH = 74, 424                              # door leaf top / height
FT = 14                                       # surrounding frame thickness


def door_frame(x, w):
    return (f'<rect x="{x-FT}" y="{DY-FT}" width="{w+2*FT}" height="{DH+2*FT}" '
            f'fill="{FRAME}" rx="2"/>')


def sliding_patio():
    s = head('Sliding patio door: two panels, one fixed and one sliding sideways')
    x, w = 190, 420
    s += door_frame(x, w)
    s += glazed(x, DY, w / 2, DH)
    s += glazed(x + w / 2, DY, w / 2, DH)
    s += arrow(f'M {x+w*0.80} {DY+DH/2} L {x+w*0.56} {DY+DH/2}')
    s += knob(x + w * 0.545, DY + DH * 0.55)
    return s + cap('ONE PANEL SLIDES') + END


def french():
    s = head('French patio doors: two glazed panels, each hinged at its outer edge')
    x, w = 190, 420
    gap = 10
    s += door_frame(x, w)
    s += glazed(x, DY, (w - gap) / 2, DH)
    s += glazed(x + (w + gap) / 2, DY, (w - gap) / 2, DH)
    s += hinge(x + 8, DY + 24, x + 8, DY + DH - 24)
    s += hinge(x + w - 8, DY + 24, x + w - 8, DY + DH - 24)
    s += swing(x, (w - gap) / 2, hinge_left=True)
    s += swing(x + (w + gap) / 2, (w - gap) / 2, hinge_left=False)
    return s + cap('BOTH PANELS SWING') + END


def multislide():
    s = head('Multi-slide patio door: several panels that slide and stack to one side')
    x, w, n = 128, 544, 4
    pw = w / n
    s += door_frame(x, w)
    for i in range(n):
        s += glazed(x + i * pw, DY, pw, DH, t=12)
    for i in range(1, n):
        s += arrow(f'M {x+i*pw+pw*0.72} {DY+DH*0.5} L {x+i*pw+pw*0.20} {DY+DH*0.5}')
    return s + cap('PANELS STACK TO ONE SIDE') + END


def single_entry():
    s = head('Single entry door: one solid leaf hinged at the side')
    w = 220
    x = (W - w) / 2
    s += door_frame(x, w)
    s += slab(x, DY, w, DH)
    s += hinge(x + 9, DY + 24, x + 9, DY + DH - 24)
    s += knob(x + w - 30, DY + DH * 0.55)
    s += swing(x, w, hinge_left=True)
    return s + cap('HINGED ONE SIDE') + END


def double_entry():
    s = head('Double entry doors: two solid leaves, each hinged at its outer edge')
    x, w = 200, 400
    gap = 10
    s += door_frame(x, w)
    s += slab(x, DY, (w - gap) / 2, DH)
    s += slab(x + (w + gap) / 2, DY, (w - gap) / 2, DH)
    s += hinge(x + 9, DY + 24, x + 9, DY + DH - 24)
    s += hinge(x + w - 9, DY + 24, x + w - 9, DY + DH - 24)
    s += swing(x, (w - gap) / 2, hinge_left=True)
    s += swing(x + (w + gap) / 2, (w - gap) / 2, hinge_left=False)
    return s + cap('TWO ACTIVE LEAVES') + END


def sidelights():
    s = head('Entry door with sidelights: one hinged leaf with fixed glass either side')
    sw, dw, gap = 104, 216, 12
    total = sw * 2 + dw + gap * 2
    x = (W - total) / 2
    s += door_frame(x, total)
    s += glazed(x, DY, sw, DH, t=12)
    s += slab(x + sw + gap, DY, dw, DH)
    s += glazed(x + sw + gap + dw + gap, DY, sw, DH, t=12)
    s += hinge(x + sw + gap + 9, DY + 24, x + sw + gap + 9, DY + DH - 24)
    s += swing(x + sw + gap, dw, hinge_left=True)
    s += knob(x + sw + gap + dw - 30, DY + DH * 0.55)
    return s + cap('FIXED GLASS EITHER SIDE') + END


DIAGRAMS = {
    'awning': awning,
    'patio-sliding': sliding_patio,
    'patio-french': french,
    'patio-multislide': multislide,
    'entry-single': single_entry,
    'entry-double': double_entry,
    'entry-sidelights': sidelights,
}

if __name__ == '__main__':
    out = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'styles'
    out.mkdir(parents=True, exist_ok=True)
    for name, fn in DIAGRAMS.items():
        p = out / f'{name}.svg'
        p.write_text(fn())
        print(f'{p.relative_to(out.parent.parent)}  {p.stat().st_size:>6} bytes')
