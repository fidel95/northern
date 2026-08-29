// Groups the flat product list (config.js) into the five panel categories
// shown in the UI, and maps a GLB material name back to a category so a
// click on the 3D model can open the right panel section — the 3D
// equivalent of the old 2D tool's "tap a part of the house."

import { MAT } from './config.js';

export const CATEGORIES = [
  { id: 'siding', label: 'Siding', groups: ['siding'] },
  { id: 'roofing', label: 'Roofing', groups: ['roofing'] },
  { id: 'trim', label: 'Trim', groups: ['trim'] },
  { id: 'windows', label: 'Windows', groups: ['windowStyle', 'windowFrame', 'windowGlass', 'windowGrille'] },
  { id: 'doors', label: 'Doors', groups: ['doorStyle', 'doorColor', 'doorHardware'] },
];

const MAT_TO_CATEGORY = {
  [MAT.SIDING]: 'siding',
  [MAT.ROOFING]: 'roofing',
  [MAT.TRIM]: 'trim',
  [MAT.WINDOW_FRAME]: 'windows',
  [MAT.WINDOW_GLASS]: 'windows',
  [MAT.DOOR_SLAB]: 'doors',
  [MAT.DOOR_GLASS]: 'doors',
  [MAT.DOOR_HARDWARE]: 'doors',
};

export function categoryForMaterialName(name) {
  return MAT_TO_CATEGORY[name] || null;
}

export function categoryLabel(id) {
  return (CATEGORIES.find((c) => c.id === id) || {}).label || id;
}
