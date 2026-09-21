/* Fabrică alimentară (bere/lactate) — treaptă 450–1.500 m² (preset 32×18×5).
 *
 * Referință: hala de proces Ursus Breweries Ciucaș (Brașov), 1.000 m², placată de
 * MedClyn în 40 de zile fără oprirea producției — vezi research/README.md. Cote și
 * decizii de proiectare: research/rooms/fabrica.md.
 *
 * Rând de tancuri cilindroconice (CCT) lângă un perete, cu picioare, manway, rastel
 * de conducte deasupra, platformă + scară de acces, skid CIP, rigolă de scurgere,
 * ușă rapidă de intrare, panou electric. Pereții și tavanul sunt ai calculatorului.
 */
import { THREE, pbr, flat, floorPlane, instances, onWall } from './kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// robust si la limite inversate (poate aparea la forme foarte alungite ale
// camerei, la marginile treptei) — trateaza [a,b] ca interval neordonat.
const clamp = (v, a, b) => (a <= b ? Math.min(b, Math.max(a, v)) : Math.min(a, Math.max(b, v)));

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

function cylX(r1, r2, len, mat, x, y, z, rotAxis = 'none', segR = 12){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, segR), mat);
  if (rotAxis === 'z') m.rotation.z = Math.PI / 2;
  if (rotAxis === 'x') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Țeavă de-a lungul unor puncte (rastel de conducte, coborâri CIP). */
function pipe(points, r, mat, radialSeg = 8){
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0);
  const tubularSeg = Math.max(2, points.length * 4);
  const g = new THREE.TubeGeometry(curve, tubularSeg, r, radialSeg, false);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function wallPose(side, L, W, along){
  switch (side){
    case 'N': return { x: along, z: -W / 2, rot: 0 };
    case 'S': return { x: along, z: W / 2, rot: Math.PI };
    case 'E': return { x: L / 2, z: along, rot: -Math.PI / 2 };
    case 'W': return { x: -L / 2, z: along, rot: Math.PI / 2 };
    default:  return { x: 0, z: 0, rot: 0 };   // 'C' = tavan
  }
}
function mount(g, obj, side, L, W, along){
  const p = wallPose(side, L, W, along);
  obj.position.x += p.x; obj.position.z += p.z;
  obj.rotation.y += p.rot;
  onWall(obj, side);
  g.add(obj);
}

/* ---------- tanc cilindroconic (CCT) ---------- */

// profil absolut (raza, inaltime de la pardoseala): picioare -> con -> cilindru -> cap bombat.
function tankShell(D, legH, coneH, cylH, domeH, steel){
  const R = D / 2;
  const y0 = legH, y1 = legH + coneH, y2 = y1 + cylH, y3 = y2 + domeH;
  const profile = [
    [0.02, y0],
    [R * 0.90, y1 - coneH * 0.06],
    [R, y1],
    [R, y2],
    [R * 0.88, y2 + domeH * 0.42],
    [R * 0.48, y2 + domeH * 0.80],
    [0.02, y3]
  ];
  return lathe(profile, steel, 26);
}

// manway lateral (ramă + capac cu balamale), proeminent spre +z local.
function manway(chrome, r = 0.09){
  const grp = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 8, 20), chrome);
  rim.rotation.x = Math.PI / 2;
  grp.add(rim);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.02, 20), chrome);
  lid.rotation.x = Math.PI / 2;
  lid.position.z = 0.012;
  grp.add(lid);
  const hinge = rbox(0.03, 0.11, 0.02, 0.006, chrome, -r - 0.005, 0, 0.01, false);
  grp.add(hinge);
  return grp;
}

// placuta de identificare (produs / capacitate), detaliu mic care vinde realismul.
function nameplate(mat, w = 0.16, h = 0.11){
  return rbox(w, h, 0.006, 0.006, mat, 0, 0, 0.004, false);
}

