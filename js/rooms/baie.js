/* Grup sanitar — treaptă ≤ 10 m² (interior public/personal).
 *
 * Sub ~4,7 m² utili: un singur WC suspendat + un lavoar (cotele din
 * research/rooms/baie.md). Peste acel prag, în interiorul treptei: un rând de
 * cabine WC cu pereți despărțitori HPL + un blat cu mai multe lavoare.
 * Pereții și tavanul sunt ai calculatorului; aici punem doar ce e liber sau
 * lipit de perete (onWall).
 */
import { THREE, pbr, flat, floorPlane, onWall } from './kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// robust si la limite inversate (poate aparea la forme foarte alungite ale
// camerei, la marginile treptei) — trateaza [a,b] ca interval neordonat.
const clamp = (v, a, b) => (a <= b ? Math.min(b, Math.max(a, v)) : Math.min(a, Math.max(b, v)));

/* ---------- geometrie mică, locală (nu există în kit.js) ---------- */

function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0, base = true){
  const rr = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const g = new RoundedBoxGeometry(w, h, d, 2, rr);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, base ? y + h / 2 : y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Corp de revoluție (vas WC, lavoar) din profilul [r,y]; se poate scala neuniform după. */
function lathe(profile, mat, seg = 28){
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  const g = new THREE.LatheGeometry(pts, seg);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Bară orizontală (mâner/bară de sprijin), axă de-a lungul x local. */
function hbar(length, r, mat){
  const grp = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, length, 12), mat);
  tube.rotation.z = Math.PI / 2;
  tube.castShadow = tube.receiveShadow = true;
  grp.add(tube);
  for (const sx of [-1, 1]){
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.7, r * 1.7, 0.015, 12), mat);
    flange.rotation.z = Math.PI / 2;
    flange.position.x = sx * (length / 2 - 0.01);
    grp.add(flange);
  }
  return grp;
}

/* pune un obiect pe un perete: 'N'=z=-W/2 'S'=z=+W/2 'E'=x=+L/2 'W'=x=-L/2.
 * `along` = poziția pe perete (x pt N/S, z pt E/W). Obiectul e modelat cu
 * fața liberă spre +z local; rotația îl orientează spre interiorul camerei. */
function wallPose(side, L, W, along){
  switch (side){
    case 'N': return { x: along, z: -W / 2, rot: 0 };
    case 'S': return { x: along, z: W / 2, rot: Math.PI };
    case 'E': return { x: L / 2, z: along, rot: -Math.PI / 2 };
    case 'W': return { x: -L / 2, z: along, rot: Math.PI / 2 };
    default:  return { x: 0, z: 0, rot: 0 };   // 'C' = tavan, pozitia ramane cea data de caller
  }
}
function mount(g, obj, side, L, W, along){
  const p = wallPose(side, L, W, along);
  obj.position.x += p.x; obj.position.z += p.z;
  obj.rotation.y += p.rot;
  onWall(obj, side);
  g.add(obj);
}

/* ---------- unități sanitare ---------- */

