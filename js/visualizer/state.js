// Single source of truth for the current configuration. UI, the 3D material
// controller, the estimate CTA, and the snapshot watermark all read from
// here; nothing else holds its own copy of "what's selected."

import { DEFAULT_SELECTIONS } from './config.js';

export class VisualizerState {
  constructor() {
    this.selections = { ...DEFAULT_SELECTIONS };
    this.mode = '3d'; // '3d' | 'photo'
    this.panelSection = 'siding';
    this._listeners = new Set();
  }

  get(key) { return this.selections[key]; }

  set(key, value) {
    if (this.selections[key] === value) return;
    this.selections = { ...this.selections, [key]: value };
    this._emit('selection', key, value);
  }

  setPanelSection(id) {
    if (this.panelSection === id) return;
    this.panelSection = id;
    this._emit('panel', id);
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this._emit('mode', mode);
  }

  reset() {
    this.selections = { ...DEFAULT_SELECTIONS };
    this._emit('reset');
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(type, ...args) {
    this._listeners.forEach((fn) => fn(type, ...args));
  }

  // Plain, JSON-serializable snapshot for the estimate CTA / lead form —
  // this is the object section 17 asks for.
  snapshot() {
    return { ...this.selections, mode: this.mode };
  }
}