// valva fluture + actuator, agatata sub varful conului (colectare/golire).
// origine locala (y=0) = punctul de prindere de varful conului; totul atarna in jos.
function valveCluster(steel, blue, drop){
  const grp = new THREE.Group();
  grp.add(cylX(0.026, 0.026, drop * 0.5, steel, 0, -drop * 0.25, 0, 'none'));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 14), blue);
  body.rotation.z = Math.PI / 2;
  body.position.y = -drop * 0.58;
  grp.add(body);
  const act = rbox(0.045, 0.06, 0.045, 0.008, blue, 0.055, -drop * 0.58 + 0.02, 0, false);
  grp.add(act);
  grp.add(cylX(0.02, 0.02, drop * 0.32, steel, 0, -drop * 0.84, 0, 'none'));
  return grp;
}

/* ---------- platformă + scară de acces ---------- */

function platform(len, deckWidth, inner, deckY, tread, steel, faceSign){
  const grp = new THREE.Group();
  const cz = faceSign * (inner + deckWidth / 2);
  grp.add(rbox(len, 0.05, deckWidth, 0.006, tread, 0, deckY - 0.05, cz, false));
  // grinzi de sustinere pe toata lungimea
  for (const dz of [inner + 0.06, inner + deckWidth - 0.06]){
    grp.add(rbox(len - 0.1, 0.07, 0.06, 0.01, steel, 0, deckY - 0.09, faceSign * dz, false));
  }
  return grp;
}

function guardrailPosts(len, deckY, outerZ, steel){
  const n = Math.max(2, Math.round(len / 1.4) + 1);
  const list = [];
  for (let i = 0; i < n; i++) list.push([-len / 2 + i * (len / (n - 1)), deckY, outerZ, 0]);
  return instances(0.028, 1.05, 0.028, steel, list);
}

function guardrailRails(len, deckY, outerZ, steel){
  const grp = new THREE.Group();
  for (const dy of [0.55, 1.02]){
    grp.add(cylX(0.017, 0.017, len, steel, 0, deckY + dy, outerZ, 'z'));
  }
  const kick = rbox(len, 0.09, 0.02, 0.006, steel, 0, deckY + 0.03, outerZ, false);
  grp.add(kick);
  return grp;
}

// scara dreapta, in coordonate absolute ale incaperii: varful (x0, deckY, ~z0) langa
// marginea platformei, coboara treptele proiectandu-se in continuare spre faceSign*z.
function stair(x0, deckY, z0, faceSign, tread, steel){
  const rise = 0.185, run = 0.27;
  const n = Math.max(3, Math.ceil(deckY / rise));
  const r = deckY / n;               // inaltime reala pe treapta, repartizata uniform
  const th = 0.05;                   // grosimea treptei
  const grp = new THREE.Group();
  const stepList = [];
  for (let i = 0; i < n; i++){
    const j = n - 1 - i;              // j=0 => treapta de sus, langa platforma
    stepList.push([x0, (i + 1) * r - th, z0 + faceSign * (j * run + run / 2), 0]);
  }
  grp.add(instances(0.85, th, run - 0.02, tread, stepList));

  const runTotal = n * run;
  const ang = Math.atan2(deckY, runTotal);              // unghiul pantei fata de orizontala
  const diagLen = Math.hypot(runTotal, deckY);
  const midZ = z0 + faceSign * runTotal / 2;
  const phi = faceSign * (Math.PI / 2 - ang);
  for (const sx of [-0.44, 0.44]){
    const stringer = cylX(0.03, 0.03, diagLen, steel, x0 + sx, deckY / 2, midZ, 'none');
    stringer.rotation.x = phi;
    grp.add(stringer);
    const rail = cylX(0.016, 0.016, diagLen, steel, x0 + sx, deckY / 2 + 0.92, midZ, 'none');
    rail.rotation.x = phi;
    grp.add(rail);
  }
  // stalpi de sustinere a manii curente, esalonati pe panta
  const postCount = Math.max(2, Math.round(n / 2));
  const postList = [];
  for (let i = 0; i <= postCount; i++){
    const t = i / postCount;
    const z = z0 + faceSign * t * runTotal;
    for (const sx of [-0.44, 0.44]) postList.push([x0 + sx, t * deckY, z, 0]);
  }
  grp.add(instances(0.018, 0.85, 0.018, steel, postList));
  return grp;
}

/* ---------- ușă rapidă (rapid-roll) și panou electric ---------- */

