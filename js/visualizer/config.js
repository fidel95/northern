// Central data for the 3D visualizer: which houses exist, and which
// products/options the customer can configure. Nothing here renders
// anything — materials.js and ui.js both read from this file, so adding a
// new siding color or a fourth house model never touches rendering code.

// Material-slot names the app looks for on any loaded house GLB. Must match
// visualizer/models/ASSET-SPEC.md exactly (case-sensitive).
export const MAT = {
  SIDING: 'MAT_Siding',
  ROOFING: 'MAT_Roofing',
  TRIM: 'MAT_Trim',
  FOUNDATION: 'MAT_Foundation',
  WINDOW_FRAME: 'MAT_WindowFrame',
  WINDOW_GLASS: 'MAT_WindowGlass',
  DOOR_SLAB: 'MAT_DoorSlab',
  DOOR_GLASS: 'MAT_DoorGlass',
  DOOR_HARDWARE: 'MAT_DoorHardware',
  GUTTER: 'MAT_Gutter',
  GARAGE_DOOR: 'MAT_GarageDoor',
  // On the house (stoops and porch steps) and on the ground (driveway and
  // walk, built by environment.js): one Concrete choice covers both.
  CONCRETE: 'MAT_Concrete',
};

// One entry per house model. `model` points at a GLB built to
// visualizer/models/ASSET-SPEC.md by generate-houses.py — five genuinely
// different massings, all obeying the same MAT_* material-name contract, so
// the same UI drives all of them and an artist-delivered replacement drops in
// with no code changes.
//
// There are deliberately no camera settings here: cameraRig.js frames each
// house from the loaded model's real bounding box, so a house that changes
// size — or an artist GLB dropped in over one of these — needs no re-tuning.
export const houseConfigurations = {
  ranch: {
    id: 'ranch',
    name: 'Ranch',
    description: 'Single-story under a hip roof, with an attached garage.',
    model: 'models/house-ranch.glb',
  },
  colonial: {
    id: 'colonial',
    name: 'Colonial',
    description: 'Two-story, symmetric window bays.',
    model: 'models/house-colonial.glb',
  },
  craftsman: {
    id: 'craftsman',
    name: 'Craftsman',
    description: 'Front gable over a full-width porch.',
    model: 'models/house-craftsman.glb',
  },
  capecod: {
    id: 'capecod',
    name: 'Cape Cod',
    description: 'A story and a half: steep roof, two front dormers.',
    model: 'models/house-capecod.glb',
  },
  farmhouse: {
    id: 'farmhouse',
    name: 'Farmhouse',
    description: 'Two storeys, a deep porch and a garage wing.',
    model: 'models/house-farmhouse.glb',
  },
};

export const DEFAULT_HOUSE = 'ranch';

// Reused across siding/roofing/trim: a flat color plus the PBR + procedural
// texture parameters textures.js needs to build a tiling material.
const swatch = (id, name, color, extra) => ({ id, name, color, ...extra });

