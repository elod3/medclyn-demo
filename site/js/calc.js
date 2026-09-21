/* Calculator de suprafață.
 *
 * Hala se construiește în 3D din trei numere, iar necesarul se calculează pe
 * prețurile publice reale din magazinul MedClyn. Pereții dinspre cameră se
 * ascund singuri, ca să se vadă mereu înăuntru.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PRICE = {
  placa:    252.88,   // lei / m²
  imbinare:  57.36,   // lei / ml
  coltar:    27.37,   // lei / ml
  plinta:   111.27,   // lei / ml
  adeziv:    53.00    // lei / buc, ~1 la 3 m²
};
const PANEL_W = 1.22;   // lățimea utilă a plăcii, m
const HUMAN_H = 1.75;   // reper de scară

// Scara de mărimi. Treptele din mijloc au suprafața șantierelor publicate de
// MedClyn (AYT ~300 m², Bona Avis 616 m², Ursus 1.000 m²), cu tot cu tavanul.
export const PRESETS = [
  { id: 'baie',     name: 'Grup sanitar',   noun: 'grup sanitar',   L: 2.4, W: 1.8, H: 2.6 },
  { id: 'cabinet',  name: 'Cabinet medical', noun: 'cabinet',       L: 4.5, W: 3.6, H: 2.8 },
  { id: 'macelarie', name: 'Măcelărie',     noun: 'măcelărie',      L: 14,  W: 9,   H: 3.5 },
  { id: 'abator',   name: 'Abator',         noun: 'abator',         L: 24,  W: 12,  H: 4.2 },
  { id: 'fabrica',  name: 'Fabrică',        noun: 'fabrică',        L: 32,  W: 18,  H: 5 },
  { id: 'logistic', name: 'Hală logistică', noun: 'hală logistică', L: 120, W: 60,  H: 12 }
];

const ROOM_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const ROOM_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform vec2  uSize;      // metri reali ai peretelui
  uniform float uPanel;     // lățimea plăcii, m
  uniform float uPlinth;    // 1 = desenează plinta
  uniform float uGrid;      // 1 = caroiaj metric (podea)
  uniform float uMajor;     // pasul liniilor cyan: 5, 10 sau 25 m, după mărimea halei
  uniform vec3  uBase;

  // linie de 1 px indiferent de zoom, ca intr-un desen tehnic
  float gridLine(vec2 m, float step, float w){
    vec2 g = abs(fract(m / step - 0.5) - 0.5) * step;
    vec2 d = fwidth(m) * w;
    vec2 l = 1.0 - smoothstep(vec2(0.0), d, g);
    return max(l.x, l.y);
  }

  void main(){
    vec2 m = vUv * uSize;

    if (uGrid > 0.5){
      vec3 c = uBase * 0.30;
      float fine = uMajor > 7.0 ? uMajor / 5.0 : 1.0;   // 1 m, 2 m sau 5 m
      c = mix(c, uBase * 0.95, gridLine(m, fine, 1.0) * 0.70);
      c = mix(c, vec3(0.14, 0.75, 0.80), gridLine(m, uMajor, 1.5) * 0.80);   // linii principale, cyan
      gl_FragColor = vec4(c, 1.0);
      return;
    }

    float sx = abs(fract(m.x / uPanel + 0.5) - 0.5) * uPanel;
    float seam = smoothstep(0.020, 0.004, sx);
    vec3 c = uBase * (0.70 + 0.34 * vUv.y);
    c = mix(c, uBase * 0.70, seam * 0.8);
    float plinth = smoothstep(0.155, 0.145, m.y) * uPlinth;
    c = mix(c, vec3(0.000, 0.227, 0.518), plinth);   // plinta in navy #003a84
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function createCalc(opts){
  const el = opts.container;
  const canvas = opts.canvas;
  const reduced = opts.reduced === true;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x00132b);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);

  const group = new THREE.Group();
  scene.add(group);

  function surface(base, plinth, grid){
    const u = {
      uSize:   { value: new THREE.Vector2(1, 1) },
      uPanel:  { value: PANEL_W },
      uPlinth: { value: plinth },
      uGrid:   { value: grid ? 1 : 0 },
      uMajor:  { value: 5 },
      // ShaderMaterial nu face conversia de iesire liniar -> sRGB, deci pastram
      // valorile hex brute: ce scrie shaderul e exact culoarea de pe ecran.
      uBase:   { value: new THREE.Color().setHex(base, THREE.LinearSRGBColorSpace) }
    };
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({ vertexShader: ROOM_VERT, fragmentShader: ROOM_FRAG,
        uniforms: u, side: THREE.DoubleSide })
    );
    mesh.userData.u = u;
    group.add(mesh);
    return mesh;
  }

  const wN = surface(0xe8ecec, 1), wS = surface(0xe8ecec, 1);
  const wE = surface(0xdde3e3, 1), wW = surface(0xdde3e3, 1);
  const floorM = surface(0x2d5a8f, 0, true);
  const ceilM  = surface(0xf1f0ea, 0);

  // normala exterioară a fiecărei suprafețe: ascundem ce stă între cameră și interior
  const walls = [
    { m: wN, n: new THREE.Vector3(0, 0, -1) },
    { m: wS, n: new THREE.Vector3(0, 0,  1) },
    { m: wE, n: new THREE.Vector3( 1, 0, 0) },
    { m: wW, n: new THREE.Vector3(-1, 0, 0) },
    { m: ceilM, n: new THREE.Vector3(0, 1, 0) }
  ];

  // siluetă de 1,75 m — fără ea nu se simte scara halei
  const human = new THREE.Group();
  const hMat = new THREE.MeshBasicMaterial({ color: 0x24bfcc });   // silueta in cyan-ul lor: se vede pe podea
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 1.40, 10), hMat);
  body.position.y = 0.70;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), hMat);
  head.position.y = HUMAN_H - 0.155;
  human.add(body, head);
  group.add(human);

  /* Obiecte de scară (modele CC0 din site/models). Fiecare se aduce la
     înălțimea lui reală în metri; lipsa unui fișier nu strică nimic. */
  scene.add(new THREE.HemisphereLight(0xf1f0ea, 0x0b2447, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(0.6, 1, 0.45);
  scene.add(sun);

  // h = înălțimea reală în metri, w = lățimea reală (când înălțimea nu e reperul),
  // rot = rotația care întoarce fața modelului spre +Z (spre interiorul halei).
  const MODELS = {
    toilet:   { h: 0.78, rot: Math.PI },
    desk:     { h: 0.76, rot: 0 },
    counter:  { h: 0.90, rot: 0, steel: true },
    pallet:   { w: 1.20, rot: 0 },
    forklift: { h: 2.30, rot: 0 },
    truck:    { h: 3.40, rot: 0 }
  };
  // [obiect, x ca fracție din L, z ca fracție din W, rotație]
  // Originea e colțul (-L/2, -W/2); peretele din spate e la z = 0.
  const SETS = [
    { max: 10,       items: [['toilet', 0.72, 0.0, 0]] },
    { max: 40,       items: [['desk', 0.62, 0.0, 0]] },
    { max: 240,      items: [['counter', 0.36, 0.0, 0], ['counter', 0.58, 0.0, 0], ['counter', 0.47, 0.52, 0]] },
    { max: 400,      items: [['counter', 0.30, 0.0, 0], ['counter', 0.42, 0.0, 0], ['load', 0.70, 0.10, 0], ['load', 0.78, 0.10, 0], ['forklift', 0.60, 0.52, -0.7]] },
    { max: 1500,     items: [['rack', 0.28, 0.0, 0], ['rack', 0.56, 0.0, 0], ['load', 0.74, 0.50, 0.2], ['forklift', 0.46, 0.52, -0.7], ['forklift', 0.80, 0.30, 2.4]] },
    { max: Infinity, items: [['rack', 0.14, 0.0, 0], ['rack', 0.24, 0.0, 0], ['rack', 0.34, 0.0, 0], ['rack', 0.44, 0.0, 0], ['rack', 0.54, 0.0, 0],
                             ['truck', 0.36, 0.55, Math.PI / 2], ['truck', 0.64, 0.55, Math.PI / 2], ['truck', 0.64, 0.75, Math.PI / 2],
                             ['forklift', 0.48, 0.30, -0.7], ['forklift', 0.78, 0.36, 2.4], ['load', 0.20, 0.34, 0]] }
  ];
  const templates = {};
  const propGroup = new THREE.Group();
  group.add(propGroup);
  let propSet = -1;
  const placed = [];   // { obj, fx, fz, d }  d = adâncimea, ca obiectul să stea lipit de perete

  const steel = new THREE.MeshStandardMaterial({ color: 0xc3ccd4, metalness: 0.7, roughness: 0.32 });
  const cardboard = new THREE.MeshStandardMaterial({ color: 0xb58a57, roughness: 0.9 });
  const upright = new THREE.MeshStandardMaterial({ color: 0x1f4f9c, roughness: 0.5 });
  const beam = new THREE.MeshStandardMaterial({ color: 0xe0662a, roughness: 0.5 });

  function box(w, h, d, mat, x, y, z){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }
  function withDepth(obj){
    const b = new THREE.Box3().setFromObject(obj);
    obj.userData.d = b.max.z - b.min.z;
    return obj;
  }

  // palet încărcat: paletul real + marfa ambalată
  function makeLoad(){
    const g = new THREE.Group();
    if (templates.pallet) g.add(templates.pallet.clone());
    g.add(box(1.14, 0.9, 1.14, cardboard, 0, 0.144 + 0.45, 0));
    return withDepth(g);
  }
  // raft paletizat: stâlpi albaștri, grinzi portocalii, 3 travee × 3 niveluri, 4,2 m
  function makeRack(){
    const g = new THREE.Group();
    const bay = 2.8, depth = 1.1, H = 4.2, bays = 3;
    for (let i = 0; i <= bays; i++){
      const x = (i - bays / 2) * bay;
      g.add(box(0.09, H, 0.09, upright, x, H / 2, -depth / 2));
      g.add(box(0.09, H, 0.09, upright, x,  H / 2,  depth / 2));
    }
    for (const y of [0.15, 1.55, 2.95]){
      g.add(box(bay * bays, 0.12, 0.06, beam, 0, y, -depth / 2));
      g.add(box(bay * bays, 0.12, 0.06, beam, 0, y,  depth / 2));
      for (let i = 0; i < bays; i++){
        for (const dx of [-0.65, 0.65]){
          const l = makeLoad();
          l.position.set((i - bays / 2 + 0.5) * bay + dx, y + 0.06, 0);
          g.add(l);
        }
      }
    }
    return withDepth(g);
  }

  const loader = new GLTFLoader();
  Object.entries(MODELS).forEach(([name, cfg]) => {
    loader.load('models/' + name + '.glb', (gltf) => {
      const obj = gltf.scene;
      if (cfg.steel) obj.traverse((o) => { if (o.isMesh) o.material = steel; });
      const box3 = new THREE.Box3().setFromObject(obj);
      const size = box3.getSize(new THREE.Vector3());
      const k = cfg.w ? cfg.w / (size.x || 1) : cfg.h / (size.y || 1);
      obj.position.set(-(box3.min.x + size.x / 2), -box3.min.y, -(box3.min.z + size.z / 2));
      const holder = new THREE.Group();
      holder.add(obj);
      holder.scale.setScalar(k);
      holder.rotation.y = cfg.rot;
      const wrap = new THREE.Group();
      wrap.add(holder);
      templates[name] = withDepth(wrap);
      if (name === 'pallet'){ templates.load = makeLoad(); templates.rack = makeRack(); }
      propSet = -1;   // reconstruiește setul curent cu modelul nou
    }, undefined, () => {});
  });
  templates.load = makeLoad();
  templates.rack = makeRack();

  function pickSet(){
    const a = dims.L * dims.W;
    return SETS.findIndex((st) => a <= st.max);
  }
  function buildProps(){
    const i = pickSet();
    if (i === propSet) return;
    propSet = i;
    propGroup.clear();
    placed.length = 0;
    for (const [name, fx, fz, r] of SETS[i].items){
      const t = templates[name];
      if (!t) continue;
      const o = t.clone();
      o.rotation.y = r;
      propGroup.add(o);
      placed.push({ obj: o, fx, fz, d: fz === 0 ? t.userData.d / 2 + 0.05 : 0 });
    }
  }
  function placeProps(){
    const { L, W } = shown;
    for (const p of placed) p.obj.position.set(-L / 2 + p.fx * L, 0, -W / 2 + p.fz * W + p.d);
  }

  const dims  = { L: 24, W: 12, H: 4.2, ceil: true };
  const shown = { L: 24, W: 12, H: 4.2 };

  function layout(){
    const { L, W, H } = shown;
    wN.scale.set(L, H, 1); wN.position.set(0, H / 2, -W / 2); wN.rotation.set(0, 0, 0);
    wS.scale.set(L, H, 1); wS.position.set(0, H / 2,  W / 2); wS.rotation.set(0, 0, 0);
    wE.scale.set(W, H, 1); wE.position.set( L / 2, H / 2, 0); wE.rotation.set(0, -Math.PI / 2, 0);
    wW.scale.set(W, H, 1); wW.position.set(-L / 2, H / 2, 0); wW.rotation.set(0,  Math.PI / 2, 0);
    floorM.scale.set(L, W, 1); floorM.position.set(0, 0, 0); floorM.rotation.set(-Math.PI / 2, 0, 0);
    ceilM.scale.set(L, W, 1);  ceilM.position.set(0, H, 0);  ceilM.rotation.set(Math.PI / 2, 0, 0);
    ceilM.visible = dims.ceil;

    wN.userData.u.uSize.value.set(L, H);
    wS.userData.u.uSize.value.set(L, H);
    wE.userData.u.uSize.value.set(W, H);
    wW.userData.u.uSize.value.set(W, H);
    floorM.userData.u.uSize.value.set(L, W);
    const span = Math.max(L, W);
    const major = span > 70 ? 25 : span > 36 ? 10 : 5;
    if (floorM.userData.u.uMajor.value !== major){
      floorM.userData.u.uMajor.value = major;
      put('grid-tag', 'caroiaj ' + (major > 7 ? major / 5 : 1) + ' m · cyan ' + major + ' m');
    }
    ceilM.userData.u.uSize.value.set(L, W);

    buildProps();
    placeProps();
    human.position.set(-L / 2 + Math.min(1.5, L * 0.3), 0, W / 2 - Math.min(1.7, W * 0.35));
  }

  const nf0 = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const lei = (v) => nf0.format(Math.round(v)) + ' lei';
  const put = (id, txt) => { const n = document.getElementById(id); if (n) n.textContent = txt; };

  function compute(){
    const { L, W, H } = dims;
    const perim = 2 * (L + W);
    const ariaPereti = perim * H;
    const ariaTavan = dims.ceil ? L * W : 0;
    const arie = ariaPereti + ariaTavan;

    const imbinari = (perim / PANEL_W) * H + (dims.ceil ? (W / PANEL_W) * L : 0);
    const colturi  = 4 * H + (dims.ceil ? perim : 0);
    const plinta   = perim;
    const adeziv   = Math.ceil(arie / 3);

    const vPlaca  = arie * PRICE.placa;
    const vImbin  = imbinari * PRICE.imbinare;
    const vColt   = colturi * PRICE.coltar;
    const vPlinta = plinta * PRICE.plinta;
    const vAdeziv = adeziv * PRICE.adeziv;
    const total   = vPlaca + vImbin + vColt + vPlinta + vAdeziv;

    put('q-placa',  nf0.format(Math.round(arie)) + ' m²');      put('v-placa',  lei(vPlaca));
    put('q-imbin',  nf0.format(Math.round(imbinari)) + ' ml');  put('v-imbin',  lei(vImbin));
    put('q-colt',   nf0.format(Math.round(colturi)) + ' ml');   put('v-colt',   lei(vColt));
    put('q-plinta', nf0.format(Math.round(plinta)) + ' ml');    put('v-plinta', lei(vPlinta));
    put('q-adeziv', nf0.format(adeziv) + ' buc');               put('v-adeziv', lei(vAdeziv));
    put('q-total',  nf0.format(Math.round(arie)) + ' m²');      put('v-total',  lei(total));
    const p = PRESETS.find((q) => q.L === L && q.W === W && q.H === H);
    const noun = p ? p.noun : (L * W < 40 ? 'încăpere' : 'hală');
    markLadder(p);
    put('room-tag', noun + ' ' + nf1.format(L) + ' × ' + nf1.format(W) + ' × ' + nf1.format(H) + ' m');
  }

  function clampNum(v, lo, hi, dflt){
    const n = parseFloat(v);
    return Math.min(hi, Math.max(lo, isFinite(n) ? n : dflt));
  }

  const qs = new URLSearchParams(location.search);
  ['l', 'w', 'h'].forEach((k) => {
    if (!qs.has(k)) return;
    const node = document.getElementById('in-' + k);
    if (node) node.value = qs.get(k);
  });

  function readInputs(){
    dims.L = clampNum(document.getElementById('in-l').value, 1.2, 120, 24);
    dims.W = clampNum(document.getElementById('in-w').value, 1.2, 120, 12);
    dims.H = clampNum(document.getElementById('in-h').value, 2, 14, 4.2);
    dims.ceil = document.getElementById('in-ceil').checked;
    compute();
  }
  ['in-l', 'in-w', 'in-h'].forEach((id) => {
    const n = document.getElementById(id);
    if (n) n.addEventListener('input', readInputs);
  });
  const ceilBox = document.getElementById('in-ceil');
  if (ceilBox) ceilBox.addEventListener('change', readInputs);

  const note = document.getElementById('cta-note');
  const cta = document.getElementById('cta');
  if (cta && note){
    cta.addEventListener('click', () => {
      note.innerHTML = '<strong>Demo — butonul nu trimite nimic.</strong> În site-ul final generează oferta în PDF cu necesarul deja completat, o trimite pe mail și creează lead-ul în CRM cu dimensiunile halei.';
    });
  }

  /* Scara de mărimi: un clic și hala se reconstruiește. Amprenta fiecărei
     trepte e desenată pe aceeași scară logaritmică, ca saltul să se vadă. */
  const ladder = document.getElementById('ladder');
  const steps = [];
  const fpSize = (m) => 7 + 37 * Math.log(m / 1.8) / Math.log(120 / 1.8);
  function markLadder(p){
    steps.forEach((b) => b.setAttribute('aria-pressed', p && b.dataset.id === p.id ? 'true' : 'false'));
  }
  function stepArea(p){
    return 2 * (p.L + p.W) * p.H + (dims.ceil ? p.L * p.W : 0);
  }
  if (ladder){
    PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'step';
      b.dataset.id = p.id;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<span class="fp"><i></i></span><b></b><span></span>';
      const fp = b.querySelector('.fp i');
      fp.style.setProperty('--fw', fpSize(p.L).toFixed(1) + 'px');
      fp.style.setProperty('--fh', fpSize(p.W).toFixed(1) + 'px');
      b.querySelector('b').textContent = p.name;
      b.addEventListener('click', () => {
        document.getElementById('in-l').value = p.L;
        document.getElementById('in-w').value = p.W;
        document.getElementById('in-h').value = p.H;
        readInputs();
      });
      ladder.appendChild(b);
      steps.push(b);
    });
  }
  function labelLadder(){
    steps.forEach((b, i) => {
      b.lastElementChild.textContent = nf0.format(Math.round(stepArea(PRESETS[i]))) + ' m²';
    });
  }
  if (ceilBox) ceilBox.addEventListener('change', labelLadder);
  labelLadder();

  readInputs();
  layout();
  shown.L = dims.L; shown.W = dims.W; shown.H = dims.H;

  /* Cote proiectate in ecran: fara ele, cutia alba nu spune nimic. */
  const dimBox = document.createElement('div');
  dimBox.className = 'dims';
  el.appendChild(dimBox);

  function makeDim(cls){
    const n = document.createElement('span');
    n.className = 'dim ' + cls;
    dimBox.appendChild(n);
    return n;
  }
  const dimL = makeDim('l'), dimW = makeDim('w'), dimH = makeDim('h'), dimA = makeDim('a');
  const proj = new THREE.Vector3();

  function placeDim(node, x, y, z, text){
    proj.set(x, y, z).project(camera);
    if (proj.z > 1){ node.style.opacity = '0'; return; }
    node.style.opacity = '1';
    const cx = Math.min(95, Math.max(5, (proj.x * 0.5 + 0.5) * 100));
    const cy = Math.min(94, Math.max(6, (-proj.y * 0.5 + 0.5) * 100));
    node.style.left = cx.toFixed(2) + '%';
    node.style.top  = cy.toFixed(2) + '%';
    node.textContent = text;
  }

  function updateDims(){
    const { L, W, H } = shown;
    const arie = 2 * (dims.L + dims.W) * dims.H + (dims.ceil ? dims.L * dims.W : 0);
    placeDim(dimL, 0, 0, W / 2 + 1.1, nf1.format(dims.L) + ' m');
    placeDim(dimW, L / 2 + 1.1, 0, 0, nf1.format(dims.W) + ' m');
    placeDim(dimH, -L / 2 - 0.9, H / 2, W / 2, nf1.format(dims.H) + ' m');
    placeDim(dimA, 0, 0.05, 0, nf0.format(Math.round(arie)) + ' m² de placat');
  }

  // reper de incadrare: hala implicita de 24 × 12 × 4,2 m
  const REF_DIAG = Math.hypot(24, 12, 4.2);

  let angle = 0.85;
  const dir = new THREE.Vector3();

  function resize(){
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(dt){
    shown.L += (dims.L - shown.L) * 0.12;
    shown.W += (dims.W - shown.W) * 0.12;
    shown.H += (dims.H - shown.H) * 0.12;
    layout();

    if (!reduced) angle += dt * 0.11;

    // Camera incadreaza sfera halei, apoi o corectie sublineara: incaperile mici
    // raman mai departe, halele mari se apropie. Fara corectie orice hala ar
    // parea la fel de mare; fara incadrare, hala gigant iese din cadru.
    const diag = Math.hypot(shown.L, shown.W, shown.H);
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfMin = Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
    const fit = (diag / 2) / Math.sin(halfMin);
    const bias = Math.min(2.0, Math.max(0.92, Math.pow(diag / REF_DIAG, -0.3)));
    const dist = fit * 0.78 * bias;

    camera.position.set(Math.sin(angle) * dist, shown.H * 0.50 + dist * 0.42, Math.cos(angle) * dist);
    camera.lookAt(0, shown.H * 0.28, 0);

    for (const w of walls){
      if (w.m === ceilM && !dims.ceil){ w.m.visible = false; continue; }
      dir.copy(camera.position).sub(w.m.position);
      w.m.visible = dir.dot(w.n) < 0;
    }
    renderer.render(scene, camera);
    updateDims();
  }

  return { render, resize };
}
