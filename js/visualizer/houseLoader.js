// Loads a house GLB with optional Draco/KTX2 support wired up (both are
// no-ops if the file doesn't use those extensions, so this works unchanged
// against the uncompressed placeholder and a compressed production asset).

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// three and its decoders are vendored under /js/vendor/three (see
// tools/vendor-three.mjs) rather than pulled from a CDN at runtime: the
// visualizer is the reason most people come to this site, and it should not
// stop working because a third party is having a bad day. The version is
// pinned there, so it is deliberately not restated here.
const DRACO_PATH = '/js/vendor/three/examples/jsm/libs/draco/';
const BASIS_PATH = '/js/vendor/three/examples/jsm/libs/basis/';

let sharedDraco = null;
function getDracoLoader() {
  if (!sharedDraco) {
    sharedDraco = new DRACOLoader();
    sharedDraco.setDecoderPath(DRACO_PATH);
  }
  return sharedDraco;
}

// One KTX2 loader for the page: each instance spins up its own transcoder
// worker, so making a new one on every house switch leaked workers.
let sharedKtx2 = null;
function getKtx2Loader(renderer) {
  if (!sharedKtx2) {
    sharedKtx2 = new KTX2Loader();
    sharedKtx2.setTranscoderPath(BASIS_PATH);
    sharedKtx2.detectSupport(renderer);
  }
  return sharedKtx2;
}

export function loadHouse(url, renderer, onProgress) {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDracoLoader());
  loader.setKTX2Loader(getKtx2Loader(renderer));

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf),
      (evt) => {
        if (onProgress) onProgress(evt.lengthComputable ? evt.loaded / evt.total : null);
      },
      (err) => reject(err),
    );
  });
}

/**
 * Folds every mesh in a loaded house into one mesh per material, keeping the
 * material (and so its MAT_* name, which everything else keys on).
 *
 * The generated houses are hundreds of small boxes, each its own draw call;
 * merged, a house is about a dozen. Meshes whose material is in `keep` stay
 * as they are: window and door glass, because materials.js measures each
 * pane separately to place its grille bars.
 */
export function mergeHouseMeshes(root, keep = []) {
  root.updateMatrixWorld(true);
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMaterial = new Map();
  const toRemove = [];
  // The loader shares one unit-cube geometry across many boxes, including
  // the glass we keep, so never dispose a geometry a kept mesh still uses.
  const kept = new Set();
  root.traverse((obj) => {
    if (!obj.isMesh || Array.isArray(obj.material)) return;
    const name = obj.material && obj.material.name;
    if (!name || keep.includes(name)) { kept.add(obj.geometry); return; }
    const geo = obj.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseRoot, obj.matrixWorld));
    // Only the attributes every part shares, so mergeGeometries accepts them.
    Object.keys(geo.attributes).forEach((k) => { if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k); });
    if (!byMaterial.has(name)) byMaterial.set(name, { material: obj.material, geos: [] });
    byMaterial.get(name).geos.push(geo);
    toRemove.push(obj);
  });
  toRemove.forEach((obj) => {
    if (!kept.has(obj.geometry)) obj.geometry.dispose();
    obj.parent.remove(obj);
  });
  byMaterial.forEach(({ material, geos }, name) => {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `Merged_${name}`;
    root.add(mesh);
  });
}
