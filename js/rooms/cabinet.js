/* Cabinet medical — treaptă 10–40 m² (cabinet de consultații).
 *
 * O zonă fixă (canapea de consultații + paravan, birou + scaune, lavoar cu
 * baterie cu cot lângă intrare, dulap de instrumentar) sub ~22 m²; peste,
 * se adaugă o a doua zonă (cărucior de tratamente + scaun în plus), fără să
 * se întindă mobilierul existent. Cotele din research/rooms/cabinet.md.
 * Pereții și tavanul sunt ai calculatorului.
 */
import { THREE, pbr, flat, floorPlane, onWall } from './kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// robust si la limite inversate (poate aparea la forme foarte alungite ale
// camerei, la marginile treptei) — trateaza [a,b] ca interval neordonat.
const clamp = (v, a, b) => (a <= b ? Math.min(b, Math.max(a, v)) : Math.min(a, Math.max(b, v)));

// dimensiuni fixe ale mobilierului de perete, refolosite si la asezarea lui
// (ca sa nu iasa prin perete la capete — vezi mount() mai jos).
const COUCH_LEN = 1.9, COUCH_WID = 0.65;
const CAB_W = 0.9, CAB_D = 0.38;

/* ---------- geometrie mică, locală ---------- */

function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0, base = true){
  const rr = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const g = new RoundedBoxGeometry(w, h, d, 2, rr);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, base ? y + h / 2 : y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function lathe(profile, mat, seg = 24){
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  const g = new THREE.LatheGeometry(pts, seg);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function cylX(r1, r2, len, mat, x, y, z, rotAxis = 'z'){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 14), mat);
  if (rotAxis === 'z') m.rotation.z = Math.PI / 2;
  if (rotAxis === 'x') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

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

/* ---------- mobilier ---------- */

// canapea de consultatii 1,9 x 0,65 m, inaltime 0,70 m (cote reale, vezi research).
// convenție (ca în baie.js): spatele lipit de perete la z local = 0, se
// întinde spre +z în cameră — așa se orientează corect prin mount().
function examCouch(leatherette, steel){
  const grp = new THREE.Group();
  const LEN = COUCH_LEN, WID = COUCH_WID, H = 0.70;
  for (const sx of [-1, 1]){
    for (const zz of [0.08, WID - 0.08]){
      grp.add(cylX(0.018, 0.018, H - 0.06, steel, sx * (LEN / 2 - 0.08), (H - 0.06) / 2, zz, 'none'));
    }
  }
  const frame = rbox(LEN - 0.05, 0.05, WID - 0.05, 0.015, steel, 0, H - 0.06, WID / 2, false);
  grp.add(frame);
  const mattress = rbox(LEN, 0.09, WID, 0.03, leatherette, 0, H - 0.01, WID / 2, false);
  grp.add(mattress);
  const bolster = rbox(0.22, 0.11, WID - 0.02, 0.03, leatherette, -LEN / 2 + 0.13, H + 0.05, WID / 2, false);
  grp.add(bolster);
  // treapta joasa pentru urcat pe canapea, la capatul dinspre picioare
  const step = rbox(0.35, 0.20, 0.30, 0.01, steel, LEN / 2 + 0.22, 0, WID / 2, true);
  grp.add(step);
  return grp;
}

// sina de paravan + draperie plisata reala, montata langa canapea (flux pe
// perete, axa x locala = lungimea sinei, incepe la x=0). Draperia e trasa
// spre un capat (~60% din sina), cu falduri verticale rotunjite, panza
// deschisa la culoare (nu se confunda cu un panou opac), pana la ~0,30 m
// de pardoseala.
function privacyScreen(rail, fabric, railY, len){
  const grp = new THREE.Group();
  grp.add(cylX(0.011, 0.011, len, rail, len / 2, railY, 0, 'z'));
  // inele de prindere pe toata sina
  const nRings = clamp(Math.round(len / 0.13), 6, 16);
  for (let i = 0; i < nRings; i++){
    const rx = (i + 0.5) * (len / nRings);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 10), rail);
    ring.position.set(rx, railY, 0);
    grp.add(ring);
  }
  // panza trasa pe ~60% din sina, dinspre x=0
  const curtainH = Math.max(0.6, railY - 0.30);
  const drawnLen = len * 0.6;
  const nFolds = clamp(Math.round(drawnLen / 0.10), 6, 16);
  const foldW = drawnLen / nFolds;
  for (let i = 0; i < nFolds; i++){
    const t = i / (nFolds - 1);
    const px = i * foldW + foldW / 2;
    const bulge = 0.016 * (i % 2 === 0 ? 1 : -1);
    const fold = rbox(foldW + 0.012, curtainH, 0.05, 0.022, fabric, px, railY - 0.05 - curtainH / 2, bulge, false);
    fold.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.09;
    grp.add(fold);
  }
  return grp;
}

