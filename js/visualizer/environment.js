// Minimal suburban ground plane: grass, a driveway, a front walkway, and a
// few foundation shrubs. Kept deliberately low-poly and low-texture — this
// exists to ground the house in something believable without competing
// with it or costing much of the frame/texture budget.

import * as THREE from 'three';
import { getGrassTexture, getConcreteTexture, applyRepeat } from './textures.js';

function cloneWithRepeat(tex, repeat) {
  if (!tex) return null;
  const t = tex.clone();
  t.needsUpdate = true;
  applyRepeat(t, repeat);
  return t;
}

// A soft radial-gradient "contact shadow" decal under the house footprint —
// cheap grounding that reads as depth/weight without a real ambient-
// occlusion pass. Sized generously (13x11) since all three house configs
// currently share the same ~9x7 placeholder footprint; re-tune per house
// once real, differently-sized models arrive.
function buildContactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.4)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function buildEnvironment() {
  const group = new THREE.Group();
  group.name = 'Environment';

  const grass = getGrassTexture();
  const groundMat = new THREE.MeshStandardMaterial({
    map: cloneWithRepeat(grass.map, { x: 26, y: 26 }),
    roughnessMap: cloneWithRepeat(grass.roughnessMap, { x: 26, y: 26 }),
    roughness: grass.roughnessMap ? 1 : 0.95,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(50, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const concrete = getConcreteTexture();
  const driveMat = new THREE.MeshStandardMaterial({
    map: cloneWithRepeat(concrete.map, { x: 2, y: 5 }),
    normalMap: cloneWithRepeat(concrete.normalMap, { x: 2, y: 5 }),
    roughness: 0.92,
  });
  const driveway = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 11), driveMat);
  driveway.rotation.x = -Math.PI / 2;
  driveway.position.set(5.2, 0.012, 8.5);
  driveway.receiveShadow = true;
  group.add(driveway);

  const walkMat = new THREE.MeshStandardMaterial({
    map: cloneWithRepeat(concrete.map, { x: 1, y: 4 }),
    normalMap: cloneWithRepeat(concrete.normalMap, { x: 1, y: 4 }),
    roughness: 0.92,
  });
  const walkway = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 5.2), walkMat);
  walkway.rotation.x = -Math.PI / 2;
  walkway.position.set(1.15, 0.013, 6.4);
  walkway.receiveShadow = true;
  group.add(walkway);

  const shadowMat = new THREE.MeshBasicMaterial({
    map: buildContactShadowTexture(), transparent: true, depthWrite: false, toneMapped: false,
  });
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(13, 11), shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.008, 0);
  group.add(contactShadow);

  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x3c4a35, roughness: 0.95 });
  const shrubGeo = new THREE.IcosahedronGeometry(0.42, 1);
  const shrubSpots = [[-4.0, 4.05], [-1.7, 4.05], [2.6, 4.05], [4.3, 4.05]];
  shrubSpots.forEach(([x, z], i) => {
    const s = new THREE.Mesh(shrubGeo, shrubMat);
    s.position.set(x, 0.36, z);
    s.scale.setScalar(0.8 + ((i * 37) % 10) / 30);
    s.castShadow = true;
    s.receiveShadow = true;
    group.add(s);
  });

  return group;
}
