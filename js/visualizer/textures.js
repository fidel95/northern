// Procedural PBR texture generation. No external texture files are fetched —
// every siding/roofing/ground material is built at runtime on an offscreen
// <canvas>, including a real (if simple) normal map derived from an analytic
// height field via a Sobel pass, not a flat color swap. This keeps the app
// 100% static (no binary texture assets to host/license) while still giving
// every configurable surface actual per-pixel roughness/normal variation.
//
// Swapping any of this for a scanned/photographed texture set later (e.g.
// from ambientCG or a licensed library) is a drop-in change: replace the
// canvas-generated map/normalMap/roughnessMap with THREE.TextureLoader
// results of the same size in the relevant build* function below — nothing
// else in the app (materials.js, the GLB, the UI) needs to change.

import * as THREE from 'three';

// House surfaces carry UVs in real metres (generate-houses.py), so every
// tiling texture says how many metres one tile covers and its repeat is the
// inverse: lap courses come out the same height on a ranch wall and a
// colonial gable, and shingle courses the same on every roof plane.
const perMetre = (tileMetres) => ({ x: 1 / tileMetres, y: 1 / tileMetres });

// Mutable (not const) so main.js can lower it once, before any texture gets
// generated, on low-tier devices — every build* function below reads it at
// call time via canvas()'s default, so nothing else here needs to change.
let SIZE = 512;
const cache = new Map();

// Must be called (if at all) before the first getXTexture() call — textures
// are generated once and cached, so changing SIZE after the cache has
// entries would only affect textures generated from that point on.
export function setTextureQuality(size) { SIZE = size; }

function canvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function shade(rgb, amount) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amount)));
  return `rgb(${f(rgb.r)},${f(rgb.g)},${f(rgb.b)})`;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Converts a grayscale height canvas into an OpenGL-convention tangent-space
// normal map via a central-difference (Sobel-ish) gradient estimate.
function heightToNormalMap(heightCanvas, strength = 2.2) {
  const w = heightCanvas.width, h = heightCanvas.height;
  const hctx = heightCanvas.getContext('2d');
  const src = hctx.getImageData(0, 0, w, h).data;
  const val = (x, y) => {
    const xi = (x + w) % w, yi = (y + h) % h;
    return src[(yi * w + xi) * 4] / 255;
  };
  const out = canvas(w);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (val(x + 1, y) - val(x - 1, y)) * strength;
      const dy = (val(x, y + 1) - val(x, y - 1)) * strength;
      const nx = -dx, ny = -dy, nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const i = (y * w + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function toTexture(cvs, srgb = false, repeat = null) {
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.repeat.set(repeat.x, repeat.y);
  tex.needsUpdate = true;
  return tex;
}

// --- Siding -----------------------------------------------------------

function lapSiding(colorHex) {
  const rgb = hexToRgb(colorHex);
  const rows = 8;
  const rowH = SIZE / rows;

  const color = canvas(); const cctx = color.getContext('2d');
  const heightC = canvas(); const hctx = heightC.getContext('2d');
  const rough = canvas(); const rctx = rough.getContext('2d');
  const rnd = seededRandom(1337);

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const jitter = (rnd() - 0.5) * 10;
    cctx.fillStyle = shade(rgb, jitter);
    cctx.fillRect(0, y, SIZE, rowH);
    cctx.fillStyle = shade(rgb, jitter - 34);
    cctx.fillRect(0, y + rowH - 3, SIZE, 3);
    cctx.fillStyle = shade(rgb, jitter + 14);
    cctx.fillRect(0, y, SIZE, 2);

    hctx.fillStyle = `rgb(${140 + jitter},${140 + jitter},${140 + jitter})`;
    hctx.fillRect(0, y, SIZE, rowH);
    hctx.fillStyle = 'rgb(40,40,40)';
    hctx.fillRect(0, y + rowH - 3, SIZE, 3);
    hctx.fillStyle = 'rgb(210,210,210)';
    hctx.fillRect(0, y, SIZE, 2);

    rctx.fillStyle = `rgb(${210 + jitter * 2},${210 + jitter * 2},${210 + jitter * 2})`;
    rctx.fillRect(0, y, SIZE, rowH);
  }
  // faint vertical grain speckle
  cctx.globalAlpha = 0.05;
  for (let i = 0; i < 2200; i++) {
    cctx.fillStyle = rnd() > 0.5 ? '#fff' : '#000';
    cctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1, 1 + rnd() * 6);
  }
  cctx.globalAlpha = 1;

  // 8 courses at a 7-inch (178 mm) exposure.
  const repeat = perMetre(8 * 0.178);
  return {
    map: toTexture(color, true, repeat),
    normalMap: toTexture(heightToNormalMap(heightC, 1.6), false, repeat),
    roughnessMap: toTexture(rough, false, repeat),
    repeat,
  };
}

