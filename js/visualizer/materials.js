// Runtime material assignment. This is the heart of "GLB in, configured
// house out": it never trusts whatever material the GLB shipped with (for
// the parts a customer can change) — it matches meshes by material *name*
// (see MAT constants in config.js / visualizer/models/ASSET-SPEC.md) and
// swaps in a material built from the current selections.
//
// It also builds window/door grille & sash bars procedurally as real thin
// box geometry positioned from each glass mesh's world-space bounding box —
// not a texture decal — so it works on both the placeholder and, unchanged,
// on any future artist-delivered GLB that follows the same material-naming
// contract, regardless of exactly how that artist authored the window
// geometry.

import * as THREE from 'three';
import { MAT, optionById } from './config.js';
import { getSidingTexture, getRoofingTexture, getTrimTexture } from './textures.js';

function worldExtents(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  return { box, size };
}

function largestTwo(size) {
  const axes = [
    { k: 'x', v: size.x }, { k: 'y', v: size.y }, { k: 'z', v: size.z },
  ].sort((a, b) => b.v - a.v);
  return { a: axes[0], b: axes[1], thin: axes[2] };
}

// One material (and one set of GPU textures) shared across every mesh in a
// category — e.g. all 4 wall meshes get the *same* MAT_Siding material
// object, not 4 independent clones. An earlier per-mesh-cloned-texture
// version worked fine on desktop but multiplied GPU texture memory by the
// mesh count on every single material change, which is exactly the kind of
// thing that exhausts VRAM and silently kills the WebGL context on phones —
// the house going solid black and staying black regardless of further
// selections is the classic symptom of a lost context. Textures come from
// textures.js's own cache (repeat baked in at build time there) and are
// never disposed here — they're meant to live for the page's lifetime and
// get reused every time that option is picked again.
function texturedMaterial(base, extraProps = {}) {
  return new THREE.MeshStandardMaterial({
    map: base.map, normalMap: base.normalMap, roughnessMap: base.roughnessMap,
    roughness: base.roughnessMap ? 1 : (extraProps.roughness ?? 0.85),
    metalness: 0,
    envMapIntensity: 0.7,
    ...extraProps,
  });
}

function glassMaterial(option) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(option.tint),
    transparent: true,
    opacity: Math.max(option.opacity, 0.55),
    roughness: option.roughness,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
    // No environment map (see lighting.js's comment on why — it silently
    // broke on real GPUs), so the glass's "reflective" read has to come
    // entirely from direct-light specular. Pushing specularIntensity to 1
    // with a cool-white specularColor gives the sun a crisp, glassy
    // highlight instead of the flatter default dielectric response.
    specularIntensity: 1,
    specularColor: new THREE.Color(0xf3f8fb),
    ior: 1.52,
    envMapIntensity: 0.5,
    side: THREE.DoubleSide,
  });
}

function hardwareMaterial(option) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(option.color),
    roughness: option.roughness,
    metalness: option.metalness,
    envMapIntensity: 1,
  });
}

function flatMaterial(colorHex, roughness) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(colorHex), roughness, metalness: 0, envMapIntensity: 0.6 });
}

// --- mesh collection -------------------------------------------------------

function collectByMaterialName(root) {
  const groups = new Map();
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m || !m.name) return;
      if (!groups.has(m.name)) groups.set(m.name, []);
      groups.get(m.name).push(obj);
    });
  });
  return groups;
}

// Only the material itself — never its texture maps. Siding/roofing/trim
// maps come from textures.js's long-lived cache (shared across every mesh
// and every future re-selection of that same option) and glass/hardware/flat
// materials never carry a map at all, so there's nothing map-related that's
// safe to free here without breaking the next reuse of a cached texture.
function disposeMaterial(mat) {
  if (mat) mat.dispose();
}

// --- grille / sash bar geometry ---------------------------------------

const BAR_THICKNESS = 0.035;

function styleBars(styleId) {
  switch (styleId) {
    case 'doublehung': return [{ x0: 0, y0: 0.47, x1: 1, y1: 0.53 }];
    case 'casement': return [{ x0: 0.3, y0: 0.03, x1: 0.36, y1: 0.97 }];
    case 'slider': return [{ x0: 0.47, y0: 0.03, x1: 0.53, y1: 0.97 }];
    case 'picture':
    default: return [];
  }
}

function grilleBars(grilleId) {
  if (grilleId === 'sixoversix') {
    return [
      { x0: 0.32, y0: 0.03, x1: 0.36, y1: 0.97 },
      { x0: 0.64, y0: 0.03, x1: 0.68, y1: 0.97 },
      { x0: 0.03, y0: 0.31, x1: 0.97, y1: 0.35 },
      { x0: 0.03, y0: 0.63, x1: 0.97, y1: 0.67 },
    ];
  }
  if (grilleId === 'prairie') {
    return [
      { x0: 0.03, y0: 0.68, x1: 0.97, y1: 0.72 },
      { x0: 0.32, y0: 0.68, x1: 0.36, y1: 0.97 },
      { x0: 0.64, y0: 0.68, x1: 0.68, y1: 0.97 },
    ];
  }
  return [];
}

