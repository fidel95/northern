// Builds and wires the customization panel, mode tabs, house picker, and
// mobile bottom sheet. Pure DOM — no Three.js references here at all, so
// this module works the same whether the 3D scene is ready or still
// loading.

import { products, houseConfigurations, optionById } from './config.js';
import { CATEGORIES, categoryLabel } from './categories.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function isNarrow() {
  return window.matchMedia('(max-width: 900px)').matches;
}

export function createUI(root, { state, onSelect, onHouseChange, onMode, onSnapshot, onResetView, onResetConfig, onPickFile, onUndo }) {
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
  };

  let sheetOpen = false;

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

  function estimateHref() {
    const s = state.snapshot();
    const note = `From the 3D visualizer — ${houseConfigurations[s.house]?.name || ''} home, ` +
      `${optionById('siding', s.siding).name} siding, ${optionById('trim', s.trim).name} trim, ${optionById('roofing', s.roofing).name} roof.`;
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

  renderAll();
  return { renderAll, setStatus, refs };
}
