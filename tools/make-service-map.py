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

The SVG carries no colours of its own — every fill and stroke is a CSS
variable applied from .service-map in css/content.css, so the map follows the
palette in css/base.css rather than freezing a copy of it. That is also why
it is inlined rather than referenced with <img>: an <img>-loaded SVG is a
closed document that inherits nothing from the page.
"""

import argparse
import json
import math
import pathlib
import subprocess
import sys
import tempfile
import urllib.request

SOURCE = "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip"

# Indiana. The whole state is drawn as one outline; these nine are filled.
STATE_FIPS = "18"

# Registered contractor here, per about/index.html. Filled solid.
LICENSED = ["Marion", "Hamilton", "Boone", "Hendricks", "Johnson"]

# Served, but from a distance — the cities in service-area/index.html under
# "And the rest of it." Filled at half strength so the two tiers read apart.
OUTLYING = ["Tippecanoe", "Howard", "Madison", "Delaware"]

# Monument Circle. Stands in for the office until a street address exists;
# see the OFFICE line in contact/index.html, which says the same thing.
OFFICE_LAT, OFFICE_LON = 39.7684, -86.1581

# Viewport width in user units. Height follows from Indiana's proportions.
WIDTH = 640.0
PAD = 8.0
SIMPLIFY = "25%"


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


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


def shapes(work):
    """(counties, state outline) as GeoJSON, projected and simplified."""
    shp, counties, state = fetch(work), work / "counties.json", work / "state.json"
    run(["npx", "-y", "mapshaper@0.6", str(shp),
         "-filter", f'STATEFP=="{STATE_FIPS}"',
         "-proj", "EPSG:3857",
         "-simplify", SIMPLIFY, "keep-shapes",
         "-filter-fields", "NAME",
         "-o", str(counties), "format=geojson"])
    run(["npx", "-y", "mapshaper@0.6", str(counties),
         "-dissolve", "-o", str(state), "format=geojson"])
    return json.loads(counties.read_text()), json.loads(state.read_text())


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


def mercator(lat, lon):
    x = lon * 20037508.34 / 180
    y = math.log(math.tan((90 + lat) * math.pi / 360)) / (math.pi / 180)
    return x, y * 20037508.34 / 180


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", action="store_true",
                    help="reuse/leave the downloads in ./build instead of a temp dir")
    args = ap.parse_args()

    if args.keep:
        work = pathlib.Path("build")
        work.mkdir(exist_ok=True)
        counties, state = shapes(work)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            counties, state = shapes(pathlib.Path(tmp))

    outline = rings(state)
    xs = [p[0] for r in outline for p in r]
    ys = [p[1] for r in outline for p in r]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    scale = WIDTH / (maxx - minx)
    height = round((maxy - miny) * scale, 1)

    def place(x, y):
        return round((x - minx) * scale + PAD, 1), round((maxy - y) * scale + PAD, 1)

    def path(node):
        out = []
        for ring in rings(node):
            pts = [place(x, y) for x, y in ring]
            out.append("M" + " ".join(f"{x},{y}" for x, y in pts) + "Z")
        return "".join(out)

    by_name = {f["properties"]["NAME"]: f for f in counties["features"]}
    missing = [n for n in LICENSED + OUTLYING if n not in by_name]
    if missing:
        sys.exit(f"county not found in the source data: {', '.join(missing)}")

    box_w = round(WIDTH + PAD * 2, 1)
    box_h = round(height + PAD * 2, 1)
    served = len(LICENSED) + len(OUTLYING)

    def tier(names, css):
        return "\n".join(
            f'    <path class="service-map__county service-map__county--{css}" '
            f'd="{path(by_name[n])}"><title>{n} County</title></path>'
            for n in names)

    ox, oy = place(*mercator(OFFICE_LAT, OFFICE_LON))

    print(f'''<svg class="service-map__svg" viewBox="0 0 {box_w} {box_h}" role="img" aria-labelledby="service-map-title service-map-desc">
  <title id="service-map-title">Where Northern Pines works</title>
  <desc id="service-map-desc">A map of Indiana with {served} counties marked: {", ".join(LICENSED)}, where the company is a registered contractor, and {", ".join(OUTLYING)}, which it also serves. The office is in Indianapolis, in Marion County. Every county is also named in the list that accompanies the map.</desc>
  <path class="service-map__outline" d="{path(state)}"/>
  <g class="service-map__counties">
{tier(OUTLYING, "outlying")}
{tier(LICENSED, "licensed")}
  </g>
  <g class="service-map__office" aria-hidden="true">
    <circle class="service-map__office-ring" cx="{ox}" cy="{oy}" r="14"/>
    <circle class="service-map__office-dot" cx="{ox}" cy="{oy}" r="4.5"/>
  </g>
</svg>''')


if __name__ == "__main__":
    main()