export const products = {
  siding: {
    label: 'Siding',
    hint: 'Applies to every exterior wall.',
    kind: 'swatch',
    options: [
      swatch('ivory', 'Ivory', '#F4F1E9', { roughness: 0.85, pattern: 'lap' }),
      swatch('sandstone', 'Sandstone', '#D9D4C6', { roughness: 0.85, pattern: 'lap' }),
      swatch('stone', 'Stone Gray', '#9A9A93', { roughness: 0.85, pattern: 'lap' }),
      swatch('slate', 'Slate', '#5A5D57', { roughness: 0.82, pattern: 'lap' }),
      swatch('charcoal', 'Charcoal', '#2B2C2A', { roughness: 0.8, pattern: 'lap' }),
      swatch('pine', 'Pine Green', '#3E4A44', { roughness: 0.85, pattern: 'lap' }),
      swatch('clay', 'Clay', '#8A6F5C', { roughness: 0.88, pattern: 'boardbatten' }),
      swatch('barn', 'Barn Red', '#6B3A32', { roughness: 0.86, pattern: 'boardbatten' }),
      swatch('harbor', 'Harbor Blue', '#3F4C5A', { roughness: 0.85, pattern: 'lap' }),
      swatch('shake', 'Cedar Shake', '#8A7458', { roughness: 0.92, pattern: 'shake' }),
    ],
  },
  roofType: {
    label: 'Roof type',
    hint: null,
    kind: 'list',
    options: [
      { id: 'shingle', name: 'Architectural shingle' },
      { id: 'metal', name: 'Standing-seam metal' },
    ],
  },
  roofing: {
    label: 'Roof color',
    hint: null,
    kind: 'swatch',
    options: [
      swatch('charcoal', 'Charcoal', '#2B2C2A', { roughness: 0.78 }),
      swatch('slate', 'Slate', '#4B4E4C', { roughness: 0.76 }),
      swatch('weathered', 'Weathered Gray', '#6B6459', { roughness: 0.8 }),
      swatch('brown', 'Brown', '#4A3A2C', { roughness: 0.78 }),
      swatch('black', 'Onyx', '#141414', { roughness: 0.7 }),
    ],
  },
  trim: {
    label: 'Trim',
    hint: 'Fascia, corner boards, and window/door casings.',
    kind: 'swatch',
    options: [
      swatch('white', 'White', '#EAEAE8', { roughness: 0.45 }),
      swatch('stone', 'Stone', '#C9C6BC', { roughness: 0.5 }),
      swatch('charcoal', 'Charcoal', '#2B2C2A', { roughness: 0.5 }),
      swatch('bronze', 'Dark Bronze', '#4A3B2C', { roughness: 0.45 }),
      swatch('black', 'Black', '#090909', { roughness: 0.45 }),
    ],
  },
  windowStyle: {
    label: 'Window style',
    hint: 'Changes the sash/mullion pattern.',
    kind: 'list',
    options: [
      { id: 'doublehung', name: 'Double Hung' },
      { id: 'casement', name: 'Casement' },
      { id: 'picture', name: 'Picture' },
      { id: 'slider', name: 'Sliding' },
      { id: 'awning', name: 'Awning' },
      { id: 'baybow', name: 'Bay & bow' },
    ],
  },
  windowFrame: {
    label: 'Frame color',
    hint: null,
    kind: 'swatch',
    options: [
      swatch('white', 'White', '#FFFFFF', { roughness: 0.4 }),
      swatch('black', 'Black', '#2B2C2A', { roughness: 0.4 }),
      swatch('bronze', 'Bronze', '#7A5C3E', { roughness: 0.42 }),
      swatch('gray', 'Stone Gray', '#55555D', { roughness: 0.42 }),
    ],
  },
  windowGlass: {
    label: 'Glass',
    hint: null,
    kind: 'list',
    options: [
      { id: 'clear', name: 'Clear', tint: '#c9d6da', opacity: 0.22, roughness: 0.04 },
      { id: 'lowe', name: 'Low-E', tint: '#9fc2c9', opacity: 0.32, roughness: 0.05 },
      { id: 'obscure', name: 'Obscure', tint: '#c7ccc9', opacity: 0.72, roughness: 0.35 },
    ],
  },
  windowGrille: {
    label: 'Grilles',
    hint: null,
    kind: 'list',
    options: [
      { id: 'none', name: 'None' },
      { id: 'sixoversix', name: '6-over-6' },
      { id: 'prairie', name: 'Prairie' },
    ],
  },
  doorStyle: {
    label: 'Door style',
    hint: 'Changes the lite pattern on the front door.',
    kind: 'list',
    options: [
      { id: 'single', name: 'Single Entry', lites: 'none' },
      { id: 'french', name: 'French Patio', lites: 'full' },
      { id: 'sidelights', name: 'With Sidelights', lites: 'half' },
    ],
  },
  doorColor: {
    label: 'Door color',
    hint: 'Shutters, where a home has them, match the front door.',
    kind: 'swatch',
    options: [
      swatch('black', 'Black', '#1B1C1E', { roughness: 0.45 }),
      swatch('white', 'White', '#F2F1EC', { roughness: 0.45 }),
      swatch('bronze', 'Bronze', '#7A5C3E', { roughness: 0.45 }),
      swatch('pine', 'Pine Green', '#3E4A44', { roughness: 0.45 }),
      swatch('barn', 'Barn Red', '#6B3A32', { roughness: 0.45 }),
    ],
  },
  doorHardware: {
    label: 'Hardware',
    hint: null,
    kind: 'swatch',
    options: [
      swatch('black', 'Matte Black', '#1c1c1c', { roughness: 0.35, metalness: 0.85 }),
      swatch('brass', 'Antique Brass', '#8a6a34', { roughness: 0.3, metalness: 0.9 }),
      swatch('nickel', 'Satin Nickel', '#9a9a96', { roughness: 0.35, metalness: 0.9 }),
    ],
  },
  garageDoor: {
    label: 'Garage door',
    hint: 'On the homes with a garage: the ranch and the farmhouse.',
    kind: 'swatch',
    options: [
      swatch('white', 'White', '#EEEDE8', { roughness: 0.5 }),
      swatch('almond', 'Almond', '#D8CDB8', { roughness: 0.5 }),
      swatch('sandstone', 'Sandstone', '#B9AE98', { roughness: 0.5 }),
      swatch('charcoal', 'Charcoal', '#3A3B39', { roughness: 0.45 }),
      swatch('black', 'Black', '#161616', { roughness: 0.45 }),
      swatch('walnut', 'Walnut', '#5C4330', { roughness: 0.6, grain: true }),
    ],
  },
  gutter: {
    label: 'Gutters & downspouts',
    hint: 'Seamless aluminum gutters and downspouts.',
    kind: 'swatch',
    options: [
      swatch('white', 'White', '#EEEDE8', { roughness: 0.4 }),
      swatch('almond', 'Almond', '#D8CDB8', { roughness: 0.4 }),
      swatch('clay', 'Clay', '#8A7A66', { roughness: 0.42 }),
      swatch('bronze', 'Dark Bronze', '#4A3B2C', { roughness: 0.38 }),
      swatch('black', 'Black', '#161616', { roughness: 0.38 }),
      swatch('gray', 'Pewter Gray', '#7C7E7C', { roughness: 0.38 }),
    ],
  },
  concrete: {
    label: 'Concrete finish',
    hint: 'Driveway, front walk and steps.',
    kind: 'list',
    options: [
      { id: 'broom', name: 'Broom finish' },
      { id: 'aggregate', name: 'Exposed aggregate' },
      { id: 'stamped', name: 'Stamped slate' },
    ],
  },
  concreteColor: {
    label: 'Concrete color',
    hint: null,
    kind: 'swatch',
    options: [
      swatch('natural', 'Natural Gray', '#B9B6AD', { roughness: 0.92 }),
      swatch('sand', 'Desert Sand', '#C9B79A', { roughness: 0.92 }),
      swatch('buff', 'Buff', '#B59F7E', { roughness: 0.92 }),
      swatch('charcoal', 'Charcoal', '#6E6C68', { roughness: 0.9 }),
    ],
  },
};

export function optionById(groupKey, id) {
  const group = products[groupKey];
  return group.options.find((o) => o.id === id) || group.options[0];
}

export const DEFAULT_SELECTIONS = {
  house: DEFAULT_HOUSE,
  siding: 'sandstone',
  roofing: 'charcoal',
  trim: 'white',
  windowStyle: 'doublehung',
  windowFrame: 'white',
  windowGlass: 'clear',
  windowGrille: 'none',
  doorStyle: 'single',
  doorColor: 'black',
  doorHardware: 'black',
  roofType: 'shingle',
  garageDoor: 'white',
  gutter: 'white',
  concrete: 'broom',
  concreteColor: 'natural',
};
