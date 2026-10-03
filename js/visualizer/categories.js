// Groups the flat product list (config.js) into the six panel categories —
// one per service the company sells, in the order the site lists them — and maps a GLB material name back to a category so a
// click on the 3D model can open the right panel section — the 3D
// equivalent of the old 2D tool's "tap a part of the house."

import { MAT } from './config.js';

// `service` is the name the estimate form's service checkboxes use, and
// `priced` says whether the instant estimate prices it (windows and doors)
// or it goes to the team as a quote request.
export const CATEGORIES = [
  { id: 'roofing', label: 'Roofing', service: 'Roofing', priced: false, groups: ['roofType', 'roofing'] },
  { id: 'siding', label: 'Siding & trim', service: 'Siding', priced: false, groups: ['siding', 'trim'] },
  { id: 'windows', label: 'Windows', service: 'Windows', priced: true, groups: ['windowStyle', 'windowFrame', 'windowGlass', 'windowGrille'] },
  { id: 'doors', label: 'Doors', service: 'Doors', priced: true, groups: ['doorStyle', 'doorColor', 'doorHardware', 'garageDoor'] },
  { id: 'gutters', label: 'Gutters', service: 'Gutters', priced: false, groups: ['gutter'] },
  { id: 'concrete', label: 'Concrete', service: 'Concrete', priced: false, groups: ['concrete', 'concreteColor'] },
];

const MAT_TO_CATEGORY = {
  [MAT.SIDING]: 'siding',
  [MAT.ROOFING]: 'roofing',
  [MAT.TRIM]: 'siding',
  [MAT.WINDOW_FRAME]: 'windows',
  [MAT.WINDOW_GLASS]: 'windows',
  [MAT.DOOR_SLAB]: 'doors',
  [MAT.DOOR_GLASS]: 'doors',
  [MAT.DOOR_HARDWARE]: 'doors',
  [MAT.GARAGE_DOOR]: 'doors',
  [MAT.GUTTER]: 'gutters',
  [MAT.CONCRETE]: 'concrete',
};

export function categoryForMaterialName(name) {
  return MAT_TO_CATEGORY[name] || null;
}

export function categoryLabel(id) {
  return (CATEGORIES.find((c) => c.id === id) || {}).label || id;
}
