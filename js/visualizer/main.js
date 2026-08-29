// Entry point: wires scene/camera/lighting/environment/house-loading/
// materials/UI/photo-mode together. Nothing else imports this file — it's
// the only module allowed to know about all the others.

import * as THREE from 'three';
import {
  createRenderer, createScene, fitRendererToContainer, createRenderLoop, disposeObject3D,
} from './sceneSetup.js';
import { createCameraRig } from './cameraRig.js';
import { createLighting } from './lighting.js';
import { buildEnvironment } from './environment.js';
import { loadHouse } from './houseLoader.js';
import { HouseMaterialController } from './materials.js';
import { houseConfigurations } from './config.js';
import { VisualizerState } from './state.js';
import { createUI } from './ui.js';
import { categoryForMaterialName } from './categories.js';
import { captureSnapshot, downloadCanvas } from './screenshot.js';
import { PhotoMode } from './photoMode.js';

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

function init() {
  const root = document.querySelector('[data-viz3d]');
  if (!root) return;

  const canvasWrap = root.querySelector('[data-viz3d-canvaswrap]');
  const fallback = root.querySelector('[data-viz3d-fallback]');

  if (!supportsWebGL()) {
    fallback.hidden = false;
    canvasWrap.hidden = true;
    return;
  }

  const canvas = root.querySelector('[data-viz3d-canvas]');
  const photoCanvas = root.querySelector('[data-viz3d-photocanvas]');
  const loadingEl = root.querySelector('[data-viz3d-loading]');
  const loadFill = root.querySelector('[data-viz3d-loadfill]');
  const loadSub = root.querySelector('[data-viz3d-loadsub]');
  const hud = root.querySelector('[data-viz3d-hud]');

  const state = new VisualizerState();

  const renderer = createRenderer(canvas);
  const scene = createScene();
  const rig = createCameraRig(canvas);
  createLighting(renderer, scene);
  scene.add(buildEnvironment());

  fitRendererToContainer(renderer, rig.camera, canvasWrap);
  const resizeObserver = new ResizeObserver(() => fitRendererToContainer(renderer, rig.camera, canvasWrap));
  resizeObserver.observe(canvasWrap);

  const loop = createRenderLoop(() => {
    rig.controls.update();
    renderer.render(scene, rig.camera);
  });

  let houseGroup = null;
  let materialController = null;
  let raycastTargets = [];

  function setLoading(pct, text) {
    loadingEl.hidden = false;
    loadingEl.classList.remove('is-error');
    const track = loadFill.parentElement;
    if (track) track.style.display = '';
    if (text) loadSub.textContent = text;
    if (pct != null) loadFill.style.width = `${Math.round(pct * 100)}%`;
  }
  function hideLoading() { loadingEl.hidden = true; }
  function showError(msg) {
    loadingEl.hidden = false;
    loadingEl.classList.add('is-error');
    loadSub.textContent = msg;
    loadFill.parentElement.style.display = 'none';
  }

  async function loadAndApplyHouse(houseId) {
    const cfg = houseConfigurations[houseId] || houseConfigurations[Object.keys(houseConfigurations)[0]];
    hud.hidden = true;
    setLoading(0, 'Preparing your home…');
    try {
      const gltf = await loadHouse(cfg.model, renderer, (p) => { if (p != null) setLoading(p, 'Preparing your home…'); });

      if (houseGroup) {
        scene.remove(houseGroup);
        if (materialController) materialController.dispose();
        disposeObject3D(houseGroup);
      }

      houseGroup = gltf.scene;
      scene.add(houseGroup);

      // Safety net from ASSET-SPEC.md §3: re-level the model onto y=0 using
      // Ground_Anchor, in case the source file isn't perfectly grounded.
      const anchor = houseGroup.getObjectByName('Ground_Anchor');
      if (anchor) {
        const world = new THREE.Vector3();
        anchor.getWorldPosition(world);
        houseGroup.position.y -= world.y;
      }

      materialController = new HouseMaterialController(houseGroup);
      materialController.apply(state.selections);

      raycastTargets = [];
      houseGroup.traverse((o) => { if (o.isMesh) raycastTargets.push(o); });

      rig.setDefaultView(cfg.cameraDistance, cfg.cameraHeight);
      hud.hidden = false;
      hideLoading();
    } catch (err) {
      console.error('[visualizer] house load failed:', err);
      showError("This home couldn't be loaded. Try refreshing, or pick a different demo home.");
    }
  }

  // --- Photo mode -----------------------------------------------------
  const photoMode = new PhotoMode(photoCanvas, {
    getSelections: () => state.selections,
    onStatus: (msg) => ui.setStatus(msg),
  });

  // --- Click-to-select on the 3D model (tap a part of the house) -----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    const start = downAt;
    downAt = null;
    if (!start || state.mode !== '3d' || !raycastTargets.length) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return; // was a drag, not a tap

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, rig.camera);
    const hit = raycaster.intersectObjects(raycastTargets, false)[0];
    if (!hit) return;
    const mat = hit.object.material;
    const matName = Array.isArray(mat) ? (mat[0] && mat[0].name) : (mat && mat.name);
    const category = categoryForMaterialName(matName);
    if (!category) return;
    state.setPanelSection(category);
    if (window.matchMedia('(max-width: 900px)').matches) {
      root.querySelector('[data-viz3d-sheettrigger]').click();
    }
  });

  // --- UI ---------------------------------------------------------------
  const ui = createUI(root, {
    state,
    onSelect: (key, value) => {
      state.set(key, value);
      if (materialController) materialController.apply(state.selections);
    },
    onHouseChange: (id) => {
      if (id === state.get('house')) return;
      state.set('house', id);
      loadAndApplyHouse(id);
    },
    onMode: (mode) => {
      state.setMode(mode);
      if (mode === 'photo') { loop.stop(); photoMode.draw(); } else { loop.start(); }
    },
    onSnapshot: () => {
      const source = state.mode === 'photo' ? photoCanvas : canvas;
      downloadCanvas(captureSnapshot(source), 'northern-pines-visualizer.png');
    },
    onResetView: () => rig.resetView(),
    onResetConfig: () => {
      state.reset();
      if (materialController) materialController.apply(state.selections);
      photoMode.reset();
    },
    onPickFile: (file) => photoMode.loadFile(file),
    onUndo: () => photoMode.undoLast(),
  });

  const params = new URLSearchParams(location.search);
  const styleParam = params.get('style');
  if (styleParam && ['doublehung', 'casement', 'picture', 'slider'].includes(styleParam)) {
    state.set('windowStyle', styleParam);
    state.setPanelSection('windows');
  }

  loop.start();
  loadAndApplyHouse(state.get('house'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
