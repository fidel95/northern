// Renderer/scene bootstrap, resize handling, and a render loop that stops
// entirely when the tab is hidden (section 14 — no wasted GPU/battery on a
// backgrounded tab) and is capped to a sane device pixel ratio.

import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    // Needed for the Snapshot feature (screenshot.js reads the canvas back
    // via toDataURL) — the small always-on memory cost is worth not having
    // to choreograph a read on the exact frame after render.
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  return scene;
}

export function fitRendererToContainer(renderer, camera, container) {
  const { clientWidth: w, clientHeight: h } = container;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// Caller decides *when* the loop should run (e.g. main.js stops it while in
// Photo mode, where there's no 3D scene to draw) — this just guarantees it
// never runs while the tab is hidden, regardless of what the caller wants,
// and resumes on the caller's terms (not automatically) when the tab comes
// back so a backgrounded Photo-mode tab doesn't wake the 3D loop.
export function createRenderLoop(tick) {
  let rafId = null;
  let wanted = false;
  const frame = (t) => {
    rafId = requestAnimationFrame(frame);
    tick(t);
  };
  const start = () => {
    wanted = true;
    if (rafId === null && !document.hidden) rafId = requestAnimationFrame(frame);
  };
  const stop = () => {
    wanted = false;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (wanted && rafId === null) {
      rafId = requestAnimationFrame(frame);
    }
  });

  return { start, stop };
}

// A lost WebGL context (most commonly a mobile GPU running out of texture
// memory) leaves the canvas permanently black — every future draw call is
// silently a no-op, so material changes look like they "do nothing." Full
// in-place context recovery is fragile (every texture/shader needs
// re-uploading, including the baked PMREM environment), so rather than fake
// a recovery that might half-work, this just surfaces it so the caller can
// show a clear "reload" message instead of a silent dead canvas.
export function watchContextLoss(canvas, onLost) {
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    onLost();
  });
}

export function disposeObject3D(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach((k) => m[k] && m[k].dispose());
        m.dispose();
      });
    }
  });
}
