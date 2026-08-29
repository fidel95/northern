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

const SIZE = 512;
const cache = new Map();

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

  const repeat = { x: 6, y: 8 };
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

  const repeat = { x: 5, y: 3 };
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
  const pieceW = 46;

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

  const repeat = { x: 5, y: 6 };
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

function shingleRoof(colorHex) {
  const rgb = hexToRgb(colorHex);
  const courses = 10;
  const courseH = SIZE / courses;
  const tabW = SIZE / 6;

  const color = canvas(); const cctx = color.getContext('2d');
  const heightC = canvas(); const hctx = heightC.getContext('2d');
  const rough = canvas(); const rctx = rough.getContext('2d');
  const rnd = seededRandom(707);

  cctx.fillStyle = shade(rgb, 0); cctx.fillRect(0, 0, SIZE, SIZE);
  hctx.fillStyle = 'rgb(140,140,140)'; hctx.fillRect(0, 0, SIZE, SIZE);
  rctx.fillStyle = 'rgb(190,190,190)'; rctx.fillRect(0, 0, SIZE, SIZE);

  for (let c = 0; c < courses; c++) {
    const y = c * courseH;
    const offset = (c % 2) * tabW * 0.5;
    cctx.fillStyle = shade(rgb, -14);
    cctx.fillRect(0, y + courseH - 3, SIZE, 3);
    hctx.fillStyle = 'rgb(30,30,30)';
    hctx.fillRect(0, y + courseH - 3, SIZE, 3);
    for (let x = -tabW; x < SIZE + tabW; x += tabW) {
      const px = x + offset;
      const jitter = (rnd() - 0.5) * 22;
      cctx.fillStyle = shade(rgb, jitter);
      cctx.fillRect(px + 1, y, tabW - 2, courseH - 3);
      hctx.fillStyle = `rgb(${150 + jitter},${150 + jitter},${150 + jitter})`;
      hctx.fillRect(px + 1, y, tabW - 2, courseH - 3);
      rctx.fillStyle = `rgb(${190 + jitter},${190 + jitter},${190 + jitter})`;
      rctx.fillRect(px + 1, y, tabW - 2, courseH - 3);
      cctx.fillStyle = shade(rgb, jitter - 30);
      cctx.fillRect(px + tabW - 3, y, 2, courseH - 3);
    }
  }
  // granule speckle — roofing shingles are never a flat color
  for (let i = 0; i < 9000; i++) {
    const v = rnd();
    cctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    cctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1, 1);
    rctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    rctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1, 1);
  }

  const repeat = { x: 10, y: 10 };
  return {
    map: toTexture(color, true, repeat),
    normalMap: toTexture(heightToNormalMap(heightC, 1.8), false, repeat),
    roughnessMap: toTexture(rough, false, repeat),
    repeat,
  };
}

export function getRoofingTexture(optionId, colorHex) {
  const key = `roof:${optionId}`;
  if (!cache.has(key)) cache.set(key, shingleRoof(colorHex));
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

function concreteTexture() {
  const color = canvas(); const cctx = color.getContext('2d');
  const heightC = canvas(); const hctx = heightC.getContext('2d');
  const rnd = seededRandom(88);
  cctx.fillStyle = '#b9b6ad'; cctx.fillRect(0, 0, SIZE, SIZE);
  hctx.fillStyle = 'rgb(150,150,150)'; hctx.fillRect(0, 0, SIZE, SIZE);
  cctx.globalAlpha = 0.06;
  for (let i = 0; i < 6000; i++) {
    cctx.fillStyle = rnd() > 0.5 ? '#fff' : '#000';
    cctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1, 1);
  }
  cctx.globalAlpha = 1;
  // control joints
  cctx.strokeStyle = 'rgba(0,0,0,0.25)'; cctx.lineWidth = 3;
  hctx.strokeStyle = 'rgba(30,30,30,1)'; hctx.lineWidth = 3;
  for (let i = 1; i < 4; i++) {
    const x = (SIZE / 4) * i;
    cctx.beginPath(); cctx.moveTo(x, 0); cctx.lineTo(x, SIZE); cctx.stroke();
    hctx.beginPath(); hctx.moveTo(x, 0); hctx.lineTo(x, SIZE); hctx.stroke();
  }
  return { map: toTexture(color, true), normalMap: toTexture(heightToNormalMap(heightC, 1.2)), repeat: { x: 3, y: 8 } };
}

let groundCache = null, drivewayCache = null;
export function getGrassTexture() { return groundCache || (groundCache = grassTexture()); }
export function getConcreteTexture() { return drivewayCache || (drivewayCache = concreteTexture()); }

export function applyRepeat(tex, repeat) {
  if (!tex || !repeat) return;
  tex.repeat.set(repeat.x, repeat.y);
}
