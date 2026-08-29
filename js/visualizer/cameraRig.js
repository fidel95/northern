// Constrained OrbitControls: rotate freely around the house and zoom within
// sane bounds, but no flipping upside down, no diving through the ground,
// no walking inside the house, and no panning off into empty space. Panning
// is disabled entirely and the target stays pinned near the house so the
// worst the customer can do is end up at a slightly odd angle — never a
// broken one.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCameraRig(canvas) {
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 24;
  controls.minPolarAngle = THREE.MathUtils.degToRad(38);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(86);
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
