// Constrained OrbitControls: rotate freely around the house and zoom within
// sane bounds, but no flipping upside down, no diving through the ground,
// no walking inside the house, and no panning off into empty space. Panning
// is disabled entirely and the target stays pinned near the house so the
// worst the customer can do is end up at a slightly odd angle — never a
// broken one.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCameraRig(canvas) {
  // Scene content only ever lives within ~30m of the origin (minDistance
  // 10 / maxDistance 24 below, plus the house's own extent) — a near/far of
  // 0.1/500 gives the depth buffer a 5000:1 range to cover, which starves
  // precision at the distances that matter and shows up as z-fighting
  // (flickering) between close-together surfaces like the foundation/wall
  // seam. 0.5/60 keeps precision where the camera actually is.
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  // Roof overhang extends further from the target than the walls do, so a
  // simple spherical minDistance around the target can still let the camera
  // graze right up against the eave/fascia at close range + a shallow
  // (near-horizontal) angle — that combination produced an unusably close,
  // grazing shot of the roof edge during testing. 10m + a shallower max
  // polar angle keeps that combination out of reach.
  controls.minDistance = 10;
  controls.maxDistance = 24;
  // minPolarAngle keeps the camera from tilting into a near-top-down view —
  // the placeholder's roof is a handful of overlapping thin boxes that only
  // reads correctly from a normal elevation-ish angle; steep-down angles
  // expose the gaps between those pieces (visible seams, not a real house
  // roof surface). 55° keeps every reachable angle looking like an actual
  // photo angle a customer would take.
  controls.minPolarAngle = THREE.MathUtils.degToRad(55);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(78);
  controls.target.set(0, 1.5, 0);

  let defaultPos = new THREE.Vector3(6, 3.4, 13);
  let defaultTarget = new THREE.Vector3(0, 1.5, 0);

  function setDefaultView(distance, height, targetY = 1.5) {
    defaultTarget.set(0, targetY, 0);
    const angle = THREE.MathUtils.degToRad(26);
    defaultPos.set(Math.sin(angle) * distance, height, Math.cos(angle) * distance);
    camera.position.copy(defaultPos);
    controls.target.copy(defaultTarget);
    controls.update();
  }

  function resetView() {
    camera.position.copy(defaultPos);
    controls.target.copy(defaultTarget);
    controls.update();
  }

  function resize(width, height) {
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return { camera, controls, setDefaultView, resetView, resize };
}
