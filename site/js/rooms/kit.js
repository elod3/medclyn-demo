/* Trusa comună pentru interioarele calculatorului.
 *
 * Toate modulele din js/rooms/ construiesc cu ea, ca materialele, scara UV și
 * încărcarea asseturilor să fie la fel peste tot. Unitatea e metrul.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const texCache = new Map();
const glbCache = new Map();

// Cheia include scara: o textură încărcată e legată de o singură repetare.
function tex(url, srgb, tile = 1){
  const key = url + (srgb ? '#s' : '') + '@' + tile;
  if (texCache.has(key)) return texCache.get(key);
  const t = texLoader.load(url, undefined, undefined, () => {});
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile, 1 / tile);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

/**
 * Material PBR dintr-un set ambientCG / Poly Haven descărcat în tex/rooms/<dir>/.
 * Fișierele așteptate: color.jpg, normal.jpg (convenția OpenGL), rough.jpg,
 * opțional ao.jpg și metal.jpg (le declari în `maps`).
 * `tile` = câți metri acoperă o repetare a texturii. Funcționează doar cu
 * geometriile din kit (box, plane), care au UV-uri în metri.
 */
export function pbr(dir, opts = {}){
  const base = 'tex/rooms/' + dir + '/';
  const maps = opts.maps || ['color', 'normal', 'rough'];
  const tile = opts.tile || 1;
  const p = {
    color: opts.tint !== undefined ? opts.tint : 0xffffff,
    roughness: opts.roughness !== undefined ? opts.roughness : 1,
    metalness: opts.metalness !== undefined ? opts.metalness : 0,
    envMapIntensity: opts.env !== undefined ? opts.env : 1
  };
  if (maps.includes('color')) p.map = tex(base + 'color.jpg', true, tile);
  if (maps.includes('normal')){ p.normalMap = tex(base + 'normal.jpg', false, tile); p.normalScale = new THREE.Vector2(opts.normal || 1, opts.normal || 1); }
  if (maps.includes('rough')) p.roughnessMap = tex(base + 'rough.jpg', false, tile);
  if (maps.includes('ao')) p.aoMap = tex(base + 'ao.jpg', false, tile);
  if (maps.includes('metal')) p.metalnessMap = tex(base + 'metal.jpg', false, tile);
  const Mat = opts.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Mat(p);
  if (opts.clearcoat){ m.clearcoat = opts.clearcoat; m.clearcoatRoughness = opts.clearcoatRoughness || 0.08; }
  return m;
}

/** Material simplu, fără textură: vopsea, inox, plastic, sticlă. */
export function flat(color, opts = {}){
  const Mat = opts.physical || opts.transmission || opts.clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Mat({ color, roughness: opts.roughness ?? 0.6, metalness: opts.metalness ?? 0 });
  if (opts.clearcoat) m.clearcoat = opts.clearcoat;
  if (opts.transmission){ m.transmission = opts.transmission; m.thickness = opts.thickness || 0.01; m.ior = 1.5; }
  if (opts.opacity !== undefined){ m.transparent = true; m.opacity = opts.opacity; }
  if (opts.emissive){ m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity || 1; }
  return m;
}

/* Rescrie UV-urile unei BoxGeometry ca fiecare față să aibă coordonate în metri. */
function meterUV(g, w, h, d){
  const uv = g.attributes.uv;
  // ordinea fețelor în BoxGeometry: +x, -x, +y, -y, +z, -z; 4 vârfuri pe față
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++){
    for (let v = 0; v < 4; v++){
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  }
  uv.needsUpdate = true;
  g.setAttribute('uv1', uv.clone());   // pentru aoMap
  return g;
}

/** Cutie cu baza pe y = 0 (dacă `base` e true) și UV-uri în metri. */
export function box(w, h, d, mat, x = 0, y = 0, z = 0, base = true){
  const g = meterUV(new THREE.BoxGeometry(w, h, d), w, h, d);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, base ? y + h / 2 : y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Plan orizontal la înălțimea y, UV în metri (pardoseli, blaturi, benzi). */
export function floorPlane(w, d, mat, x = 0, y = 0, z = 0){
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
  g.setAttribute('uv1', uv.clone());
  const m = new THREE.Mesh(g, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

/** Cilindru vertical cu baza pe y (țevi, picioare de masă, stâlpi rotunzi). */
export function cyl(r, h, mat, x = 0, y = 0, z = 0, seg = 16){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/**
 * Model GLB din models/. Promite un obiect normalizat: baza pe y = 0, centrat
 * pe x/z, scalat ca `size` (metri) să fie pe axa `axis` ('y', 'x' sau 'z').
 * Fiecare apel întoarce o clonă nouă.
 */
export function glb(file, size, axis = 'y'){
  if (!glbCache.has(file)){
    glbCache.set(file, new Promise((res) => {
      gltfLoader.load('models/' + file, (g) => {
        g.scene.traverse((o) => { if (o.isMesh){ o.castShadow = o.receiveShadow = true; } });
        res(g.scene);
      }, undefined, () => res(null));
    }));
  }
  return glbCache.get(file).then((src) => {
    if (!src) return null;
    const obj = src.clone(true);
    const b = new THREE.Box3().setFromObject(obj);
    const s = b.getSize(new THREE.Vector3());
    obj.position.set(-(b.min.x + s.x / 2), -b.min.y, -(b.min.z + s.z / 2));
    const holder = new THREE.Group();
    holder.add(obj);
    holder.scale.setScalar(size / (s[axis] || 1));
    const wrap = new THREE.Group();
    wrap.add(holder);
    return wrap;
  });
}

/** Multe copii ale aceleiași cutii într-un singur draw call. `list` = [[x,y,z,rotY], ...]. */
export function instances(w, h, d, mat, list){
  const g = meterUV(new THREE.BoxGeometry(w, h, d), w, h, d);
  g.translate(0, h / 2, 0);
  const im = new THREE.InstancedMesh(g, mat, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  list.forEach(([x, y, z, r = 0], i) => {
    e.set(0, r, 0); q.setFromEuler(e); p.set(x, y, z);
    im.setMatrixAt(i, m4.compose(p, q, one));
  });
  im.castShadow = im.receiveShadow = true;
  return im;
}

/** Marchează un obiect ca prins de un perete: se ascunde odată cu peretele. N = -z, S = +z, E = +x, W = -x, C = tavan. */
export function onWall(obj, side){ obj.userData.wall = side; return obj; }

export { THREE };
