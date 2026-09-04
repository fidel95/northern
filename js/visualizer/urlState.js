// Puts the current configuration in the address bar, and reads it back.
//
// Without this a configuration cannot leave the browser it was built in: the
// visualizer read one key (`style`) and wrote none, so copying the URL after
// ten minutes of choosing bronze frames on the craftsman handed someone a
// default ranch in white. The same gap is why a lead arrives in Salesforce as
// prose a rep has to rebuild by hand instead of a link they can open.
//
// SECURITY — the rule this file exists to enforce:
//
//   Everything here is attacker-controlled. A URL is the easiest thing in the
//   world to send someone, and it arrives on our own domain, which is what
//   makes it credible. So no value read from the URL is ever used directly.
//   Each one is resolved against the ids in config.js and discarded if it
//   does not match, meaning the only strings that reach the rest of the app
//   are ones that were already compiled into it.
//
//   Downstream code relies on that. js/estimate.js builds an innerHTML string
//   from the visualizer's spec line, and that is only safe while the values
//   feeding it come from a fixed table. Do not "simplify" any of this into
//   passing a raw parameter through.
//
//   Product selections only. Never put anything about a person in here — not
//   a name, address, email or phone. URLs end up in browser history, CDN
//   logs, link previews and Referer headers, and none of those are places
//   customer details belong.

import { products, houseConfigurations, DEFAULT_SELECTIONS } from './config.js';

// Internal state key -> URL parameter name. `style` is the name the old
// single-parameter links already used, so links shared before this existed
// keep working.
const PARAM = {
  house: 'house',
  siding: 'siding',
  roofing: 'roof',
  trim: 'trim',
  windowStyle: 'style',
  windowFrame: 'frame',
  windowGlass: 'glass',
  windowGrille: 'grille',
  doorStyle: 'door',
  doorColor: 'doorcolor',
  doorHardware: 'doorhw',
};

// Presentation mode is not a product selection, so it stays out of the map
// above and is passed explicitly. A rep opening a customer's configuration on
// a tablet wants it fullscreen on arrival, not after hunting for a button
// while the customer watches.
const PRESENT_PARAM = 'present';

export function presentFromSearch(search) {
  return new URLSearchParams(search).get(PRESENT_PARAM) === '1';
}

/** Whether the page is currently presenting — the one DOM read, in one place. */
export function isPresenting() {
  return typeof document !== 'undefined'
    && !!document.body
    && document.body.classList.contains('viz-present');
}

/** The ids that are valid for a given state key, straight from the config. */
function allowedIds(key) {
  if (key === 'house') return Object.keys(houseConfigurations);
  const group = products[key];
  return group ? group.options.map((o) => o.id) : [];
}

/**
 * Reads a configuration out of a query string.
 *
 * Unknown parameters, unknown values and anything of the wrong shape are
 * dropped without comment: a bad link should open the default house, not
 * an error and certainly not whatever the link author typed.
 */
export function selectionsFromSearch(search) {
  const params = new URLSearchParams(search);
  const out = {};

  Object.keys(PARAM).forEach((key) => {
    const raw = params.get(PARAM[key]);
    if (typeof raw !== 'string') return;
    if (allowedIds(key).includes(raw)) out[key] = raw;
  });

  return out;
}

/**
 * The query string for a configuration, carrying only what differs from the
 * defaults so a lightly-changed house does not produce an eleven-parameter
 * URL nobody will paste.
 */
export function searchFromSelections(selections, present = false) {
  const params = new URLSearchParams();

  Object.keys(PARAM).forEach((key) => {
    const value = selections[key];
    if (value === undefined || value === DEFAULT_SELECTIONS[key]) return;
    if (!allowedIds(key).includes(value)) return;
    params.set(PARAM[key], value);
  });

  if (present) params.set(PRESENT_PARAM, '1');

  const q = params.toString();
  return q ? `?${q}` : '';
}

/** The absolute link to hand someone — for the lead form and the rep. */
export function shareUrl(selections) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${searchFromSelections(selections, isPresenting())}`;
}

/**
 * Keeps the address bar in step with the configuration.
 *
 * replaceState rather than pushState: every swatch click would otherwise add
 * a history entry, and forty of them would turn the back button into a way
 * of undoing colour choices one at a time instead of leaving the page.
 */
export function syncUrl(selections) {
  try {
    const url = `${window.location.pathname}${searchFromSelections(selections, isPresenting())}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
  } catch (e) {
    // Some embedded browsers throw on replaceState. A stale address bar is
    // worth nothing breaking over.
  }
}