function boardBatten(colorHex) {
  const rgb = hexToRgb(colorHex);
  const boards = 6;
  const boardW = SIZE / boards;
  const battenW = boardW * 0.16;

  const color = canvas(); const cctx = color.getContext('2d');
  const heightC = canvas(); const hctx = heightC.getContext('2d');
  const rnd = seededRandom(4242);

  cctx.fillStyle = shade(rgb, 0); cctx.fillRect(0, 0, SIZE, SIZE);
  hctx.fillStyle = 'rgb(150,150,150)'; hctx.fillRect(0, 0, SIZE, SIZE);

  for (let b = 0; b < boards; b++) {
    const x = b * boardW;
    const jitter = (rnd() - 0.5) * 8;
    cctx.fillStyle = shade(rgb, jitter);
    cctx.fillRect(x, 0, boardW - battenW, SIZE);
    hctx.fillStyle = `rgb(${150 + jitter},${150 + jitter},${150 + jitter})`;
    hctx.fillRect(x, 0, boardW - battenW, SIZE);

    // raised batten strip
    cctx.fillStyle = shade(rgb, 16);
    cctx.fillRect(x + boardW - battenW, 0, battenW, SIZE);
    hctx.fillStyle = 'rgb(225,225,225)';
    hctx.fillRect(x + boardW - battenW, 0, battenW, SIZE);
    cctx.fillStyle = shade(rgb, -26);
    cctx.fillRect(x + boardW - battenW - 2, 0, 2, SIZE);
    hctx.fillStyle = 'rgb(60,60,60)';
    hctx.fillRect(x + boardW - battenW - 2, 0, 2, SIZE);
  }

  // 6 boards at 12 inches (305 mm) on centre.
  const repeat = perMetre(6 * 0.305);
  return {
    map: toTexture(color, true, repeat),
    normalMap: toTexture(heightToNormalMap(heightC, 2.4), false, repeat),
    roughnessMap: null,
    repeat,
  };
}

function shake(colorHex) {
  const rgb = hexToRgb(colorHex);
  const rows = 10;
  const rowH = SIZE / rows;
  // A whole number of shakes per tile, or the tile seams show.
  const pieceW = SIZE / 11;

  const color = canvas(); const cctx = color.getContext('2d');
  const heightC = canvas(); const hctx = heightC.getContext('2d');
  const rnd = seededRandom(99);

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const offset = (r % 2) * pieceW * 0.5;
    for (let x = -pieceW; x < SIZE + pieceW; x += pieceW) {
      const px = x + offset;
      const jitter = (rnd() - 0.5) * 26;
      cctx.fillStyle = shade(rgb, jitter);
      cctx.fillRect(px + 1, y, pieceW - 2, rowH - 2);
      hctx.fillStyle = `rgb(${150 + jitter},${150 + jitter},${150 + jitter})`;
      hctx.fillRect(px + 1, y, pieceW - 2, rowH - 2);
    }
    cctx.fillStyle = shade(rgb, -38);
    cctx.fillRect(0, y + rowH - 2, SIZE, 2);
    hctx.fillStyle = 'rgb(30,30,30)';
    hctx.fillRect(0, y + rowH - 2, SIZE, 2);
  }
  cctx.globalAlpha = 0.08;
  for (let i = 0; i < 3000; i++) {
    cctx.fillStyle = rnd() > 0.5 ? '#fff' : '#000';
    cctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1 + rnd() * 2, 1);
  }
  cctx.globalAlpha = 1;

  // 10 courses at a 7-inch exposure.
  const repeat = perMetre(10 * 0.178);
  return {
    map: toTexture(color, true, repeat),
    normalMap: toTexture(heightToNormalMap(heightC, 2.0), false, repeat),
    roughnessMap: null,
    repeat,
  };
}

const SIDING_BUILDERS = { lap: lapSiding, boardbatten: boardBatten, shake };

export function getSidingTexture(optionId, colorHex, pattern) {
  const key = `siding:${optionId}`;
  if (!cache.has(key)) cache.set(key, (SIDING_BUILDERS[pattern] || lapSiding)(colorHex));
  return cache.get(key);
}

// --- Roofing ------------------------------------------------------------

