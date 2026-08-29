// A procedural physical sky (three/addons Sky.js — the same Preetham model
// used by three.js's own examples) stands in for an HDRI file: it's baked
// into a PMREM environment map for image-based lighting/reflections, and a
// matching directional "sun" light casts the shadows. This gives real
// image-based lighting with zero binary assets to host, and can be swapped
// for a photographed HDRI later (RGBELoader is already wired for that — see
// loadHDRIEnvironment below) without touching any other module.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const SUN_PARAMS = {
  turbidity: 3.2,
  rayleigh: 1.15,
  mieCoefficient: 0.0035,
  mieDirectionalG: 0.82,
  elevation: 44,
  // Chosen so the sun lights the front-right of the house (the side the
  // default camera looks at) rather than backlighting it — azimuth is
  // measured the same way the camera's default angle is, see cameraRig.js.
  azimuth: 55,
  exposure: 0.95,
};

function configureSky(sky, params) {
  const u = sky.material.uniforms;
  u.turbidity.value = params.turbidity;
  u.rayleigh.value = params.rayleigh;
  u.mieCoefficient.value = params.mieCoefficient;
  u.mieDirectionalG.value = params.mieDirectionalG;
  const phi = THREE.MathUtils.degToRad(90 - params.elevation);
  const theta = THREE.MathUtils.degToRad(params.azimuth);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(sunDir);
  return sunDir;
}

export function createLighting(renderer, scene) {
  const sky = new Sky();
  sky.scale.setScalar(20000);
  const sunDir = configureSky(sky, SUN_PARAMS);
  scene.add(sky);

  // Separate, unparented sky instance used only to bake the environment map —
  // PMREMGenerator wants its own Scene, and an Object3D can't have two parents.
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(20000);
  configureSky(envSky, SUN_PARAMS);
  envScene.add(envSky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0.035);
  scene.environment = envRT.texture;
  // The raw sky shader is HDR-bright near the sun disc — without this the
  // baked environment map alone overexposes every PBR surface in the scene
  // before the directional "sun" light below even factors in.
  scene.environmentIntensity = 0.55;
  envSky.geometry.dispose();
  envSky.material.dispose();

  const sunLight = new THREE.DirectionalLight(0xfff2df, 1.6);
  sunLight.position.copy(sunDir).multiplyScalar(40);
  sunLight.target.position.set(0, 1, 0);
  sunLight.castShadow = true;
  // 1024 rather than 2048 — PCFSoftShadowMap already softens the edges, and
  // a smaller shadow map matters more on phone GPUs than the extra crispness
  // does at this scene scale.
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -14;
  sunLight.shadow.camera.right = 14;
  sunLight.shadow.camera.top = 14;
  sunLight.shadow.camera.bottom = -14;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 90;
  sunLight.shadow.bias = -0.0003;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight, sunLight.target);

  const fill = new THREE.HemisphereLight(0xcfe0e8, 0x4a4638, 0.3);
  scene.add(fill);

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SUN_PARAMS.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return {
    sky, sunLight, fill,
    dispose() { pmrem.dispose(); envRT.texture.dispose(); },
  };
}

// Optional upgrade path: a photographed HDRI (e.g. a CC0 file from Poly
// Haven) instead of the procedural sky. Not wired into main.js by default —
// call this and set scene.environment/scene.background yourself if/when a
// real HDRI file is added under /visualizer/environments/.
export async function loadHDRIEnvironment(renderer, url) {
  const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdr = await new RGBELoader().loadAsync(url);
  const envRT = pmrem.fromEquirectangular(hdr);
  hdr.dispose();
  pmrem.dispose();
  return envRT.texture;
}