// WC suspendat: vas + capac + placă de clătire cromată + hârtie igienică.
// Modelat cu spatele lipit de perete (z local 0), proeminent spre +z.
function wcUnit(ceramic, plastic, chrome){
  const grp = new THREE.Group();
  // profilul e in coordonate absolute (y = inaltime reala de la pardoseala):
  // muchia bolului la 0,40 m FFL, partea de jos rotunjita ramane suspendata la ~0,16 m.
  const bowl = lathe([
    [0.045, 0.160], [0.110, 0.185], [0.155, 0.235], [0.168, 0.290],
    [0.150, 0.330], [0.185, 0.365], [0.180, 0.400]
  ], ceramic);
  bowl.scale.set(1, 1, 1.5);
  bowl.position.set(0, 0.0, 0.10);
  grp.add(bowl);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.035, 28), plastic);
  lid.scale.set(1, 1, 1.42);
  lid.position.set(0, 0.415, 0.12);
  lid.castShadow = lid.receiveShadow = true;
  grp.add(lid);

  // placa de clatire, montata pe cadrul ingropat
  const plate = rbox(0.12, 0.20, 0.014, 0.01, chrome, 0, 0.95, 0.007, false);
  grp.add(plate);
  const btnL = rbox(0.045, 0.03, 0.006, 0.006, chrome, -0.025, 1.0, 0.015, false);
  const btnR = rbox(0.045, 0.03, 0.006, 0.006, chrome, 0.025, 1.0, 0.015, false);
  grp.add(btnL, btnR);

  // suport hartie igienica, langa vas
  const holderArm = rbox(0.10, 0.02, 0.03, 0.008, chrome, 0.24, 0.6, 0.02, false);
  const holderRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 16), plastic);
  holderRoll.rotation.z = Math.PI / 2;
  holderRoll.position.set(0.24, 0.6, 0.07);
  grp.add(holderArm, holderRoll);

  return grp;
}

// bara de sprijin din spate, montata direct pe peretele WC-ului
function wcGrabBar(chrome, len){
  const bar = hbar(len, 0.017, chrome);
  bar.position.set(0, 0.85, 0.03);
  return bar;
}

// lavoar suspendat, ovalizat, cu baterie monocomanda si sifon vizibil.
function basinUnit(ceramic, chrome){
  const grp = new THREE.Group();
  // muchia lavoarului la 0,85 m FFL (cota reala, vezi research/rooms/baie.md).
  const basin = lathe([
    [0.020, 0.745], [0.150, 0.765], [0.205, 0.815], [0.225, 0.840], [0.215, 0.848]
  ], ceramic, 24);
  basin.scale.set(1.28, 1, 0.98);
  basin.position.set(0, 0.0, 0.10);
  grp.add(basin);

  const tap = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.11, 12), chrome);
  base.position.y = 0.055;
  const spout = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 8, 16, Math.PI * 0.62), chrome);
  spout.position.set(0, 0.11, 0.015);
  spout.rotation.set(Math.PI / 2, 0, Math.PI * 0.68);
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.075, 8), chrome);
  lever.rotation.z = Math.PI / 2.6;
  lever.position.set(0.02, 0.135, 0.01);
  tap.add(base, spout, lever);
  tap.position.set(0, 0.85, 0.16);
  grp.add(tap);

  // teava sifon (bottle trap) vizibila sub lavoar
  const trapTop = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 12), chrome);
  trapTop.position.set(0, 0.69, 0.08);
  const trapBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.14, 14), chrome);
  trapBottle.position.set(0, 0.58, 0.08);
  const trapElbow = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.10, 12), chrome);
  trapElbow.rotation.z = Math.PI / 2;
  trapElbow.position.set(0.045, 0.52, 0.08);
  grp.add(trapTop, trapBottle, trapElbow);

  return grp;
}

function mirrorPanel(mirror, w, h){
  const m = rbox(w, h, 0.02, 0.01, mirror, 0, 0, 0.012, false);
  return m;
}

function dispenser(plastic, w = 0.10, h = 0.14){
  return rbox(w, h, 0.075, 0.012, plastic, 0, 0, 0.04, false);
}

function floorDrain(grate){
  const grp = new THREE.Group();
  const frame = rbox(0.16, 0.006, 0.16, 0.004, grate, 0, 0.0, 0, false);
  grp.add(frame);
  for (let i = -2; i <= 2; i++){
    const slot = rbox(0.11, 0.003, 0.012, 0.001, grate, 0, 0.004, i * 0.024, false);
    grp.add(slot);
  }
  return grp;
}

function doorPanel(doorMat, chrome, w = 0.8, h = 2.0){
  const grp = new THREE.Group();
  grp.add(rbox(w, h, 0.045, 0.01, doorMat, 0, 0, 0.022, false));
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 10), chrome);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(w / 2 - 0.09, 1.0, 0.05);
  grp.add(handle);
  const kick = rbox(w - 0.06, 0.18, 0.008, 0.004, chrome, 0, 0.02, 0.05, true);
  grp.add(kick);
  return grp;
}