// Architectural (laminated) shingles: courses of tabs in random widths,
// each with its own granule shade and a dark shadow band along its lower
// edge where the next course laps over — the look that reads as "roof"
// rather than as a grid of identical rectangles. Tile: 10 courses at a
// 5.6-inch (143 mm) exposure.
function shingleRoof(colorHex) {
  const rgb = hexToRgb(colorHex);
  const courses = 10;
  const courseH = SIZE / courses;

  const color = canvas(); const cctx = color.getContext('2d');
  const heightC = canvas(); const hctx = heightC.getContext('2d');
  const rough = canvas(); const rctx = rough.getContext('2d');
  const rnd = seededRandom(707);

  cctx.fillStyle = shade(rgb, -22); cctx.fillRect(0, 0, SIZE, SIZE);
  hctx.fillStyle = 'rgb(60,60,60)'; hctx.fillRect(0, 0, SIZE, SIZE);
  rctx.fillStyle = 'rgb(200,200,200)'; rctx.fillRect(0, 0, SIZE, SIZE);

  for (let c = 0; c < courses; c++) {
    const y = c * courseH;
    // Tabs of 0.6–1.5x a nominal width, filling the tile exactly so it wraps.
    const widths = [];
    let total = 0;
    while (total < SIZE) { const w = SIZE / 7 * (0.6 + rnd() * 0.9); widths.push(w); total += w; }
    const k = SIZE / total;
    let x = rnd() * SIZE;
    widths.forEach((w0) => {
      const w = w0 * k;
      const jitter = (rnd() - 0.5) * 30;
      const draw = (ox) => {
        cctx.fillStyle = shade(rgb, jitter); cctx.fillRect(x + ox + 1, y, w - 2, courseH);
        // Shadow band: the laminated lower layer showing beneath the tab.
        cctx.fillStyle = shade(rgb, jitter - 28); cctx.fillRect(x + ox + 1, y + courseH * 0.68, w - 2, courseH * 0.32);
        hctx.fillStyle = `rgb(${150 + jitter},${150 + jitter},${150 + jitter})`; hctx.fillRect(x + ox + 1, y, w - 2, courseH * 0.7);
        hctx.fillStyle = `rgb(${110 + jitter},${110 + jitter},${110 + jitter})`; hctx.fillRect(x + ox + 1, y + courseH * 0.7, w - 2, courseH * 0.3);
        rctx.fillStyle = `rgb(${195 + jitter},${195 + jitter},${195 + jitter})`; rctx.fillRect(x + ox + 1, y, w - 2, courseH);
      };
      draw(0); if (x + w > SIZE) draw(-SIZE);
      x = (x + w) % SIZE;
    });
    // The butt edge of the course above casts a hard line.
    cctx.fillStyle = shade(rgb, -48); cctx.fillRect(0, y, SIZE, 2);
    hctx.fillStyle = 'rgb(20,20,20)'; hctx.fillRect(0, y, SIZE, 2);
  }
  // Granules: shingles are never a flat colour.
  for (let i = 0; i < SIZE * 24; i++) {
    const v = rnd();
    cctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
    cctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1, 1);
    rctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    rctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1, 1);
  }

  const repeat = perMetre(courses * 0.143);
  return {
    map: toTexture(color, true, repeat),
    normalMap: toTexture(heightToNormalMap(heightC, 2.2), false, repeat),
    roughnessMap: toTexture(rough, false, repeat),
    repeat,
  };
}

// Standing-seam metal: flat pans between raised seams, running down the
// slope — perpendicular to the shingle courses above, which run along it.
function metalRoof(colorHex) {
  const rgb = hexToRgb(colorHex);
  const pans = 8;
  const panW = SIZE / pans;
  const color = canvas(); const cctx = color.getContext('2d');
  const heightC = canvas(); const hctx = heightC.getContext('2d');
  const rough = canvas(); const rctx = rough.getContext('2d');
  cctx.fillStyle = shade(rgb, 6); cctx.fillRect(0, 0, SIZE, SIZE);
  hctx.fillStyle = 'rgb(120,120,120)'; hctx.fillRect(0, 0, SIZE, SIZE);
  rctx.fillStyle = 'rgb(105,105,105)'; rctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < pans; i++) {
    const x = i * panW;
    // A faint stiffening rib down the middle of each pan, then the seam.
    hctx.fillStyle = 'rgb(132,132,132)'; hctx.fillRect(x + panW * 0.5 - 1, 0, 2, SIZE);
    const g = cctx.createLinearGradient(x, 0, x + 8, 0);
    g.addColorStop(0, shade(rgb, 30)); g.addColorStop(1, shade(rgb, -12));
    cctx.fillStyle = g; cctx.fillRect(x, 0, 8, SIZE);
    hctx.fillStyle = 'rgb(235,235,235)'; hctx.fillRect(x + 1, 0, 5, SIZE);
    hctx.fillStyle = 'rgb(60,60,60)'; hctx.fillRect(x + 6, 0, 2, SIZE);
    rctx.fillStyle = 'rgb(80,80,80)'; rctx.fillRect(x, 0, 8, SIZE);
  }
  // 8 pans at 16 inches (406 mm).
  const repeat = perMetre(pans * 0.406);
  return {
    map: toTexture(color, true, repeat),
    normalMap: toTexture(heightToNormalMap(heightC, 2.4), false, repeat),
    roughnessMap: toTexture(rough, false, repeat),
    repeat,
  };
}

