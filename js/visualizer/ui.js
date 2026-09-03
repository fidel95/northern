// Builds and wires the customization panel, mode tabs, house picker, and
// mobile bottom sheet. Pure DOM — no Three.js references here at all, so
// this module works the same whether the 3D scene is ready or still
// loading.

import {
  products, houseConfigurations, optionById, DEFAULT_SELECTIONS,
} from './config.js';
import { CATEGORIES, categoryLabel } from './categories.js';

// 'house' (which base model is loaded) isn't a material choice, so switching
// it alone shouldn't count as "customized" for Compare purposes — the
// before/after split only ever differs by siding/roofing/trim/window/door
// selections (see compareMode.js's buildBeforeHouse).
function hasCustomizations(selections) {
  return Object.keys(DEFAULT_SELECTIONS).some(
    (key) => key !== 'house' && selections[key] !== DEFAULT_SELECTIONS[key],
  );
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function isNarrow() {
  // Presentation Mode forces the same compact bottom-sheet configurator
  // used on phones/tablets — regardless of actual screen width — so the 3D
  // view gets the space instead of a permanent sidebar. Reuses the mobile
  // layout wholesale rather than building a second "presentation" panel.
  return window.matchMedia('(max-width: 900px)').matches || document.body.classList.contains('viz-present');
}

export function createUI(root, {
  state, onSelect, onHouseChange, onMode, onSnapshot, onResetView, onResetConfig, onPickFile, onUndo,
  onCompareToggle, onComparePos,
}) {
  const refs = {
    modeTabs: root.querySelectorAll('[data-viz3d-modetab]'),
    homes: root.querySelector('[data-viz3d-homes]'),
    status: root.querySelector('[data-viz3d-status]'),
    uploadPanel: root.querySelector('[data-viz3d-uploadpanel]'),
    pickFileBtn: root.querySelector('[data-viz3d-pickfile]'),
    undoBtn: root.querySelector('[data-viz3d-undo]'),
    fileInput: root.querySelector('[data-viz3d-fileinput]'),
    panel: root.querySelector('[data-viz3d-panel]'),
    panelClose: root.querySelector('[data-viz3d-panelclose]'),
    categoryList: root.querySelector('[data-viz3d-categorylist]'),
    controls: root.querySelector('[data-viz3d-controls]'),
    sheetTrigger: root.querySelector('[data-viz3d-sheettrigger]'),
    resetConfigBtn: root.querySelector('[data-viz3d-resetconfig]'),
    resetViewBtn: root.querySelector('[data-viz3d-reset]'),
    snapshotBtn: root.querySelector('[data-viz3d-snapshot]'),
    estimateLink: document.querySelectorAll('[data-viz3d-estimatelink]'),
    desc: document.getElementById('description-visualizer'),
    canvasWrap: root.querySelector('[data-viz3d-canvaswrap]'),
    photoCanvas: root.querySelector('[data-viz3d-photocanvas]'),
    canvas3d: root.querySelector('[data-viz3d-canvas]'),
    compareToggle: root.querySelector('[data-viz3d-comparetoggle]'),
    compareOverlay: root.querySelector('[data-viz3d-compare]'),
    compareHandle: root.querySelector('[data-viz3d-comparehandle]'),
    presentToggle: root.querySelector('[data-viz3d-presenttoggle]'),
    presentExit: root.querySelector('[data-viz3d-presentexit]'),
  };

  let sheetOpen = false;
  let compareOn = false;
  let compareFraction = 0.5;

  function setComparePos(fraction, { silent } = {}) {
    compareFraction = Math.min(0.94, Math.max(0.06, fraction));
    refs.compareHandle.style.left = `${compareFraction * 100}%`;
    refs.compareHandle.setAttribute('aria-valuenow', String(Math.round(compareFraction * 100)));
    if (!silent) onComparePos(compareFraction);
  }

  function setCompareOn(on) {
    compareOn = on;
    refs.compareToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    refs.compareOverlay.hidden = !on;
    refs.compareOverlay.setAttribute('aria-hidden', on ? 'false' : 'true');
    onCompareToggle(on);
  }

  function fractionFromClientX(clientX) {
    const rect = refs.canvasWrap.getBoundingClientRect();
    return (clientX - rect.left) / rect.width;
  }

  refs.compareToggle.addEventListener('click', () => setCompareOn(!compareOn));

  let dragging = false;
  refs.compareHandle.addEventListener('pointerdown', (e) => {
    dragging = true;
    refs.compareHandle.setPointerCapture(e.pointerId);
  });
  refs.compareHandle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    setComparePos(fractionFromClientX(e.clientX));
  });
  refs.compareHandle.addEventListener('pointerup', (e) => {
    dragging = false;
    if (refs.compareHandle.hasPointerCapture(e.pointerId)) refs.compareHandle.releasePointerCapture(e.pointerId);
  });
  refs.compareHandle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { setComparePos(compareFraction - 0.05); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { setComparePos(compareFraction + 0.05); e.preventDefault(); }
  });

  function setPresentation(on) {
    document.body.classList.toggle('viz-present', on);
    if (refs.presentExit) refs.presentExit.hidden = !on;
    if (refs.presentToggle) refs.presentToggle.textContent = on ? 'Exit Presentation Mode' : 'Presentation Mode';
    renderAll();
  }

  if (refs.presentToggle) refs.presentToggle.addEventListener('click', () => setPresentation(!document.body.classList.contains('viz-present')));
  if (refs.presentExit) refs.presentExit.addEventListener('click', () => setPresentation(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('viz-present')) setPresentation(false);
  });

  function makeOptionButton(groupKey, option, kind, active) {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (kind === 'swatch') {
      btn.className = 'viz-swatch-btn';
      btn.style.background = option.color;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      const sr = el('span', 'viz-sr-only', option.name);
      btn.appendChild(sr);
    } else {
      btn.className = 'viz-opt-btn';
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.title = option.name;
      if (option.color) {
        const sw = el('span', 'viz-opt-btn__swatch');
        sw.style.background = option.color;
        btn.appendChild(sw);
      }
      btn.appendChild(document.createTextNode(option.name));
    }
    btn.addEventListener('click', () => onSelect(groupKey, option.id));
    return btn;
  }

  function renderGroup(groupKey) {
    const group = products[groupKey];
    const fs = el('fieldset', 'viz-control');
    fs.appendChild(el('legend', null, group.label));
    if (group.hint) fs.appendChild(el('p', 'viz-control__hint', group.hint));
    const grid = el('div', `viz-control-grid${group.kind === 'swatch' ? ' viz-control-grid--swatch' : ''}`);
    const activeId = state.get(groupKey);
    group.options.forEach((opt) => grid.appendChild(makeOptionButton(groupKey, opt, group.kind, opt.id === activeId)));
    fs.appendChild(grid);
    return fs;
  }

  function renderCategoryList() {
    refs.categoryList.innerHTML = '';
    CATEGORIES.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'viz-zone-btn';
      btn.setAttribute('data-zone', cat.id);
      btn.setAttribute('aria-pressed', cat.id === state.panelSection ? 'true' : 'false');
      btn.textContent = cat.label;
      btn.addEventListener('click', () => {
        state.setPanelSection(cat.id);
        if (isNarrow()) { sheetOpen = true; renderAll(); }
      });
      refs.categoryList.appendChild(btn);
    });
  }

  function renderControls() {
    refs.controls.innerHTML = '';
    const cat = CATEGORIES.find((c) => c.id === state.panelSection) || CATEGORIES[0];
    cat.groups.forEach((g) => refs.controls.appendChild(renderGroup(g)));
  }

  function renderHomes() {
    refs.homes.innerHTML = '';
    Object.values(houseConfigurations).forEach((house) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'viz-home-btn';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', house.id === state.get('house') ? 'true' : 'false');
      btn.textContent = house.name;
      btn.addEventListener('click', () => onHouseChange(house.id));
      refs.homes.appendChild(btn);
    });
  }

  // Doors are the one product the estimate still prices per option, so a
  // customer who was configuring doors should land on the matching door tab
  // with their style already selected, rather than on the window tiers.
  const DOOR_STYLE_TO_ESTIMATE = {
    single: { tab: 'entry', style: 'single' },
    sidelights: { tab: 'entry', style: 'sidelights' },
    french: { tab: 'patio', style: 'french' },
  };

  function estimateHref() {
    const s = state.snapshot();
    const note = `From the 3D visualizer — ${houseConfigurations[s.house]?.name || ''} home, ` +
      `${optionById('siding', s.siding).name} siding, ${optionById('trim', s.trim).name} trim, ${optionById('roofing', s.roofing).name} roof.`;

    if (state.panelSection === 'doors') {
      const target = DOOR_STYLE_TO_ESTIMATE[s.doorStyle] || DOOR_STYLE_TO_ESTIMATE.single;
      const doorNote = `${note} Door configured as ${optionById('doorStyle', s.doorStyle).name}, ` +
        `${optionById('doorColor', s.doorColor).name}, ${optionById('doorHardware', s.doorHardware).name} hardware.`;
      return `/estimate/?${new URLSearchParams({ tab: target.tab, style: target.style, note: doorNote }).toString()}`;
    }

    // Windows are a flat Good/Better/Best tier; these options are included in
    // every tier rather than priced individually, so they travel as a
    // specification the estimate repeats back, not as price inputs.
    const params = {
      tab: 'windows', style: s.windowStyle, color: s.windowFrame, glass: s.windowGlass, grille: s.windowGrille, note,
    };
    return `/estimate/?${new URLSearchParams(params).toString()}`;
  }

  function prefillText() {
    const s = state.snapshot();
    return 'HOME VISUALIZER CONFIGURATION\n' +
      `Base home: ${houseConfigurations[s.house]?.name || ''}\n` +
      `Windows: ${optionById('windowStyle', s.windowStyle).name} · ${optionById('windowFrame', s.windowFrame).name} frame · ` +
      `${optionById('windowGrille', s.windowGrille).name} grille · ${optionById('windowGlass', s.windowGlass).name} glass\n` +
      `Door: ${optionById('doorStyle', s.doorStyle).name} · ${optionById('doorColor', s.doorColor).name} · ${optionById('doorHardware', s.doorHardware).name} hardware\n` +
      `Siding: ${optionById('siding', s.siding).name} · Trim: ${optionById('trim', s.trim).name} · Roof: ${optionById('roofing', s.roofing).name}`;
  }

  function renderAll() {
    refs.modeTabs.forEach((tab) => tab.setAttribute('aria-selected', tab.getAttribute('data-viz3d-modetab') === state.mode ? 'true' : 'false'));
    refs.homes.style.display = state.mode === '3d' ? '' : 'none';
    refs.uploadPanel.classList.toggle('is-active', state.mode === 'photo');
    if (refs.canvas3d) refs.canvas3d.hidden = state.mode !== '3d';
    if (refs.photoCanvas) refs.photoCanvas.hidden = state.mode !== 'photo';

    // Before/After only makes sense against the live 3D model, not the
    // hand-traced photo overlay — drop out of compare rather than leave a
    // dead control up when the customer switches to "My Home". It's also a
    // no-op until something differs from the stock defaults ("before" is
    // always the stock house — see compareMode.js) — disable it rather than
    // let the customer toggle it into two identical halves.
    const customized = hasCustomizations(state.selections);
    refs.compareToggle.disabled = state.mode !== '3d' || !customized;
    refs.compareToggle.hidden = state.mode !== '3d';
    refs.compareToggle.title = customized ? '' : 'Customize the house first to compare before/after';
    if ((state.mode !== '3d' || !customized) && compareOn) setCompareOn(false);

    renderHomes();
    renderCategoryList();
    renderControls();

    const narrow = isNarrow();
    refs.panel.classList.toggle('is-open', narrow && sheetOpen);
    refs.sheetTrigger.classList.toggle('is-hidden', !(narrow && !sheetOpen));
    refs.sheetTrigger.textContent = `Customize ${categoryLabel(state.panelSection).toLowerCase()}`;

    const href = estimateHref();
    refs.estimateLink.forEach((a) => a.setAttribute('href', href));
    if (refs.desc) refs.desc.value = prefillText();
  }

  refs.modeTabs.forEach((tab) => tab.addEventListener('click', () => onMode(tab.getAttribute('data-viz3d-modetab'))));
  refs.panelClose.addEventListener('click', () => { sheetOpen = false; renderAll(); });
  refs.sheetTrigger.addEventListener('click', () => { sheetOpen = true; renderAll(); });
  refs.resetConfigBtn.addEventListener('click', () => onResetConfig());
  refs.resetViewBtn.addEventListener('click', () => onResetView());
  refs.snapshotBtn.addEventListener('click', () => onSnapshot());
  refs.pickFileBtn.addEventListener('click', () => refs.fileInput.click());
  refs.fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) onPickFile(f);
  });
  refs.undoBtn.addEventListener('click', () => onUndo());
  window.matchMedia('(max-width: 900px)').addEventListener('change', renderAll);

  state.subscribe((type) => {
    if (type === 'panel') renderControls();
    renderAll();
  });

  function setStatus(text) { refs.status.textContent = text; }

  function resetCompare() { setComparePos(0.5, { silent: true }); }

  setComparePos(0.5, { silent: true });
  renderAll();
  return { renderAll, setStatus, resetCompare, refs };
}
