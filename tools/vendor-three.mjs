// Mirrors the exact three.js files the visualizer imports into js/vendor/three,
// following relative imports until the graph closes.
//
// The visualizer used to import three, and its Draco and Basis decoders, from
// jsdelivr at runtime — a third party in the critical path of the tool most
// visitors come here for. Run this to move to a new three version: bump V,
// run `node tools/vendor-three.mjs`, and delete anything it no longer writes.
// The import map in visualizer/index.html and the decoder paths in
// js/visualizer/houseLoader.js point at the result.
//
// examples/jsm/libs/draco/gltf/ is fetched by the crawler but deleted after —
// setDecoderPath() points at the parent directory, so nothing loads it.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';

const V = '0.185.1';
const CDN = `https://cdn.jsdelivr.net/npm/three@${V}/`;
const OUT = '/Users/fidel/Desktop/Claude/js/vendor/three';

const ENTRIES = [
  'build/three.module.js',
  'examples/jsm/controls/OrbitControls.js',
  'examples/jsm/loaders/GLTFLoader.js',
  'examples/jsm/loaders/DRACOLoader.js',
  'examples/jsm/loaders/KTX2Loader.js',
  'examples/jsm/loaders/RGBELoader.js',
  'examples/jsm/objects/Sky.js',
];

const seen = new Set();
const queue = [...ENTRIES];
const fetched = [];

while (queue.length) {
  const rel = queue.shift();
  if (seen.has(rel)) continue;
  seen.add(rel);

  const res = await fetch(CDN + rel);
  if (!res.ok) { console.error('FAIL', rel, res.status); process.exitCode = 1; continue; }
  const bytes = Buffer.from(await res.arrayBuffer());

  const dest = join(OUT, rel);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, bytes);            // binary-safe: .wasm must not round-trip through UTF-8
  fetched.push([rel, bytes.length]);

  if (!rel.endsWith('.js')) continue;      // only source files have imports to follow
  const body = bytes.toString('utf8');

  // Follow relative specifiers; bare 'three' is resolved by the import map.
  const re = /(?:^|[\s;])(?:import|export)[\s\S]*?from\s+['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(body))) {
    queue.push(posix.normalize(posix.join(posix.dirname(rel), m[1])));
  }
  // new Worker(new URL('./x.js', import.meta.url)) style deps
  const re2 = /new URL\(\s*['"](\.[^'"]+)['"]/g;
  while ((m = re2.exec(body))) {
    queue.push(posix.normalize(posix.join(posix.dirname(rel), m[1])));
  }
}

console.log(fetched.length, 'modules');
for (const [f, n] of fetched) console.log(String(n).padStart(8), f);