export function getRoofingTexture(optionId, colorHex, type = 'shingle') {
  const key = `roof:${type}:${optionId}`;
  if (!cache.has(key)) cache.set(key, type === 'metal' ? metalRoof(colorHex) : shingleRoof(colorHex));
  return cache.get(key);
}

// --- Trim (near-flat, painted composite — subtle grain only) -----------

function trimTexture(colorHex) {
  const rgb = hexToRgb(colorHex);
  const color = canvas(128); const cctx = color.getContext('2d');
  const heightC = canvas(128); const hctx = heightC.getContext('2d');
  const rnd = seededRandom(55);
  cctx.fillStyle = shade(rgb, 0); cctx.fillRect(0, 0, 128, 128);
  hctx.fillStyle = 'rgb(150,150,150)'; hctx.fillRect(0, 0, 128, 128);
  cctx.globalAlpha = 0.04;
  for (let i = 0; i < 400; i++) {
    cctx.fillStyle = rnd() > 0.5 ? '#fff' : '#000';
    cctx.fillRect(rnd() * 128, rnd() * 128, 1, 1 + rnd() * 3);
  }
  cctx.globalAlpha = 1;
  const repeat = { x: 2, y: 2 };
  return {
    map: toTexture(color, true, repeat),
    normalMap: toTexture(heightToNormalMap(heightC, 0.6), false, repeat),
    roughnessMap: null,
    repeat,
  };
}

export function getTrimTexture(optionId, colorHex) {
  const key = `trim:${optionId}`;
  if (!cache.has(key)) cache.set(key, trimTexture(colorHex));
  return cache.get(key);
}

// --- Ground / hardscape ---------------------------------------------------

function grassTexture() {
  const color = canvas(); const cctx = color.getContext('2d');
  const rough = canvas(); const rctx = rough.getContext('2d');
  const rnd = seededRandom(2024);
  const base = { r: 90, g: 112, b: 68 };
  cctx.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
  cctx.fillRect(0, 0, SIZE, SIZE);
  rctx.fillStyle = 'rgb(235,235,235)';
  rctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 14000; i++) {
    const jitter = (rnd() - 0.5) * 50;
    cctx.fillStyle = shade(base, jitter);
    const x = rnd() * SIZE, y = rnd() * SIZE;
    const len = 3 + rnd() * 5;
    cctx.fillRect(x, y, 1, len);
  }
  return { map: toTexture(color, true), roughnessMap: toTexture(rough), repeat: { x: 40, y: 40 } };
}