function ventGrille(chrome, w = 0.22, h = 0.22){
  const grp = new THREE.Group();
  grp.add(rbox(w, h, 0.02, 0.006, chrome, 0, 0, 0.01, false));
  for (let i = -3; i <= 3; i++){
    grp.add(rbox(w - 0.03, 0.012, 0.006, 0.002, flat(0x2b2f33, { roughness: 0.7 }), 0, i * (h / 8), 0.021, false));
  }
  return grp;
}

function ceilingLight(w, d){
  const emissive = flat(0xfdfaf0, { emissive: 0xfdf6df, emissiveIntensity: 2.4, roughness: 0.5 });
  const m = rbox(w, 0.03, d, 0.008, emissive, 0, -0.03, 0, false);
  return m;
}

// cabina WC: doi pereti despartitori laterali + usa frontala, adancime `depth`.
function stall(hpl, doorMat, chrome, width, depth){
  const grp = new THREE.Group();
  const ph = 1.9, py = 0.18;
  const left = rbox(0.03, ph, depth, 0.006, hpl, -width / 2, py, depth / 2, false);
  grp.add(left);
  const door = rbox(width - 0.08, ph, 0.035, 0.008, doorMat, 0, py, depth, false);
  grp.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), chrome);
  knob.position.set(width / 2 - 0.14, py + ph * 0.42, depth + 0.02);
  grp.add(knob);
  const indicator = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), flat(0x2fae5a, { roughness: 0.4, emissive: 0x113b1f, emissiveIntensity: 0.5 }));
  indicator.position.set(width / 2 - 0.14, py + ph * 0.6, depth + 0.021);
  grp.add(indicator);
  return grp;
}

/* ---------- construcție ---------- */