function rapidDoor(w, h, curtain, steel){
  const grp = new THREE.Group();
  grp.add(rbox(w + 0.16, h + 0.3, 0.06, 0.01, steel, 0, 0, 0.03, false));
  const leaf = rbox(w, h, 0.02, 0.006, curtain, 0, 0, 0.05, false);
  grp.add(leaf);
  for (let i = 1; i < 6; i++){
    grp.add(rbox(w - 0.04, 0.02, 0.006, 0.002, flat(0x0c2338, { roughness: 0.6 }), 0, -h / 2 + i * (h / 6), 0.061, false));
  }
  const coil = cylX(0.13, 0.13, w + 0.1, steel, 0, h / 2 + 0.16, 0.02, 'z');
  grp.add(coil);
  for (const sx of [-1, 1]){
    grp.add(rbox(0.1, h + 0.18, 0.08, 0.012, steel, sx * (w / 2 + 0.05), 0, 0.04, false));
  }
  return grp;
}

function electricalPanel(body, screenMat, w = 0.6, h = 0.85){
  const grp = new THREE.Group();
  grp.add(rbox(w, h, 0.22, 0.012, body, 0, 0, 0.11, false));
  const screen = rbox(w * 0.42, h * 0.32, 0.01, 0.004, screenMat, -w * 0.18, h * 0.22, 0.226, false);
  grp.add(screen);
  for (let i = 0; i < 4; i++){
    grp.add(rbox(0.035, 0.035, 0.012, 0.004, flat(i % 2 ? 0xc8102e : 0x2fae5a, { roughness: 0.4, emissive: i % 2 ? 0x4a0810 : 0x0e3a1c, emissiveIntensity: 0.6 }), w * 0.22, h * 0.32 - i * 0.08, 0.226, false));
  }
  return grp;
}

function ceilingLight(w, d){
  const emissive = flat(0xf3f8ff, { emissive: 0xdcecff, emissiveIntensity: 2.6, roughness: 0.5 });
  return rbox(w, 0.06, d, 0.01, emissive, 0, 0, 0, false);
}

// rigola de scurgere de-a lungul randului de tancuri, cu sloturi de gratar — gratarul
// inox e mai deschis la culoare decat pardoseala, asa cum se vede real pe santier (contrast
// vizibil, nu doar o dunga aproape de culoarea podelei).
function trenchDrain(len, grate){
  const grp = new THREE.Group();
  grp.add(rbox(len, 0.016, 0.32, 0.006, grate, 0, 0.001, 0, false));
  const nSlots = Math.max(3, Math.round(len / 0.22));
  const list = [];
  for (let i = 0; i < nSlots; i++) list.push([-len / 2 + (i + 0.5) * (len / nSlots), 0.018, 0, 0]);
  grp.add(instances(len / nSlots - 0.03, 0.008, 0.22, flat(0x14181b, { roughness: 0.9 }), list));
  return grp;
}

// skid CIP: doua rezervoare mici + pompa, pe cadru inox.
function cipSkid(steel, blue){
  const grp = new THREE.Group();
  grp.add(rbox(1.3, 0.06, 0.7, 0.01, steel, 0, 0, 0, true));
  for (const sx of [-0.32, 0.32]){
    const tank = lathe([[0.02, 0], [0.22, 0.04], [0.24, 0.25], [0.24, 0.85], [0.16, 1.0], [0.02, 1.05]], steel, 18);
    tank.position.set(sx, 0.06, 0);
    grp.add(tank);
  }
  const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 16), blue);
  pump.rotation.z = Math.PI / 2;
  pump.position.set(0, 0.17, 0.28);
  grp.add(pump);
  grp.add(rbox(0.15, 0.2, 0.15, 0.01, steel, 0, 0.06, 0.28, true));
  return grp;
}

/* ---------- rând complet de tancuri + platformă + rastel de conducte ---------- */