// lampa de examinare LED pe stativ mobil, cu gat de gasca (gooseneck) si
// cap rotund cu inel — silueta usor recognoscibila de lampa medicala.
function examLamp(chrome, headMat){
  const grp = new THREE.Group();
  const baseR = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.03, 24), chrome);
  baseR.position.y = 0.015;
  grp.add(baseR);
  const poleH = 1.25;
  grp.add(cylX(0.022, 0.02, poleH, chrome, 0, 0.03 + poleH / 2, 0, 'none'));
  const j1 = new THREE.Vector3(0, 0.03 + poleH, 0);
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), chrome).translateX(j1.x).translateY(j1.y).translateZ(j1.z));

  // gat de gasca: succesiune de segmente subtiri usor curbate, ca un arc.
  const segs = 5;
  const armLen = 0.62, totalDrop = 0.22, totalOut = 0.34;
  let cur = j1.clone();
  for (let i = 0; i < segs; i++){
    const t0 = i / segs, t1 = (i + 1) / segs;
    const p0 = new THREE.Vector3(totalOut * Math.sin(t0 * Math.PI / 2), j1.y - totalDrop * t0, 0);
    const p1 = new THREE.Vector3(totalOut * Math.sin(t1 * Math.PI / 2), j1.y - totalDrop * t1, 0);
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const segLen = p0.distanceTo(p1) + 0.01;
    const dir = p1.clone().sub(p0);
    const ang = Math.atan2(dir.y, dir.x);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, segLen, 10), chrome);
    seg.rotation.z = ang + Math.PI / 2;
    seg.position.copy(mid);
    seg.castShadow = seg.receiveShadow = true;
    grp.add(seg);
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), chrome).translateX(p1.x).translateY(p1.y).translateZ(p1.z));
    cur = p1;
  }
  const headPos = cur;

  // cap rotund cu inel exterior si lentila emisiva.
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 26), chrome);
  ring.rotation.x = Math.PI / 2.3;
  ring.position.copy(headPos);
  ring.castShadow = ring.receiveShadow = true;
  grp.add(ring);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.115, 26), flat(0xfdf8ea, { emissive: 0xfdf2cf, emissiveIntensity: 1.8, roughness: 0.35 }));
  lens.rotation.x = -Math.PI / 2.3;
  lens.position.set(headPos.x, headPos.y - 0.018, headPos.z + 0.001);
  grp.add(lens);
  return grp;
}

// birou 1,2 x 0,6 m, inaltime 0,74 m.
function desk(topMat, steel){
  const grp = new THREE.Group();
  const W = 1.2, D = 0.6, H = 0.74;
  grp.add(rbox(W, 0.035, D, 0.012, topMat, 0, H - 0.035, 0, false));
  for (const sx of [-1, 1]){
    grp.add(rbox(0.03, H - 0.035, D - 0.06, 0.008, steel, sx * (W / 2 - 0.05), 0, 0, true));
  }
  const modesty = rbox(W - 0.1, 0.16, 0.02, 0.004, steel, 0, 0.30, D / 2 - 0.06, false);
  grp.add(modesty);
  return grp;
}

// monitor pe picior + tastatura, pe blatul biroului (H = inaltimea blatului).
function deskMonitor(shell, chrome, H){
  const grp = new THREE.Group();
  const foot = rbox(0.20, 0.012, 0.14, 0.006, chrome, 0, H, -0.12, false);
  grp.add(foot);
  const neck = rbox(0.025, 0.16, 0.025, 0.006, chrome, 0, H + 0.012, -0.12, false);
  grp.add(neck);
  const screen = rbox(0.40, 0.24, 0.02, 0.01, shell, 0, H + 0.17, -0.12, false);
  grp.add(screen);
  const panel = rbox(0.365, 0.205, 0.004, 0.002, flat(0x1a2430, { roughness: 0.3, emissive: 0x30425c, emissiveIntensity: 0.35 }), 0, H + 0.17, -0.108, false);
  grp.add(panel);
  const keyboard = rbox(0.34, 0.014, 0.12, 0.006, shell, -0.02, H, 0.10, false);
  grp.add(keyboard);
  return grp;
}