// Concrete in three finishes, any colour. Control joints in every finish;
// broom gets fine parallel striations, exposed aggregate a dense field of
// stones, stamped slate irregular flagstones with grout lines.
function concreteTexture(finish = 'broom', colorHex = '#b9b6ad') {
  const rgb = hexToRgb(colorHex);
  const color = canvas(); const cctx = color.getContext('2d');
  const heightC = canvas(); const hctx = heightC.getContext('2d');
  const rough = canvas(); const rctx = rough.getContext('2d');
  const rnd = seededRandom(finish === 'stamped' ? 311 : finish === 'aggregate' ? 211 : 88);
  cctx.fillStyle = shade(rgb, 0); cctx.fillRect(0, 0, SIZE, SIZE);
  hctx.fillStyle = 'rgb(150,150,150)'; hctx.fillRect(0, 0, SIZE, SIZE);
  rctx.fillStyle = 'rgb(232,232,232)'; rctx.fillRect(0, 0, SIZE, SIZE);

  if (finish === 'aggregate') {
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE, r = 1 + rnd() * 2.6;
      const j = (rnd() - 0.5) * 70;
      cctx.fillStyle = shade({ r: rgb.r * 0.9 + 20, g: rgb.g * 0.88 + 16, b: rgb.b * 0.85 + 10 }, j);
      cctx.beginPath(); cctx.arc(x, y, r, 0, Math.PI * 2); cctx.fill();
      hctx.fillStyle = `rgb(${190 + j / 2},${190 + j / 2},${190 + j / 2})`;
      hctx.beginPath(); hctx.arc(x, y, r, 0, Math.PI * 2); hctx.fill();
      rctx.fillStyle = 'rgb(170,170,170)';
      rctx.beginPath(); rctx.arc(x, y, r, 0, Math.PI * 2); rctx.fill();
    }
  } else if (finish === 'stamped') {
    // Irregular flagstones: a jittered grid of quads, each its own shade.
    const n = 5, cell = SIZE / n;
    const pt = [];
    for (let i = 0; i <= n; i++) {
      pt.push([]);
      for (let j = 0; j <= n; j++) {
        const edge = i === 0 || j === 0 || i === n || j === n;
        pt[i].push([i * cell + (edge ? 0 : (rnd() - 0.5) * cell * 0.45), j * cell + (edge ? 0 : (rnd() - 0.5) * cell * 0.45)]);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const q = [pt[i][j], pt[i + 1][j], pt[i + 1][j + 1], pt[i][j + 1]];
      const jit = (rnd() - 0.5) * 34;
      const path = () => { const p = new Path2D(); q.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
      cctx.fillStyle = shade(rgb, jit); cctx.fill(path());
      hctx.fillStyle = `rgb(${165 + jit / 2},${165 + jit / 2},${165 + jit / 2})`; hctx.fill(path());
      cctx.strokeStyle = shade(rgb, -55); cctx.lineWidth = 5; cctx.stroke(path());
      hctx.strokeStyle = 'rgb(40,40,40)'; hctx.lineWidth = 6; hctx.stroke(path());
    }
  } else {
    for (let y = 0; y < SIZE; y += 2) {
      const j = (rnd() - 0.5) * 30;
      hctx.fillStyle = `rgb(${150 + j},${150 + j},${150 + j})`;
      hctx.fillRect(0, y, SIZE, 1);
    }
  }
  cctx.globalAlpha = 0.06;
  for (let i = 0; i < 6000; i++) {
    cctx.fillStyle = rnd() > 0.5 ? '#fff' : '#000';
    cctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1, 1);
  }
  cctx.globalAlpha = 1;
  if (finish !== 'stamped') {
    cctx.strokeStyle = 'rgba(0,0,0,0.25)'; cctx.lineWidth = 3;
    hctx.strokeStyle = 'rgba(30,30,30,1)'; hctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) {
      const x = (SIZE / 4) * i;
      cctx.beginPath(); cctx.moveTo(x, 0); cctx.lineTo(x, SIZE); cctx.stroke();
      hctx.beginPath(); hctx.moveTo(x, 0); hctx.lineTo(x, SIZE); hctx.stroke();
    }
  }
  return {
    map: toTexture(color, true),
    normalMap: toTexture(heightToNormalMap(heightC, finish === 'broom' ? 0.9 : 1.6)),
    roughnessMap: toTexture(rough),
    repeat: { x: 3, y: 8 },
  };
}

// Wood-look garage door: long vertical grain, for the walnut option.
function woodGrain(colorHex) {
  const rgb = hexToRgb(colorHex);
  const color = canvas(256); const cctx = color.getContext('2d');
  const rnd = seededRandom(4242);
  cctx.fillStyle = shade(rgb, 0); cctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 256, w = 1 + rnd() * 3, j = (rnd() - 0.5) * 36;
    cctx.fillStyle = shade(rgb, j); cctx.globalAlpha = 0.5;
    cctx.fillRect(x, 0, w, 256);
  }
  cctx.globalAlpha = 1;
  return { map: toTexture(color, true, { x: 2, y: 1 }) };
}

export function getConcreteFinish(finish, colorHex) {
  const key = `concrete:${finish}:${colorHex}`;
  if (!cache.has(key)) cache.set(key, concreteTexture(finish, colorHex));
  return cache.get(key);
}

export function getWoodGrain(colorHex) {
  const key = `wood:${colorHex}`;
  if (!cache.has(key)) cache.set(key, woodGrain(colorHex));
  return cache.get(key);
}

let groundCache = null;
export function getGrassTexture() { return groundCache || (groundCache = grassTexture()); }

export function applyRepeat(tex, repeat) {
  if (!tex || !repeat) return;
  tex.repeat.set(repeat.x, repeat.y);
}