function tankRow(L, W, H, tankZ, faceSign, count, steel, chrome, plate, blue, tread, grate, g){
  const R = Math.min(clamp(W * 0.085, 1.05, 1.8), 2.6);
  let Htot = clamp(H * 0.74, 1.2, 6.4);
  Htot = Math.min(Htot, H - 0.6);             // rezerva pt. rastelul de conducte + liber sub tavan
  Htot = Math.max(Htot, 1.0);
  const legH = 0.42, coneH = Htot * 0.26, cylH = Htot * 0.52, domeH = Htot - coneH - cylH;
  const manwayY = legH + coneH + cylH * 0.42;
  const platformY = Math.max(0.9, manwayY - 1.05);

  const spacing = clamp((L - 2.4) / Math.max(1, count - 1) || 1, R * 2 + 0.7, 5.2);
  const rowLen = (count - 1) * spacing;
  const startX = -rowLen / 2;

  const legList = [];
  const valvePositions = [];
  for (let i = 0; i < count; i++){
    const x = startX + i * spacing;
    const shell = tankShell(R * 2, legH, coneH, cylH, domeH, steel);
    shell.position.set(x, 0, tankZ);
    g.add(shell);

    for (const a of [Math.PI / 4, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]){
      legList.push([x + Math.cos(a) * R * 0.66, 0, tankZ + Math.sin(a) * R * 0.66, 0]);
    }

    const mw = manway(chrome, R * 0.16);
    mw.position.set(x, manwayY, tankZ + faceSign * R);
    mw.rotation.y = faceSign > 0 ? 0 : Math.PI;
    g.add(mw);

    const plq = nameplate(plate);
    plq.position.set(x + R * 0.5, manwayY - 0.35, tankZ + faceSign * R * 0.98);
    plq.rotation.y = faceSign > 0 ? 0 : Math.PI;
    g.add(plq);

    const drop = Math.max(0.16, legH - 0.1);
    const valve = valveCluster(steel, blue, drop);
    valve.position.set(x, legH, tankZ);
    g.add(valve);
    valvePositions.push([x, Math.max(0.08, legH - drop), tankZ]);
  }
  g.add(instances(0.035, legH, 0.035, steel, legList));

  // colector de pardoseala, leaga valvele intre ele
  if (valvePositions.length > 1) g.add(pipe(valvePositions, 0.026, steel));

  // platforma + balustrada + scara, doar cand meritata inaltimea cilindrica
  if (cylH > 1.3){
    const deckInner = R + 0.12;        // liber intre tanc si marginea platformei
    const deckWidth = 1.1;
    const outerZ = tankZ + faceSign * (deckInner + deckWidth);
    const plt = platform(rowLen + 1.4, deckWidth, deckInner, platformY, tread, steel, faceSign);
    plt.position.set((startX + rowLen / 2), 0, tankZ);
    g.add(plt);
    const rails = guardrailRails(rowLen + 1.4, platformY, outerZ - tankZ, steel);
    rails.position.set((startX + rowLen / 2), 0, tankZ);
    g.add(rails);
    const posts = guardrailPosts(rowLen + 1.4, platformY, outerZ - tankZ, steel);
    posts.position.set((startX + rowLen / 2), 0, tankZ);
    g.add(posts);

    const st = stair(startX + rowLen + 0.7, platformY, outerZ, faceSign, tread, steel);
    g.add(st);

    // rastel de conducte deasupra, cu coborari CIP catre fiecare tanc
    const py = Math.min(H - 0.55, legH + coneH + cylH + domeH + 0.55);
    const mainPipe = pipe([[startX - 0.6, py, tankZ + faceSign * (R + 0.45)], [startX + rowLen + 0.6, py, tankZ + faceSign * (R + 0.45)]], 0.032, steel);
    g.add(mainPipe);
    const bracketList = [];
    for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 4))){
      bracketList.push([startX + i * spacing, platformY, tankZ + faceSign * (R + 0.45), 0]);
    }
    g.add(instances(0.02, py - platformY, 0.02, steel, bracketList));
    for (let i = 0; i < count; i++){
      const x = startX + i * spacing;
      const topY = legH + coneH + cylH + domeH;
      g.add(pipe([[x, py, tankZ + faceSign * (R + 0.45)], [x, py - 0.1, tankZ + faceSign * (R * 0.3)], [x, topY + 0.05, tankZ + faceSign * R * 0.15]], 0.018, steel));
    }
  }

  // rigola de scurgere la baza randului
  const drain = trenchDrain(rowLen + 1.2, grate);
  drain.position.set(startX + rowLen / 2, 0, tankZ + faceSign * (R + 0.55));
  g.add(drain);

  return { rowLen, startX, platformY };
}