// scaun de birou (rotativ, baza in stea).
function officeChair(shell, chrome){
  const grp = new THREE.Group();
  const post = cylX(0.017, 0.017, 0.42, chrome, 0, 0.21, 0, 'none');
  grp.add(post);
  for (let i = 0; i < 5; i++){
    const a = (i / 5) * Math.PI * 2;
    const leg = rbox(0.22, 0.025, 0.04, 0.008, chrome, Math.cos(a) * 0.11, 0.02, Math.sin(a) * 0.11, false);
    leg.rotation.y = a;
    grp.add(leg);
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), flat(0x2a2a2a, { roughness: 0.6 })).translateX(Math.cos(a) * 0.20).translateZ(Math.sin(a) * 0.20).translateY(0.018));
  }
  const seat = rbox(0.42, 0.07, 0.40, 0.05, shell, 0, 0.44, 0, false);
  grp.add(seat);
  const back = rbox(0.40, 0.46, 0.06, 0.06, shell, 0, 0.52, -0.18, false);
  back.rotation.x = -0.12;
  grp.add(back);
  return grp;
}

// scaun de pacient, simplu, 4 picioare.
function patientChair(shell, chrome){
  const grp = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]){
    grp.add(cylX(0.014, 0.014, 0.45, chrome, sx * 0.19, 0.225, sz * 0.19, 'none'));
  }
  grp.add(rbox(0.42, 0.05, 0.40, 0.03, shell, 0, 0.45, 0, false));
  const back = rbox(0.40, 0.42, 0.045, 0.04, shell, 0, 0.50, -0.175, false);
  back.rotation.x = -0.08;
  grp.add(back);
  return grp;
}

// lavoar tehnic pentru spalarea mainilor + baterie cu maner lung (cot).
function handwashUnit(ceramic, chrome){
  const grp = new THREE.Group();
  const basin = lathe([
    [0.020, 0.735], [0.150, 0.755], [0.195, 0.800], [0.210, 0.825], [0.202, 0.833]
  ], ceramic, 22);
  basin.scale.set(1.2, 1, 0.95);
  basin.position.set(0, 0, 0.10);
  grp.add(basin);

  const tapBase = cylX(0.015, 0.018, 0.16, chrome, 0, 0.905, 0.17, 'none');
  grp.add(tapBase);
  const spout = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 8, 16, Math.PI * 0.6), chrome);
  spout.position.set(0, 0.985, 0.175);
  spout.rotation.set(Math.PI / 2, 0, Math.PI * 0.7);
  grp.add(spout);
  // maner lung "de cot", actionabil fara mana
  const elbowLever = cylX(0.009, 0.009, 0.22, chrome, 0, 0.90, 0.17, 'z');
  elbowLever.rotation.x = -0.5;
  grp.add(elbowLever);

  const trapTop = cylX(0.017, 0.017, 0.10, chrome, 0, 0.68, 0.08, 'none');
  grp.add(trapTop);
  const trapBottle = cylX(0.03, 0.03, 0.13, chrome, 0, 0.58, 0.08, 'none');
  grp.add(trapBottle);

  return grp;
}

// dulap de instrumentar: corp alb/inox + usi de sticla + rafturi vizibile.
// convenție: spatele la z local = 0 (lipit de perete), fata la z = D.
function instrumentCabinet(bodyMat, steel, glass){
  const grp = new THREE.Group();
  const W = CAB_W, D = CAB_D, H = 1.7;
  const cz = D / 2;
  grp.add(rbox(W, H, D, 0.02, bodyMat, 0, 0, cz, true));
  for (const gy of [0.35, 0.75, 1.15, 1.5]){
    grp.add(rbox(W - 0.06, 0.012, D - 0.05, 0.004, steel, 0, gy, cz, false));
  }
  for (const gy of [0.5, 0.9]){
    grp.add(rbox(0.10, 0.05, 0.16, 0.008, flat(0xcfd6da, { roughness: 0.4 }), -0.15, gy, cz + 0.02, false));
    grp.add(rbox(0.08, 0.04, 0.12, 0.006, flat(0xe4e6e2, { roughness: 0.45 }), 0.18, gy + 0.06, cz + 0.02, false));
  }
  for (const sx of [-1, 1]){
    const door = rbox(W / 2 - 0.01, H - 0.06, 0.02, 0.006, glass, sx * (W / 4), H / 2, D + 0.01, true);
    grp.add(door);
    grp.add(rbox(0.012, 0.16, 0.02, 0.004, steel, sx * (W / 2 - 0.05), H * 0.5, D + 0.025, false));
  }
  return grp;
}

