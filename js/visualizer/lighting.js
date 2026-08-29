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
  // Tone mapping / shadow renderer flags and the two basic lights go first,
  // unconditionally, before anything that could fail — a mobile report
  // showed the house rendering as a pure black silhouette against a
  // correctly-lit sky, which only makes sense if scene lighting ended up at
  // effectively zero while the self-lit Sky shader (unaffected by scene
  // lights) kept working fine. Whatever WebGL feature was behind that on
  // that specific device, the fix is to make basic illumination not depend
  // on it: AmbientLight has no dependency on shadow maps, environment maps,
  // or render-to-texture support — it is about as close to "always works on
  // any WebGL implementation" as three.js lighting gets — so the worst case
  // is now flatly lit, not solid black.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SUN_PARAMS.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const sky = new Sky();
  sky.scale.setScalar(20000);
  const sunDir = configureSky(sky, SUN_PARAMS);
  scene.add(sky);

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

  // The environment map is the fanciest, most failure-prone piece here
  // (render-to-texture + mip generation) — a device that can't do it should
  // just keep the ambient/directional/hemisphere lighting above rather than
  // losing lighting entirely.
  let pmrem = null;
  let envRT = null;
  try {
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(20000);
    configureSky(envSky, SUN_PARAMS);
    envScene.add(envSky);

    pmrem = new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromScene(envScene, 0.035);
    scene.environment = envRT.texture;
    // The raw sky shader is HDR-bright near the sun disc — without this the
    // baked environment map alone overexposes every PBR surface in the
    // scene before the directional "sun" light above even factors in.
    scene.environmentIntensity = 0.55;
    envSky.geometry.dispose();
    envSky.material.dispose();
  } catch (err) {
    console.warn('[visualizer] environment map generation failed, continuing with direct lighting only:', err);
  }

  return {
    sky, sunLight, fill, ambient,
    dispose() {
      if (pmrem) pmrem.dispose();
      if (envRT) envRT.texture.dispose();
    },
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
