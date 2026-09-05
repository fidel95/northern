#!/usr/bin/env python3
"""Regenerates the service-area map on the contact page.

Prints an <svg> block to stdout. Paste it over the existing one inside
<figure class="service-map"> in contact/index.html — same arrangement as
csp-hash.py, which computes a value you then paste into _headers. Nothing
here runs at build time, and nothing rewrites a page for you.

Boundaries come from the Census cartographic boundary file (public domain,
generalised to 1:500,000), simplified again with mapshaper. The simplify has
to be topology-aware: GDAL's -simplify works one feature at a time and opens
slivers between counties that share a border, which shows up as hairline gaps
where Marion meets Hamilton.

    python3 tools/make-service-map.py            # paste the output
    python3 tools/make-service-map.py --keep     # and keep the downloads

Requires network on first run (~11 MB, cached in the work directory) and npx.

The map says three things at once, which is why it is three layers:

There is deliberately no marker on the office. The map answers "do you come
to me?", and a dot on Crawfordsville answers "where do you sit?" — which
invites a homeowner in Carmel or New Albany to measure the distance to it.

  the silhouette  every county in Indiana — we will quote anywhere in it
  the focus band  central and southern Indiana, plus Louisville
  the five        the counties we are a registered contractor in

The state border is then drawn a second time, over the focus band, with a
<use>. The band crosses the Ohio into Jefferson County, Kentucky, and without
that line on top the Louisville end just looks like a bump on Indiana's
southern edge instead of a piece on the far side of a state border.

The referenced <path> sits in <defs> carrying no class, which is load-bearing.
A <use> clones the element it points at, class attribute and all, so pointing
at the drawn outline gave the clone .service-map__outline a second time — and
that class has a fill. The second pass painted the state back in over the
focus band, leaving only Louisville, which is outside Indiana, still visible.
Unclassed, the clone inherits fill and stroke from whichever <use> refers to
it, which is what lets one path be drawn once filled and once as a line.

The focus band is dissolved into one shape on purpose. It is a region, not a
list, and drawing sixty-five separate counties would say the opposite — as
well as costing about four times the markup.

The SVG carries no colours of its own — every fill and stroke is a CSS
variable applied from .service-map in css/content.css, so the map follows the
palette in css/base.css rather than freezing a copy of it. That is also why
it is inlined rather than referenced with <img>: an <img>-loaded SVG is a
closed document that inherits nothing from the page.
"""

import argparse
import json
import pathlib
import subprocess
import sys
import tempfile
import urllib.request

SOURCE = "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip"

INDIANA, KENTUCKY = "18", "21"

# Registered contractor here, per about/index.html. Drawn county by county,
# because that page names them one by one and this should agree with it.
LICENSED = ["Marion", "Hamilton", "Boone", "Hendricks", "Johnson"]

# Northern Indiana — the part outside the focus band. Everything not listed
# here is in it, so this list is what defines "central and southern Indiana"
# for the map. The line sits at the northern edge of Tippecanoe County
# (40.563N), which puts Lafayette, Kokomo, Marion and Muncie inside the band
# and Fort Wayne, South Bend and the lake counties outside it.
NORTHERN = [
    "Adams", "Allen", "Benton", "Carroll", "Cass", "DeKalb", "Elkhart",
    "Fulton", "Huntington", "Jasper", "Kosciusko", "LaGrange", "LaPorte",
    "Lake", "Marshall", "Miami", "Newton", "Noble", "Porter", "Pulaski",
    "St. Joseph", "Starke", "Steuben", "Wabash", "Wells", "White", "Whitley",
]

# The Louisville end of the band. Indiana has a Jefferson County too, hence
# the state code — filtering on the name alone quietly shades Madison, IN.
KENTUCKY_FOCUS = ["Jefferson"]

# Viewport width in user units. Height follows from the framed geography.
WIDTH = 640.0
PAD = 8.0
SIMPLIFY = "25%"


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def mapshaper(*args):
    run(["npx", "-y", "mapshaper@0.6", *[str(a) for a in args]])


def fetch(work):
    shp = work / "cb_2023_us_county_500k.shp"
    if shp.exists():
        return shp
    zipped = work / "counties.zip"
    if not zipped.exists():
        print(f"downloading {SOURCE}", file=sys.stderr)
        urllib.request.urlretrieve(SOURCE, zipped)
    run(["unzip", "-o", "-q", str(zipped), "-d", str(work)])
    return shp