function buildBarsForGlass(glassMesh, rects, barMaterial, houseCenter, group) {
  const { box, size } = worldExtents(glassMesh);
  const { a, b, thin } = largestTwo(size);
  const center = box.getCenter(new THREE.Vector3());

  const outward = Math.sign(center[thin.k] - houseCenter[thin.k]) || 1;
  const depthOffset = thin.v / 2 + 0.012;

  rects.forEach((r) => {
    const w = (r.x1 - r.x0) * a.v;
    const h = (r.y1 - r.y0) * b.v;
    if (w <= 0 || h <= 0) return;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geo, barMaterial);

    const dims = { x: 0, y: 0, z: 0 };
    dims[a.k] = w; dims[b.k] = h; dims[thin.k] = BAR_THICKNESS;
    mesh.scale.set(dims.x || BAR_THICKNESS, dims.y || BAR_THICKNESS, dims.z || BAR_THICKNESS);

    const pos = center.clone();
    const offA = (r.x0 + r.x1) / 2 - 0.5;
    const offB = (r.y0 + r.y1) / 2 - 0.5;
    pos[a.k] += offA * a.v;
    pos[b.k] += offB * b.v;
    pos[thin.k] += outward * depthOffset;
    mesh.position.copy(pos);
    mesh.castShadow = false;
    group.add(mesh);
  });
}

// --- public API --------------------------------------------------------

export class HouseMaterialController {
  constructor(root) {
    this.root = root;
    this.groups = collectByMaterialName(root);
    // Every mesh participates in shadows, including MAT_Foundation and
    // anything else this controller never touches the material of.
    root.traverse((obj) => {
      if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
    });
    this.created = [];
    this.barGroup = new THREE.Group();
    this.barGroup.name = 'GrilleBars';
    root.parent && root.parent.add(this.barGroup);
    const box = new THREE.Box3().setFromObject(root);
    this.houseCenter = box.getCenter(new THREE.Vector3());
  }

  // Builds ONE material for the whole category and assigns that same
  // instance to every mesh in the group (see texturedMaterial's comment for
  // why sharing matters on mobile).
  _assign(matName, mat) {
    const meshes = this.groups.get(matName);
    if (!meshes || !meshes.length) return;
    // The replacement must keep carrying the MAT_* name forward — this.groups
    // was captured once from the original GLB materials, but every apply()
    // after the first is matching against whatever material is on the mesh
    // *right now* (i.e. last apply's replacement), so a nameless material
    // would silently stop matching after a single successful swap.
    mat.name = matName;
    meshes.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = mats.map((m) => (m && m.name === matName ? mat : m));
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
    this.created.push(mat);
  }

  apply(selections) {
    this.created.forEach(disposeMaterial);
    this.created = [];
    while (this.barGroup.children.length) {
      const c = this.barGroup.children.pop();
      c.geometry.dispose();
      this.barGroup.remove(c);
    }

    const siding = optionById('siding', selections.siding);
    const roofing = optionById('roofing', selections.roofing);
    const trim = optionById('trim', selections.trim);
    const frame = optionById('windowFrame', selections.windowFrame);
    const glass = optionById('windowGlass', selections.windowGlass);
    const doorColor = optionById('doorColor', selections.doorColor);
    const hardware = optionById('doorHardware', selections.doorHardware);

    const sidingTex = getSidingTexture(siding.id, siding.color, siding.pattern);
    const roofTex = getRoofingTexture(roofing.id, roofing.color);
    const trimTex = getTrimTexture(trim.id, trim.color);

    this._assign(MAT.SIDING, texturedMaterial(sidingTex, { roughness: siding.roughness }));
    this._assign(MAT.ROOFING, texturedMaterial(roofTex, { roughness: roofing.roughness }));
    this._assign(MAT.TRIM, texturedMaterial(trimTex, { roughness: trim.roughness }));
    this._assign(MAT.WINDOW_FRAME, flatMaterial(frame.color, frame.roughness));
    this._assign(MAT.WINDOW_GLASS, glassMaterial(glass));
    this._assign(MAT.DOOR_SLAB, flatMaterial(doorColor.color, doorColor.roughness));
    this._assign(MAT.DOOR_GLASS, glassMaterial(glass));
    this._assign(MAT.DOOR_HARDWARE, hardwareMaterial(hardware));
    // MAT_Foundation is intentionally left untouched — fixed material, see ASSET-SPEC.md §5.

    const barMat = flatMaterial(frame.color, frame.roughness);
    this.created.push(barMat);
    const rects = [...styleBars(selections.windowStyle), ...grilleBars(selections.windowGrille)];
    if (rects.length) {
      (this.groups.get(MAT.WINDOW_GLASS) || []).forEach((glassMesh) => {
        buildBarsForGlass(glassMesh, rects, barMat, this.houseCenter, this.barGroup);
      });
    }

    const doorOption = optionById('doorStyle', selections.doorStyle);
    const doorRects = doorOption.lites === 'full'
      ? [{ x0: 0.03, y0: 0.5, x1: 0.97, y1: 0.54 }, { x0: 0.48, y0: 0.05, x1: 0.52, y1: 0.95 }]
      : doorOption.lites === 'half'
        ? [{ x0: 0.03, y0: 0.5, x1: 0.97, y1: 0.54 }]
        : [];
    if (doorRects.length) {
      (this.groups.get(MAT.DOOR_GLASS) || []).forEach((glassMesh) => {
        buildBarsForGlass(glassMesh, doorRects, barMat, this.houseCenter, this.barGroup);
      });
    }
  }

  dispose() {
    this.created.forEach(disposeMaterial);
    this.barGroup.children.forEach((c) => c.geometry.dispose());
    if (this.barGroup.parent) this.barGroup.parent.remove(this.barGroup);
  }
}
