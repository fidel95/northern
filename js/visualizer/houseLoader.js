// Loads a house GLB with optional Draco/KTX2 support wired up (both are
// no-ops if the file doesn't use those extensions, so this works unchanged
// against the uncompressed placeholder and a compressed production asset).

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

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

export function loadHouse(url, renderer, onProgress) {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDracoLoader());

  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(BASIS_PATH);
  ktx2.detectSupport(renderer);
  loader.setKTX2Loader(ktx2);

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