export async function build({ L, W, H }){
  const g = new THREE.Group();

  const floorMat = pbr('BaieFloor', { tile: 0.6, roughness: 0.92, env: 0.7 });
  const ceramic  = flat(0xf2efe6, { clearcoat: 0.65, clearcoatRoughness: 0.1, roughness: 0.22 });
  const plastic  = flat(0xf3f1ea, { roughness: 0.38 });
  const chrome   = flat(0xd8dbde, { metalness: 1, roughness: 0.16 });
  const mirror   = flat(0xc7d1d4, { metalness: 1, roughness: 0.05 });
  const hpl      = flat(0x8d99a3, { roughness: 0.55 });
  const stallDoorMat = flat(0xb9c0c5, { roughness: 0.5 });   // HPL deschis la culoare, nu navy — se distinge de pereti fara sa para tabla
  const doorMat  = flat(0x24344a, { roughness: 0.42 });
  const grate    = flat(0x5c6368, { metalness: 0.85, roughness: 0.32 });

  g.add(floorPlane(L, W, floorMat, 0, 0.002, 0));

  const rowMode = L >= 2.2 && W >= 2.2 && L * W > 5.5;

  // usa: intotdeauna pe peretele S, centrata
  mount(g, doorPanel(doorMat, chrome, clamp(L * 0.34, 0.72, 0.9)), 'S', L, W, 0);

  // grila de ventilatie, sus pe peretele E
  mount(g, (() => { const v = ventGrille(chrome); v.position.y = H - 0.35; return v; })(), 'E', L, W, W * 0.32);

  // lampa tavan
  mount(g, (() => { const lamp = ceilingLight(Math.min(0.5, L * 0.28), Math.min(0.5, W * 0.28)); lamp.position.set(0, H, 0); return lamp; })(), 'C', L, W, 0);

  if (!rowMode){
    // --- camera mica: un WC + un lavoar ---
    const wcX = clamp(-L / 2 + 0.62, -L / 2 + 0.5, L / 2 - 0.35);
    const wc = wcUnit(ceramic, plastic, chrome);
    wc.position.y = 0;
    mount(g, wc, 'N', L, W, wcX);
    const bar = wcGrabBar(chrome, clamp(L * 0.32, 0.5, 0.9));
    bar.position.x += wcX;
    mount(g, bar, 'N', L, W, 0);

    const basinZ = clamp(W / 2 - 0.55, -W / 2 + 0.45, W / 2 - 0.35);
    const basin = basinUnit(ceramic, chrome);
    mount(g, basin, 'W', L, W, basinZ);
    const mir = mirrorPanel(mirror, 0.5, 0.65);
    mir.position.y = 1.45;
    mount(g, mir, 'W', L, W, basinZ);
    const soap = dispenser(plastic, 0.09, 0.13);
    soap.position.y = 1.15;
    mount(g, soap, 'W', L, W, basinZ - 0.32);
    const towel = dispenser(chrome, 0.13, 0.19);
    towel.position.y = 1.05;
    mount(g, towel, 'W', L, W, basinZ + 0.34);

    // sifon de pardoseala, ferit de mobilier
    const drain = floorDrain(grate);
    drain.position.set(clamp(L * 0.18, -L / 2 + 0.3, L / 2 - 0.3), 0.003, clamp(-W * 0.05, -W / 2 + 0.3, W / 2 - 0.3));
    g.add(drain);
  } else {
    // --- camera mai mare: rand de cabine + blat cu mai multe lavoare ---
    const stallW = clamp(L / Math.max(2, Math.round(L / 0.95)), 0.85, 1.05);
    const nStalls = clamp(Math.floor(L / stallW), 2, 3);
    const rowW = nStalls * stallW;
    const startX = -rowW / 2 + stallW / 2;
    const depth = clamp(W * 0.42, 1.05, 1.3);

    for (let i = 0; i < nStalls; i++){
      const cx = startX + i * stallW;
      const wc = wcUnit(ceramic, plastic, chrome);
      mount(g, wc, 'N', L, W, cx);
      const bar = wcGrabBar(chrome, stallW * 0.7);
      bar.position.x += cx;
      mount(g, bar, 'N', L, W, 0);
      const cab = stall(hpl, stallDoorMat, chrome, stallW, depth);
      cab.position.x = cx;
      onWall(cab, 'N');
      cab.position.z = -W / 2;
      g.add(cab);
    }
    // panou terminal, la capatul randului
    const endPanel = rbox(0.03, 1.9, depth, 0.006, hpl, 0, 0.18, depth / 2, false);
    mount(g, endPanel, 'N', L, W, startX - stallW / 2);

    // blat cu lavoare, pe peretele W, dupa adancimea cabinelor
    const counterZStart = -W / 2 + depth + 0.35;
    const counterSpan = Math.max(0.6, W / 2 - counterZStart - 0.35);
    const nBasins = clamp(Math.floor(counterSpan / 0.62) + 1, 1, 3);
    for (let i = 0; i < nBasins; i++){
      const bz = counterZStart + (nBasins === 1 ? counterSpan / 2 : i * (counterSpan / (nBasins - 1)));
      const basin = basinUnit(ceramic, chrome);
      mount(g, basin, 'W', L, W, bz);
      const mir = mirrorPanel(mirror, stallW * 0.9 || 0.5, 0.7);
      mir.position.y = 1.45;
      mount(g, mir, 'W', L, W, bz);
    }
    const soap = dispenser(plastic, 0.09, 0.13);
    soap.position.y = 1.15;
    mount(g, soap, 'W', L, W, counterZStart - 0.28);
    const towel = dispenser(chrome, 0.13, 0.19);
    towel.position.y = 1.05;
    mount(g, towel, 'W', L, W, Math.min(W / 2 - 0.25, counterZStart + counterSpan + 0.3));

    const drain = floorDrain(grate);
    drain.position.set(startX, 0.003, -W / 2 + depth * 0.55);
    g.add(drain);
  }

  return g;
}
