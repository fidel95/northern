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

export function createLighting(renderer, scene, { shadows = true, shadowMapSize = 1024 } = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SUN_PARAMS.exposure;
  // Shadows are the single most expensive thing this scene does (a whole
  // extra depth-only render pass every frame) — low-tier devices skip them
  // entirely via performance.js's tiering rather than just shrinking the map.
  renderer.shadowMap.enabled = shadows;
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

  // A soft, sky-tinted fog well beyond the house does two things cheaply:
  // adds atmospheric depth so the house reads as sitting IN a scene rather
  // than pasted onto a flat backdrop, and hides the edge of the ground
  // plane's 50m-radius circle against the sky. The band has to clear the
  // house at one end and finish before the camera's 60m far plane at the
  // other: the furthest a house corner ever gets is ~37m (the colonial's
  // 30m maxDistance plus its own extent), and full fog by 58m means the far
  // plane clips only pixels that are already 100% sky-coloured.
  scene.fog = new THREE.Fog(0xcbdce6, 38, 58);

  const sunLight = new THREE.DirectionalLight(0xfff2df, 2.0);
  sunLight.position.copy(sunDir).multiplyScalar(40);
  sunLight.target.position.set(0, 1, 0);
  sunLight.castShadow = shadows;
  // 1024 (or performance.js's smaller tiers) rather than 2048 — PCFSoftShadowMap
  // already softens the edges, and a smaller shadow map matters more on phone
  // GPUs than the extra crispness does at this scene scale.
  sunLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
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

// --- Image-based lighting -------------------------------------------------
//
// Turns the HDRI in visualizer/environments/ into a prefiltered environment
// map for scene.environment — the reflections in glass and door hardware.
// The visible sky stays the procedural Sky above; this only ever affects what
// surfaces reflect.
//
// The header comment on this file records why PMREM was ripped out: on an
// Apple GPU without half-float linear filtering it produced a silently
// NaN-contaminated environment texture, with no thrown error, that turned the
// whole house solid black. Re-enabling it therefore means never trusting that
// it worked. Everything below is built around one rule — the environment map
// is applied only after its own output pixels have been read back and checked,
// and any failure at any stage leaves scene.environment null and the scene
// exactly as it looked without this file.

function halfToFloat(h) {
  const sign = (h & 0x8000) ? -1 : 1;
  const exponent = (h & 0x7C00) >> 10;
  const fraction = h & 0x03FF;
  if (exponent === 0) return sign * (2 ** -14) * (fraction / 1024);
  if (exponent === 0x1F) return fraction ? NaN : sign * Infinity;
  return sign * (2 ** (exponent - 15)) * (1 + fraction / 1024);
}

// How bright the environment map is allowed to be, as scene.environmentIntensity.
//
// This needs scaling because the sun/ambient/hemisphere rig above was tuned to
// be a COMPLETE lighting solution for a scene with no environment map — the
// ambient light is standing in for the sky's diffuse contribution. Switching a
// real sky on at full strength therefore doesn't tint the house, it relights
// it: the sandstone siding washes to white and every bit of shadow contrast
// the direct lighting was tuned for disappears. The environment map is here to
// put a reflection in the glass, not to light the walls.
//
// Rather than hard-code the one number that happens to suit the file we ship,
// scale by the HDRI's own measured brightness, so swapping the file for a
// brighter or darker capture lands in roughly the same place. TARGET is
// expressed in the same units as the measurement, and is what puts the
// bundled sky at ~0.15. The clamp is the backstop: no HDRI, however oddly
// exposed, is allowed to take over the lighting.
const TARGET_MEAN_RADIANCE = 0.049;
const MIN_ENV_INTENSITY = 0.02;
const MAX_ENV_INTENSITY = 0.30;

// The specific corruption seen on the failing device was NaN/Infinity, which
// poisons every lit pixel it touches. Negative radiance and absurdly large
// values are checked too — they're equally impossible for a real sky and
// equally capable of blowing out the render.
function samplesAreSane(values) {
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v) || v < -0.001 || v > 1e4) return false;
    sum += v;
  }
  // An all-black readback means the prefilter produced nothing useful; a real
  // sky is never uniformly zero.
  return sum > 0.01;
}

function pmremOutputIsUsable(renderer, renderTarget) {
  // A half-float readback is well supported on WebGL2 desktop and modern
  // mobile, but it is not universal. Treat "can't verify" the same as
  // "verified bad": the cost of skipping reflections is a scene that looks
  // like it did yesterday, and the cost of a false positive is a black house.
  const W = 8;
  const buffer = new Uint16Array(W * W * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, W, W, buffer);
  const decoded = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) decoded[i] = halfToFloat(buffer[i]);
  return samplesAreSane(decoded);
}

// Resolves to { texture, intensity } — the prefiltered environment map plus
// the scene.environmentIntensity that normalises it — or null if this device
// can't be shown to produce a good one. Never throws.
export async function loadHDRIEnvironment(renderer, url, log = () => {}) {
  let hdr = null;
  let pmrem = null;
  let envRT = null;
  try {
    const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
    hdr = await new RGBELoader().loadAsync(url);

    // Check the decoded source before handing it to the GPU, so a truncated
    // or malformed download is caught here rather than as a black house.
    const data = hdr.image && hdr.image.data;
    if (!data || !data.length) throw new Error('HDR decoded to no pixel data');
    // RGBELoader hands back RGBA; the alpha channel is a constant 1 and would
    // drag any statistic computed over it toward that value, so sample whole
    // texels and keep only the colour components.
    const texels = data.length / 4;
    const step = Math.max(1, Math.floor(texels / 4096));
    const decode = hdr.type === THREE.HalfFloatType ? halfToFloat : ((v) => v);
    const probe = [];
    for (let t = 0; t < texels; t += step) {
      const i = t * 4;
      probe.push(decode(data[i]), decode(data[i + 1]), decode(data[i + 2]));
    }
    if (!samplesAreSane(probe)) throw new Error('HDR source pixels failed sanity check');

    let mean = 0;
    for (let i = 0; i < probe.length; i++) mean += probe[i];
    mean /= probe.length;
    if (!(mean > 0)) throw new Error('HDR mean radiance is not positive');
    const intensity = Math.min(MAX_ENV_INTENSITY,
      Math.max(MIN_ENV_INTENSITY, TARGET_MEAN_RADIANCE / mean));

    pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    envRT = pmrem.fromEquirectangular(hdr);

    if (!pmremOutputIsUsable(renderer, envRT)) {
      throw new Error('prefiltered environment failed readback sanity check');
    }

    log(`HDRI environment applied — mean radiance ${mean.toFixed(3)}, intensity ${intensity.toFixed(3)}`);
    return { texture: envRT.texture, intensity };
  } catch (err) {
    log(`HDRI environment skipped: ${err && err.message ? err.message : err}`);
    if (envRT) envRT.dispose();
    return null;
  } finally {
    if (hdr) hdr.dispose();
    if (pmrem) pmrem.dispose();
  }
}
