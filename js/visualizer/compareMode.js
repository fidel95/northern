// Before/After split-screen comparison. Renders the SAME house twice per
// frame — once with the stock/default configuration, once with the
// customer's current selections — and uses the WebGL scissor rect (not a
// second canvas or render target) to write each half to its own strip of
// the same framebuffer. Viewport stays fixed to the full canvas across both
// passes so the camera's perspective math is untouched; only which pixels
// get written changes. This is the standard three.js technique for a
// draggable comparison slider and avoids the cost/fragility of a second
// renderer or render-to-texture pass.

import * as THREE from 'three';
import { HouseMaterialController } from './materials.js';
import { DEFAULT_SELECTIONS } from './config.js';

// Builds the "before" house as a clone of the just-loaded (not yet
// material-customized) gltf scene, leveled the same way as the "after"
// house. Call this once per house load, right after the "after" group is
// leveled — cloning before either controller has run means both groups
// still share the GLB's original MAT_*-named materials at clone time, so
// each controller's own name-based matching works independently on its own
// group without touching the other's meshes.
export function buildBeforeHouse(afterGroup, scene) {
  const beforeGroup = afterGroup.clone(true);
  beforeGroup.name = 'HouseBefore';
  beforeGroup.position.copy(afterGroup.position);
  scene.add(beforeGroup);

  const controller = new HouseMaterialController(beforeGroup);
  controller.apply(DEFAULT_SELECTIONS);
  beforeGroup.visible = false;

  return { beforeGroup, controller };
}

export function disposeBeforeHouse(scene, beforeGroup, controller, disposeObject3D) {
  if (!beforeGroup) return;
  scene.remove(beforeGroup);
  if (controller) controller.dispose();
  disposeObject3D(beforeGroup);
}

// fraction: portion of the canvas width (0..1, left to right) showing the
// "before" house. Everything right of that boundary shows "after".
export function renderCompareSplit(renderer, scene, camera, beforeGroup, afterGroup, fraction, width, height) {
  if (!width || !height) return;
  const splitX = Math.round(THREE.MathUtils.clamp(fraction, 0, 1) * width);

  renderer.setViewport(0, 0, width, height);
  renderer.setScissorTest(true);

  afterGroup.visible = false;
  beforeGroup.visible = true;
  renderer.setScissor(0, 0, splitX, height);
  renderer.render(scene, camera);

  beforeGroup.visible = false;
  afterGroup.visible = true;
  renderer.setScissor(splitX, 0, width - splitX, height);
  renderer.render(scene, camera);

  renderer.setScissorTest(false);
}
