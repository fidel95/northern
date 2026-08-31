// Entry point: wires scene/camera/lighting/environment/house-loading/
// materials/UI/photo-mode together. Nothing else imports this file — it's
// the only module allowed to know about all the others.

import * as THREE from 'three';
import {
  createRenderer, createScene, fitRendererToContainer, createRenderLoop, disposeObject3D, watchContextLoss,
} from './sceneSetup.js';
import { createCameraRig } from './cameraRig.js';
import { createLighting } from './lighting.js';
import { buildEnvironment } from './environment.js';
import { loadHouse } from './houseLoader.js';
import { HouseMaterialController } from './materials.js';
import { houseConfigurations } from './config.js';
import { buildBeforeHouse, disposeBeforeHouse, renderCompareSplit } from './compareMode.js';
import { VisualizerState } from './state.js';
import { createUI } from './ui.js';
import { categoryForMaterialName } from './categories.js';
import { captureSnapshot, downloadCanvas } from './screenshot.js';
import { PhotoMode } from './photoMode.js';
import { createDiagnosticsPanel, collectRendererInfo } from './diagnostics.js';
import { detectPerformanceTier } from './performance.js';
import { setTextureQuality } from './textures.js';

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
  const reloadBtn = root.querySelector('[data-viz3d-reload]');
  const hud = root.querySelector('[data-viz3d-hud]');

  function setLoading(pct, text) {
    loadingEl.hidden = false;
    loadingEl.classList.remove('is-error');
    reloadBtn.hidden = true;
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
    reloadBtn.hidden = false;
  }
  reloadBtn.addEventListener('click', () => location.reload());

  // Every step below this point is synchronous WebGL/scene setup work that
  // — despite the earlier context-creation check — can still throw on a
  // genuinely broken or resource-starved GPU (driver quirks, a context that
  // creates fine but fails on first shader compile, etc.). Catching it here
  // means a device we can't actually run on gets the same clear fallback
  // message as one that failed the initial supportsWebGL() check, instead
  // of a half-built page and a console error.
  try {
    const tier = detectPerformanceTier();
    setTextureQuality(tier.textureSize);

    const state = new VisualizerState();
    const diagnostics = createDiagnosticsPanel(root.querySelector('[data-viz3d-canvaswrap]'));
    diagnostics.log(`init start — performance tier: ${tier.tier}`);

    const renderer = createRenderer(canvas, tier);
    diagnostics.log(`renderer created\n${collectRendererInfo(renderer)}`);
    const scene = createScene();
    const rig = createCameraRig(canvas);
    createLighting(renderer, scene, tier);
    diagnostics.log('lighting created');
    scene.add(buildEnvironment());
    diagnostics.log('environment (ground/driveway) added');

    fitRendererToContainer(renderer, rig.camera, canvasWrap, tier.pixelRatioCap);
    const resizeObserver = new ResizeObserver(() => fitRendererToContainer(renderer, rig.camera, canvasWrap, tier.pixelRatioCap));
    resizeObserver.observe(canvasWrap);

    // Compare (before/after) is transient render state, not a "selection" —
    // it changes every frame while the customer drags the slider, so it lives
    // here as plain vars the render loop reads directly rather than going
    // through VisualizerState's pub/sub + full UI re-render on every tick.
    let compareOn = false;
    let compareFraction = 0.5;

    // Idle throttling: once the customer stops interacting (no drag/zoom,
    // and OrbitControls' damping has settled — both surface as activity via
    // the listeners below), rendering drops from every frame to roughly
    // every 4th (~15fps) instead of a flat 60fps. The scene has nothing that
    // animates on its own, so a fully static frame re-rendered at 60fps is
    // pure wasted GPU/battery — this keeps input feeling instant (still
    // renders promptly on the very next interaction) while idling cheap.
    let lastActivity = performance.now();
    let frameCount = 0;
    const IDLE_MS = 2000;
    const markActive = () => { lastActivity = performance.now(); };
    canvas.addEventListener('pointerdown', markActive);
    canvas.addEventListener('pointermove', markActive);
    canvas.addEventListener('wheel', markActive, { passive: true });
    rig.controls.addEventListener('change', markActive);

    const loop = createRenderLoop(() => {
      frameCount++;
      rig.controls.update();
      const idle = performance.now() - lastActivity > IDLE_MS;
      if (idle && frameCount % 4 !== 0) return;
      try {
        if (compareOn && beforeGroup && houseGroup) {
          renderCompareSplit(renderer, scene, rig.camera, beforeGroup, houseGroup, compareFraction, canvas.width, canvas.height);
        } else {
          if (beforeGroup) beforeGroup.visible = false;
          if (houseGroup) houseGroup.visible = true;
          renderer.render(scene, rig.camera);
        }
      } catch (err) {
        // A synchronous throw from render() (distinct from an async
        // 'webglcontextlost' event, handled below) means the context is in
        // some unrecoverable state — stop trying to draw into it every
        // frame and surface the same reload path rather than spamming the
        // console 60 times a second.
        console.error('[visualizer] render failed:', err);
        loop.stop();
        showError('The 3D preview ran into a problem on this device.');
      }
    });

    watchContextLoss(canvas, () => {
      loop.stop();
      showError('The 3D preview needs to reload on this device.');
    });

    // Pauses the render loop while the canvas is scrolled off-screen (the
    // customer reading the page's copy below/above it), on top of
    // sceneSetup.js's own tab-hidden pause — same GPU/battery motivation,
    // different trigger. Guarded by `state.mode` so it never fights with
    // Photo mode's own stop/start (see onMode below): scrolling back into
    // view shouldn't resume the 3D loop while the customer is in Photo mode.
    let onscreen = true;
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
      if (onscreen) { if (state.mode === '3d') loop.start(); } else { loop.stop(); }
    }, { threshold: 0.01 });
    visibilityObserver.observe(canvasWrap);

    let houseGroup = null;
    let materialController = null;
    let raycastTargets = [];
    let beforeGroup = null;
    let beforeMaterialController = null;

  async function loadAndApplyHouse(houseId) {
    const cfg = houseConfigurations[houseId] || houseConfigurations[Object.keys(houseConfigurations)[0]];
    hud.hidden = true;
    setLoading(0, 'Preparing your home…');
    try {
      diagnostics.log(`loading house: ${cfg.model}`);
      const gltf = await loadHouse(cfg.model, renderer, (p) => { if (p != null) setLoading(p, 'Preparing your home…'); });
      diagnostics.log('gltf load resolved');

      if (houseGroup) {
        scene.remove(houseGroup);
        if (materialController) materialController.dispose();
        disposeObject3D(houseGroup);
      }
      disposeBeforeHouse(scene, beforeGroup, beforeMaterialController, disposeObject3D);
      beforeGroup = null;
      beforeMaterialController = null;

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
      diagnostics.log(`material groups found: ${[...materialController.groups.keys()].join(', ')}`);
      materialController.apply(state.selections);
      diagnostics.log('materials applied');

      // Before/After comparison needs a second copy of the same house on a
      // stock/default configuration. Cloning houseGroup here (after apply()
      // above) is safe: clone() shares material *references*, and each
      // HouseMaterialController only ever reassigns mesh.material on its
      // own group's meshes — it never mutates a shared material's contents
      // — so building the "before" controller off the clone and applying
      // DEFAULT_SELECTIONS to it leaves houseGroup's own materials alone.
      ({ beforeGroup, controller: beforeMaterialController } = buildBeforeHouse(houseGroup, scene));

      raycastTargets = [];
      houseGroup.traverse((o) => { if (o.isMesh) raycastTargets.push(o); });

      rig.setDefaultView(cfg.cameraDistance, cfg.cameraHeight);
      hud.hidden = false;
      hideLoading();
      diagnostics.log(`ready — canvas ${canvas.width}x${canvas.height}, dpr ${window.devicePixelRatio}`);
    } catch (err) {
      console.error('[visualizer] house load failed:', err);
      diagnostics.log(`house load failed: ${err && err.message ? err.message : err}`);
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
      if (mode === 'photo') { loop.stop(); photoMode.draw(); } else if (onscreen) { loop.start(); }
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
      ui.resetCompare();
    },
    onPickFile: (file) => photoMode.loadFile(file),
    onUndo: () => photoMode.undoLast(),
    // The compare slider's drag handle lives outside the <canvas> (a DOM
    // overlay), so it never fires the canvas pointer listeners that feed
    // the idle throttle above — without marking activity here too, dragging
    // it after a couple of idle seconds would visibly stutter at the
    // throttled ~15fps instead of tracking the pointer smoothly.
    onCompareToggle: (on) => { compareOn = on; markActive(); },
    onComparePos: (fraction) => { compareFraction = fraction; markActive(); },
  });

  const params = new URLSearchParams(location.search);
  const styleParam = params.get('style');
  if (styleParam && ['doublehung', 'casement', 'picture', 'slider'].includes(styleParam)) {
    state.set('windowStyle', styleParam);
    state.setPanelSection('windows');
  }

    loop.start();
    loadAndApplyHouse(state.get('house'));
  } catch (err) {
    // Setup itself threw synchronously (bad driver, context created but
    // unusable, etc.) — same fallback as the initial supportsWebGL() check,
    // rather than leaving whatever partially-built canvas/UI state existed
    // at the point of failure on screen.
    console.error('[visualizer] setup failed:', err);
    fallback.hidden = false;
    canvasWrap.hidden = true;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