// cos de deseuri medicale, cu pedala.
function wasteBin(plastic, chrome){
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.42, 16), plastic);
  body.position.y = 0.21;
  grp.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.03, 16), plastic);
  lid.position.y = 0.435;
  grp.add(lid);
  const pedal = rbox(0.10, 0.012, 0.05, 0.004, chrome, 0, 0.01, 0.13, false);
  grp.add(pedal);
  const link = cylX(0.006, 0.006, 0.17, chrome, 0, 0.09, 0.10, 'none');
  link.rotation.x = 0.4;
  grp.add(link);
  return grp;
}

// carucior mobil de tratamente, pt. a doua zona (camere mai mari).
function treatmentTrolley(steel, tray){
  const grp = new THREE.Group();
  const W = 0.46, D = 0.34, H = 0.82;
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]){
    grp.add(cylX(0.012, 0.012, H, steel, sx * (W / 2 - 0.03), H / 2, sz * (D / 2 - 0.03), 'none'));
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 10), flat(0x2a2a2a, { roughness: 0.6 })).translateX(sx * (W / 2 - 0.03)).translateZ(sz * (D / 2 - 0.03)).translateY(0.025));
  }
  for (const gy of [0.30, 0.60, H - 0.02]){
    grp.add(rbox(W, 0.02, D, 0.006, tray, 0, gy, 0, false));
  }
  return grp;
}

// cantar + taliometru, langa intrare.
function scaleUnit(plastic, chrome){
  const grp = new THREE.Group();
  grp.add(rbox(0.32, 0.05, 0.42, 0.015, plastic, 0, 0, 0, true));
  const pole = cylX(0.012, 0.012, 1.7, chrome, 0, 0.05 + 0.85, -0.16, 'none');
  grp.add(pole);
  const gauge = rbox(0.10, 0.14, 0.03, 0.01, flat(0xf4f4f2, { roughness: 0.4 }), 0.02, 1.35, -0.16, false);
  grp.add(gauge);
  return grp;
}

function doorPanel(doorMat, chrome, w, h = 2.05){
  const grp = new THREE.Group();
  grp.add(rbox(w, h, 0.045, 0.01, doorMat, 0, 0, 0.022, false));
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 10), chrome);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(w / 2 - 0.1, 1.02, 0.05);
  grp.add(handle);
  const kick = rbox(w - 0.06, 0.2, 0.008, 0.004, chrome, 0, 0.02, 0.05, true);
  grp.add(kick);
  return grp;
}

// fereastra PVC alba cu profil vizibil (~6 cm), canat impartit in doua
// (mullion central), geam usor albastrui cu strop de emisie (lumina de
// afara) ca sa nu se piarda pe peretele alb. reveal = rama inecata usor
// mai inchisa fata de perete, ca sa se citeasca marginea.
function windowUnit(frameMat, revealMat, glass, w, h){
  const grp = new THREE.Group();
  grp.add(rbox(w + 0.03, h + 0.03, 0.025, 0.006, revealMat, 0, 0, 0.012, false));
  grp.add(rbox(w, h, 0.07, 0.01, frameMat, 0, 0, 0.035, false));
  grp.add(rbox(w - 0.10, h - 0.10, 0.02, 0.004, glass, 0, 0, 0.06, false));
  // mullion central + traversa
  grp.add(rbox(0.05, h - 0.10, 0.022, 0.004, frameMat, 0, 0, 0.06, false));
  grp.add(rbox(w - 0.10, 0.045, 0.022, 0.004, frameMat, 0, h * 0.12, 0.06, false));
  // manere
  grp.add(rbox(0.016, 0.11, 0.016, 0.004, flat(0xc9ccce, { metalness: 0.8, roughness: 0.3 }), w / 2 - 0.16, 0, 0.075, false));
  const sill = rbox(w + 0.16, 0.03, 0.13, 0.006, frameMat, 0, -h / 2 - 0.015, 0.075, false);
  grp.add(sill);
  return grp;
}