def rings(node):
    """Every linear ring under a GeoJSON node, whatever it is wrapped in."""
    kind = node.get("type")
    if kind == "FeatureCollection":
        return [r for f in node["features"] for r in rings(f)]
    if kind == "GeometryCollection":
        return [r for g in node["geometries"] for r in rings(g)]
    if kind == "Feature":
        return rings(node["geometry"])
    if kind == "Polygon":
        return list(node["coordinates"])
    if kind == "MultiPolygon":
        return [r for part in node["coordinates"] for r in part]
    raise ValueError(f"unexpected geometry: {kind}")


def build(work):
    """(counties, Indiana outline, focus band) as GeoJSON, projected."""
    shp = fetch(work)
    counties = work / "counties.json"
    mapshaper(shp,
              "-filter", f'STATEFP=="{INDIANA}" || STATEFP=="{KENTUCKY}"',
              "-proj", "EPSG:3857",
              "-simplify", SIMPLIFY, "keep-shapes",
              "-filter-fields", "NAME,STATEFP",
              "-o", counties, "format=geojson")
    everything = json.loads(counties.read_text())

    def where(pred):
        return [f for f in everything["features"] if pred(f["properties"])]

    indiana = where(lambda p: p["STATEFP"] == INDIANA)
    focus = where(lambda p: (p["STATEFP"] == INDIANA and p["NAME"] not in NORTHERN)
                  or (p["STATEFP"] == KENTUCKY and p["NAME"] in KENTUCKY_FOCUS))

    missing = ([n for n in LICENSED + NORTHERN
                if n not in {f["properties"]["NAME"] for f in indiana}]
               + [n for n in KENTUCKY_FOCUS
                  if not any(f["properties"]["NAME"] == n for f in focus)])
    if missing:
        sys.exit(f"county not found in the source data: {', '.join(missing)}")

    def dissolve(features, name):
        src, out = work / f"{name}-in.json", work / f"{name}.json"
        src.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
        mapshaper(src, "-dissolve", "-o", out, "format=geojson")
        return json.loads(out.read_text())

    return ({f["properties"]["NAME"]: f for f in indiana},
            dissolve(indiana, "state"), dissolve(focus, "focus"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", action="store_true",
                    help="reuse/leave the downloads in ./build instead of a temp dir")
    args = ap.parse_args()

    if args.keep:
        work = pathlib.Path("build")
        work.mkdir(exist_ok=True)
        by_name, state, focus = build(work)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            by_name, state, focus = build(pathlib.Path(tmp))

    # Frame on both layers: Louisville hangs below Indiana's southern border.
    framed = rings(state) + rings(focus)
    xs = [p[0] for r in framed for p in r]
    ys = [p[1] for r in framed for p in r]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    scale = WIDTH / (maxx - minx)

    def place(x, y):
        return round((x - minx) * scale + PAD, 1), round((maxy - y) * scale + PAD, 1)

    def path(node):
        return "".join(
            "M" + " ".join(f"{x},{y}" for x, y in (place(*p) for p in ring)) + "Z"
            for ring in rings(node))

    box_w = round(WIDTH + PAD * 2, 1)
    box_h = round((maxy - miny) * scale + PAD * 2, 1)
    counties = "\n".join(
        f'    <path class="service-map__county" d="{path(by_name[n])}">'
        f'<title>{n} County</title></path>' for n in LICENSED)

    print(f'''<svg class="service-map__svg" viewBox="0 0 {box_w} {box_h}" role="img" aria-labelledby="service-map-title service-map-desc">
  <title id="service-map-title">Where Northern Pines works</title>
  <desc id="service-map-desc">A map of Indiana in three shades. The whole state is outlined, because the company quotes anywhere in it. Central and southern Indiana are filled, along with Jefferson County in Kentucky, which is Louisville — that is where the work is concentrated. Filled brightest are the five counties the company is a registered contractor in: {", ".join(LICENSED)}. All of this is written out in the list that accompanies the map.</desc>
  <defs><path id="service-map-indiana" d="{path(state)}"/></defs>
  <use href="#service-map-indiana" class="service-map__outline"/>
  <path class="service-map__focus" d="{path(focus)}"><title>Central and southern Indiana, and the Louisville area</title></path>
  <use href="#service-map-indiana" class="service-map__border"/>
  <g class="service-map__counties">
{counties}
  </g>
</svg>''')


if __name__ == "__main__":
    main()
