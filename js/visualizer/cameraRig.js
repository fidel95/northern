// Constrained OrbitControls: rotate freely around the house and zoom within
// sane bounds, but no flipping upside down, no diving through the ground,
// no walking inside the house, and no panning off into empty space. Panning
// is disabled entirely and the target stays pinned near the house so the
// worst the customer can do is end up at a slightly odd angle — never a
// broken one.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCameraRig(canvas) {
  // Scene content only ever lives within ~37m of the camera (the furthest
  // per-house maxDistance is the colonial's 30, plus that house's own
  // extent) — a near/far of 0.1/500 gives the depth buffer a 5000:1 range to
  // cover, which starves precision at the distances that matter and shows up
  // as z-fighting (flickering) between close-together surfaces like the
  // foundation/wall seam. 0.5/60 keeps precision where the camera actually
  // is; lighting.js's fog is tuned to fade the ground out before that far
  // plane so the clip is never visible.
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  // Replaced by frameHouse() as soon as a model finishes loading — these are
  // only what's in force during the load itself.
  controls.minDistance = 10;
  controls.maxDistance = 26;
  // minPolarAngle keeps the camera out of a straight-down view. It used to be
  // clamped to 55° because the old placeholder's roof was overlapping thin
  // boxes whose seams opened up at any steep angle; the roof slopes are now
  // mitred to meet exactly on the ridge line (generate-houses.py's
  // add_gable_roof), so the roof holds up from above and the camera can look
  // down far enough to actually read the roofing colour the customer picked.
  controls.minPolarAngle = THREE.MathUtils.degToRad(34);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
  controls.target.set(0, 1.5, 0);

  const defaultPos = new THREE.Vector3(6, 3.4, 13);
  const defaultTarget = new THREE.Vector3(0, 1.5, 0);
  let houseBox = null;

  // The three-quarter angle the default shot is taken from. The azimuth
  // matches the sun in lighting.js so the facade the customer lands on is the
  // lit one; 7 degrees of elevation is about what a person photographing a
  // house from the far side of the street gets.
  const VIEW_AZIMUTH = THREE.MathUtils.degToRad(26);
  const VIEW_ELEVATION = THREE.MathUtils.degToRad(7);
  const FRAME_MARGIN = 1.1;

  const _v = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);

  // Frames whatever model actually loaded, rather than trusting per-house
  // numbers that have to be re-tuned by hand every time a house changes size.
  // Fitting the model's real bounds is also what makes ASSET-SPEC.md's promise
  // true: an artist GLB of any size frames itself with no config change.
  //
  // The fit is exact rather than a fudge factor on the bounding sphere. For a
  // camera on a fixed viewing direction, each of the box's eight corners
  // implies a minimum dolly distance for that corner to clear the frustum;
  // the answer is the largest of the eight. A radius-based approximation is
  // what left the two-storey colonial with its ridge cropped: its bounding
  // sphere is dominated by width, but what actually ran out of frame was
  // height, on the side the downward pitch pushes upward.
  function applyFraming() {
    if (!houseBox) return;
    const size = houseBox.getSize(new THREE.Vector3());
    const center = houseBox.getCenter(new THREE.Vector3());

    // Aim slightly below the box's middle — dead centre reads as an elevation
    // drawing, a little low reads as a photograph.
    defaultTarget.set(center.x, center.y - size.y * 0.06, center.z);

    _dir.set(
      Math.sin(VIEW_AZIMUTH) * Math.cos(VIEW_ELEVATION),
      Math.sin(VIEW_ELEVATION),
      Math.cos(VIEW_AZIMUTH) * Math.cos(VIEW_ELEVATION),
    ).normalize();
    _fwd.copy(_dir).negate();
    _right.copy(_fwd).cross(WORLD_UP).normalize();
    _up.copy(_right).cross(_fwd).normalize();

    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * camera.aspect;

    let distance = 0;
    for (let i = 0; i < 8; i++) {
      _v.set(
        i & 1 ? houseBox.max.x : houseBox.min.x,
        i & 2 ? houseBox.max.y : houseBox.min.y,
        i & 4 ? houseBox.max.z : houseBox.min.z,
      ).sub(defaultTarget);
      const need = Math.max(Math.abs(_v.dot(_right)) / tanH, Math.abs(_v.dot(_up)) / tanV)
        - _v.dot(_fwd);
      if (need > distance) distance = need;
    }
    distance *= FRAME_MARGIN;

    defaultPos.copy(defaultTarget).addScaledVector(_dir, distance);
    controls.minDistance = distance * 0.5;
    controls.maxDistance = distance * 1.9;

    camera.position.copy(defaultPos);
    controls.target.copy(defaultTarget);
    controls.update();
  }

  function frameHouse(box) {
    houseBox = box.clone();
    applyFraming();
  }

  function resetView() {
    // Recomputed rather than replayed, so Reset View still frames correctly
    // after the aspect ratio has changed underneath it — entering Presentation
    // Mode is exactly that, and a stored position would come back cropped.
    if (houseBox) {
      applyFraming();
      return;
    }
    camera.position.copy(defaultPos);
    controls.target.copy(defaultTarget);
    controls.update();
  }

  function resize(width, height) {
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return { camera, controls, frameHouse, resetView, resize };
}