function ceilingLight(w, d){
  const emissive = flat(0xfdfaf0, { emissive: 0xfdf6df, emissiveIntensity: 2.2, roughness: 0.5 });
  return rbox(w, 0.03, d, 0.008, emissive, 0, -0.03, 0, false);
}

/* ---------- construcție ---------- */

export async function build({ L, W, H }){
  const g = new THREE.Group();

  const floorMat  = pbr('CabinetFloor', { tile: 2.6, roughness: 0.55, tint: 0xc9d4d8, env: 0.6 });
  const leatherette = pbr('Leatherette', { tile: 0.9, tint: 0x24475f, roughness: 0.55 });
  const steel     = pbr('BrushedSteel', { tile: 0.4, roughness: 0.4, metalness: 1 });
  const chrome    = flat(0xd8dbde, { metalness: 1, roughness: 0.15 });
  const ceramic   = flat(0xf2efe6, { clearcoat: 0.6, clearcoatRoughness: 0.1, roughness: 0.22 });
  const woodTop   = flat(0xcfae7c, { roughness: 0.4 });
  const chairShell = flat(0xe7e6df, { roughness: 0.4 });
  const patientFabric = flat(0x1c3348, { roughness: 0.65 });
  const curtainFabric = flat(0xcfe3dd, { roughness: 0.75 });   // draperie deschisa la culoare, nu se confunda cu tabla
  const cabGlass  = flat(0x9fc2c9, { transmission: 0.6, thickness: 0.02, roughness: 0.1, opacity: 1 });
  const winGlass  = flat(0xbcdde6, { transmission: 0.55, thickness: 0.02, roughness: 0.04, opacity: 1, emissive: 0xeaf6f7, emissiveIntensity: 0.4 });
  const doorMat   = flat(0x24344a, { roughness: 0.42 });
  const frameMat  = flat(0xf0efe8, { roughness: 0.42 });        // profil PVC alb
  const revealMat = flat(0x9aa3a8, { roughness: 0.5 });         // muchie mai inchisa, ca sa se citeasca fereastra
  const cabBody   = flat(0xe7e9e4, { roughness: 0.4 });
  const binPlastic = flat(0xd8b23c, { roughness: 0.5 });
  const trayMat   = flat(0xe9ebe8, { roughness: 0.35 });
  const railMat   = flat(0xc7cbce, { metalness: 0.8, roughness: 0.3 });
  const monitorShell = flat(0xdfe1dc, { roughness: 0.4 });

  g.add(floorPlane(L, W, floorMat, 0, 0.002, 0));

  const area = L * W;
  const zone2 = area >= 22;

  // usa: perete S, centrata
  mount(g, doorPanel(doorMat, chrome, clamp(L * 0.24, 0.9, 1.0)), 'S', L, W, 0);

  // fereastra: perete N, centrata, latimea creste usor cu L
  const winW = clamp(L * 0.42, 1.1, 1.8);
  const win = windowUnit(frameMat, revealMat, winGlass, winW, clamp(H * 0.5, 1.1, 1.5));
  win.position.y = H * 0.52;
  mount(g, win, 'N', L, W, 0);

  // lampa tavan (una la camere mici, doua la cele mari)
  const lampObj = ceilingLight(Math.min(0.55, L * 0.16), Math.min(0.55, W * 0.2));
  const lamp1 = lampObj.clone(); lamp1.position.set(0, H, -W * 0.15);
  mount(g, lamp1, 'C', L, W, 0);
  if (zone2){
    const lamp2 = ceilingLight(Math.min(0.55, L * 0.16), Math.min(0.55, W * 0.2));
    lamp2.position.set(0, H, W * 0.2);
    mount(g, lamp2, 'C', L, W, 0);
  }

  // --- canapea de consultatii, pe peretele E, spre capatul dinspre fereastra (N) ---
  // couchZ = centrul lungimii canapei pe perete; clamp-ul tine cont de jumatate
  // din lungimea reala (1,9 m), altfel capetele ies prin perete la camere inguste.
  const halfCouch = COUCH_LEN / 2;
  const couchZ = clamp(-W / 2 + halfCouch + 0.12, -W / 2 + halfCouch + 0.05, W / 2 - halfCouch - 0.05);
  const couch = examCouch(leatherette, steel);
  mount(g, couch, 'E', L, W, couchZ);

  const screenLen = clamp(COUCH_LEN + 0.5, 1.6, 2.3);
  const screenY = clamp(H - 0.35, 1.85, 2.35);
  const screen = privacyScreen(railMat, curtainFabric, screenY, screenLen);
  const screenStart = clamp(couchZ - halfCouch - 0.15, -W / 2 + 0.05, W / 2 - screenLen - 0.05);
  mount(g, screen, 'E', L, W, screenStart);

  const lamp = examLamp(chrome, flat(0xf2f2ee, { roughness: 0.3 }));
  lamp.position.set(clamp(L / 2 - 0.85, 0.6, L / 2 - 0.5), 0, clamp(couchZ + 0.6, -W / 2 + 0.4, W / 2 - 0.4));
  g.add(lamp);

  // --- dulap de instrumentar, pe peretele E, dupa zona canapelei/paravanului ---
  const halfCab = CAB_W / 2;
  const cabZ = clamp(W / 2 - halfCab - 0.08, screenStart + screenLen + 0.3, W / 2 - halfCab - 0.05);
  const cabinet = instrumentCabinet(cabBody, steel, cabGlass);
  mount(g, cabinet, 'E', L, W, cabZ);

  // cos de deseuri, langa canapea
  const bin = wasteBin(binPlastic, chrome);
  bin.position.set(clamp(L / 2 - 0.35, 0.5, L / 2 - 0.3), 0, clamp(couchZ - 0.55, -W / 2 + 0.3, W / 2 - 0.3));
  g.add(bin);

  // --- lavoar tehnic, pe peretele W, langa intrare (colt S) ---
  const sinkZ = clamp(W / 2 - 0.55, -W / 2 + 0.45, W / 2 - 0.35);
  const sink = handwashUnit(ceramic, chrome);
  mount(g, sink, 'W', L, W, sinkZ);
  const soap = rbox(0.09, 0.13, 0.06, 0.012, flat(0xf3f1ea, { roughness: 0.4 }), 0, 1.2, 0.04, false);
  mount(g, soap, 'W', L, W, sinkZ - 0.3);
  const towel = rbox(0.13, 0.19, 0.075, 0.012, chrome, 0, 1.1, 0.045, false);
  mount(g, towel, 'W', L, W, sinkZ + 0.32);

  // cantar, langa usa
  const scale = scaleUnit(chairShell, chrome);
  scale.position.set(clamp(-L / 2 + 0.5, -L / 2 + 0.4, -0.3), 0, clamp(W / 2 - 0.35, 0, W / 2 - 0.3));
  g.add(scale);

  // --- birou + scaune, spre centrul camerei, cu fata spre usa/fereastra ---
  const deskX = clamp(-L * 0.05, -L / 2 + 1.0, L / 2 - 1.4);
  const deskZ = clamp(-W / 2 + 1.35, -W / 2 + 1.0, W / 2 - 1.2);
  const deskObj = desk(woodTop, steel);
  deskObj.add(deskMonitor(monitorShell, chrome, 0.74));
  deskObj.position.set(deskX, 0, deskZ);
  deskObj.rotation.y = Math.PI;
  g.add(deskObj);

  const chair1 = officeChair(chairShell, chrome);
  chair1.position.set(deskX, 0, deskZ + 0.55);
  g.add(chair1);

  const chair2 = patientChair(patientFabric, chrome);
  chair2.position.set(deskX - 0.55, 0, deskZ - 0.55);
  chair2.rotation.y = Math.PI * 0.35;
  g.add(chair2);

  if (zone2){
    const chair3 = patientChair(patientFabric, chrome);
    chair3.position.set(deskX + 0.55, 0, deskZ - 0.55);
    chair3.rotation.y = -Math.PI * 0.35;
    g.add(chair3);

    // caruciorul de tratamente, langa capatul dinspre picioare al canapelei
    const trolley = treatmentTrolley(steel, trayMat);
    trolley.position.set(clamp(L / 2 - 0.35, 0.4, L / 2 - 0.3), 0, clamp(couchZ + halfCouch + 0.4, -W / 2 + 0.3, W / 2 - 0.3));
    g.add(trolley);
  }

  return g;
}
