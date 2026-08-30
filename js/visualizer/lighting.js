// A procedural physical sky (three/addons Sky.js — the same Preetham model
// used by three.js's own examples) for the visible background, lit by a
// directional "sun" + hemisphere + ambient light rather than an image-based
// (PMREM) environment map. An earlier version baked the sky into a PMREM
// environment map for reflections, which is exactly the kind of
// render-to-texture + mip-chain generation that's fragile across real-world
// GPUs — confirmed via an on-device diagnostic (see diagnostics.js) showing
// a completely clean, error-free init/load sequence on an iPhone (Apple
// GPU, half-float-linear filtering unsupported) that still rendered the
// house solid black: no thrown error, just a silently NaN/Infinity-
// contaminated environment texture whose contribution corrupts every lit
// pixel's final color. Direct lights don't have that failure mode, so this
// trades a bit of subtle sky-tinted reflection quality for something that
// actually renders on the hardware real customers show up with. A
// photographed HDRI stays available as an upgrade path (RGBELoader is
// wired up below) for whenever that trade is worth revisiting.

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
  exposure: 1.02,
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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SUN_PARAMS.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Slightly higher than before now that there's no environment map adding
  // its own ambient contribution on top. Trimmed a touch further (0.65 ->
  // 0.58) for more visible shadow depth around windows/trim — the earlier
  // value read a little flat/shadowless in side-by-side comparisons.
  const ambient = new THREE.AmbientLight(0xffffff, 0.58);
  scene.add(ambient);

  const sky = new Sky();
  sky.scale.setScalar(20000);
  const sunDir = configureSky(sky, SUN_PARAMS);
  scene.add(sky);

  // A soft, sky-tinted fog well beyond the house (it's within ~15m of the
  // camera; fog only starts biting past 35m) does two things cheaply: adds
  // a little atmospheric depth so the house reads as sitting IN a scene
  // rather than pasted onto a flat backdrop, and quietly hides the visible
  // edge of the ground plane's 50m-radius circle against the sky.
  scene.fog = new THREE.Fog(0xcbdce6, 35, 85);

  const sunLight = new THREE.DirectionalLight(0xfff2df, 2.0);
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

  const fill = new THREE.HemisphereLight(0xcfe0e8, 0x4a4638, 0.4);
  scene.add(fill);

  return {
    sky, sunLight, fill, ambient,
    dispose() {},
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