/* ---------- construcție ---------- */

export async function build({ L, W, H }){
  const g = new THREE.Group();

  const floorMat = pbr('PUCementFloor', { tile: 3.2, roughness: 0.42, tint: 0x878d86, env: 0.85 });
  const steel    = pbr('BrushedSteel', { tile: 0.7, roughness: 0.32, metalness: 1, env: 1.1 });
  const chrome   = flat(0xdfe2e3, { metalness: 1, roughness: 0.15 });
  const plate    = flat(0xeceeec, { roughness: 0.5 });
  const blue     = flat(0x2b5aa0, { metalness: 0.5, roughness: 0.35 });
  const tread    = pbr('TreadPlate', { tile: 0.55, roughness: 0.48, metalness: 0.9 });
  const grate    = flat(0x9aa0a3, { metalness: 0.9, roughness: 0.3 });
  const curtain  = flat(0x1c3f66, { roughness: 0.55 });
  const panelBody = flat(0xe9ebe8, { roughness: 0.45 });
  const screenMat = flat(0x142334, { emissive: 0x2d6fbf, emissiveIntensity: 1.3, roughness: 0.4 });

  g.add(floorPlane(L, W, floorMat, 0, 0.002, 0));

  const standoff = 1.0;
  const count = clamp(Math.round(L / 4.4), 3, 9);
  const twoRows = W >= 15;

  const rowN = tankRow(L, W, H, -W / 2 + standoff, 1, count, steel, chrome, plate, blue, tread, grate, g);
  if (twoRows){
    const count2 = clamp(count - 1, 3, 8);
    tankRow(L, W, H, W / 2 - standoff, -1, count2, steel, chrome, plate, blue, tread, grate, g);
  }

  // skid CIP, tras in afara umbrei primului tanc (nu in linie cu randul, ci scos spre
  // culoarul din fata — altfel se pierde vizual dupa manta tancului din capat).
  const skid = cipSkid(steel, blue);
  skid.position.set(Math.max(-L / 2 + 0.9, rowN.startX - 1.3), 0, -W / 2 + standoff + 1.4);
  skid.rotation.y = Math.PI / 4;
  g.add(skid);

  // usa rapida de intrare + panou electric: pe peretele S doar cand acolo NU sta al
  // doilea rand de tancuri (altfel usa se pierde in spatele lor) — cu doua randuri,
  // trece pe peretele scurt W, care ramane mereu liber intre capetele randurilor.
  const doorW = clamp(L * 0.11, 2.4, 3.2);
  const doorH = clamp(H * 0.62, 2.8, 4.2);
  const doorSide = twoRows ? 'W' : 'S';
  const doorAlong = twoRows ? clamp(W * 0.06, -W / 2 + doorW / 2 + 0.6, W / 2 - doorW / 2 - 0.6)
                             : clamp(-L / 2 + doorW / 2 + 0.9, -L / 2 + 1.6, -1.5);
  mount(g, rapidDoor(doorW, doorH, curtain, steel), doorSide, L, W, doorAlong);

  const panelAlong = twoRows ? clamp(doorAlong + doorW / 2 + 1.1, -W / 2 + 0.6, W / 2 - 0.6)
                              : clamp(-L / 2 + doorW + 1.6, -L / 2 + 2.6, -0.6);
  mount(g, electricalPanel(panelBody, screenMat), doorSide, L, W, panelAlong);

  // iluminat tavan, grid rar
  const nx = clamp(Math.round(L / 6.5), 2, 16);
  const nz = clamp(Math.round(W / 6), 1, 8);
  const lampList = [];
  for (let i = 0; i < nx; i++){
    for (let j = 0; j < nz; j++){
      const x = -L / 2 + (i + 0.5) * (L / nx);
      const z = -W / 2 + (j + 0.5) * (W / nz);
      lampList.push([x, H - 0.06, z, 0]);
    }
  }
  const lampMesh = instances(1.1, 0.06, 0.22, flat(0xf3f8ff, { emissive: 0xdcecff, emissiveIntensity: 2.6, roughness: 0.5 }), lampList);
  onWall(lampMesh, 'C');
  g.add(lampMesh);

  return g;
}
