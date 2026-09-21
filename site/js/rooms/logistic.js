/* Hală logistică / depozit — treaptă > 1.500 m² (preset 120×60×12, testat și 120×120×14).
 *
 * Cadre portal din oțel (stâlpi rari), rafturi paletizate spate-în-spate cu încărcături
 * variate, rampe de încărcare cu leveler pe peretele S, iluminat LED highbay, marcaje de
 * podea, stivuitor și camion. Cote și surse: research/rooms/logistic.md. Totul greu
 * repetitiv e InstancedMesh — la 120×120 pot fi mii de "cutii" pe rafturi. Pereții și
 * tavanul sunt ai calculatorului.
 */
import { THREE, pbr, flat, floorPlane, instances, glb, onWall } from './kit.js';

// robust si la limite inversate — trateaza [a,b] ca interval neordonat.
const clamp = (v, a, b) => (a <= b ? Math.min(b, Math.max(a, v)) : Math.min(a, Math.max(b, v)));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/** Cutii/paleți instanțiate cu variație de scară și culoare (kit.instances() nu are culoare).
 * Nu proiecteaza umbra: zeci de cutii pe mai multe niveluri, cu umbre proiectate de un singur
 * `DirectionalLight`, dadeau pete negre in trepte pe podeaua libera din fata rafturilor —
 * lumina de ambient (hemisferă) nu ajunge sa le lumineze la fel ca restul podelei. */
function loadBoxes(list, mat){
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  list.forEach(([x, y, z, ry, sx, sy, sz, color], i) => {
    e.set(0, ry || 0, 0); q.setFromEuler(e);
    p.set(x, y, z); s.set(sx, sy, sz);
    im.setMatrixAt(i, m4.compose(p, q, s));
    c.set(color);
    im.setColorAt(i, c);
  });
  im.instanceColor.needsUpdate = true;
  im.castShadow = false;
  im.receiveShadow = true;
  return im;
}

// paleta redusa, putin saturata: carton kraft, folie alba/translucida, lazi gri si
// albastru-gri de plastic — asa arata un depozit real, nu confetti multicolor.
const LOAD_COLORS = [0xb5926a, 0xe7e3d7, 0x8b9096, 0x5c7286];

/* ---------- structură portal: stâlpi rari, câte un rând pe fiecare perete, marcați
   onWall ca sa dispara odata cu peretele din fata camerei (nu doar cei doi lungi). ---------- */

function wallColumns(L, W, H, mat, side){
  const long = side === 'N' || side === 'S';
  const span = long ? L : W;
  const n = clamp(Math.round(span / 12), 2, 11);
  const list = [];
  for (let i = 0; i <= n; i++){
    const along = -span / 2 + 1.1 + i * ((span - 2.2) / n);
    if (long) list.push([along, 0, side === 'N' ? -W / 2 + 1.3 : W / 2 - 1.3, 0]);
    else list.push([side === 'W' ? -L / 2 + 1.3 : L / 2 - 1.3, 0, along, 0]);
  }
  const m = instances(long ? 0.35 : 0.22, H, long ? 0.22 : 0.35, mat, list);
  onWall(m, side);
  return m;
}

/* ---------- un rând de raft (o singură față, adaugă la acumulatoarele `out`) ---------- */

const PALLET_H = 0.14;

function rackRow(x0, nBays, bayW, z, beamYs, loadCapH, out){
  // fara niveluri de grinda (tavan prea jos) inseamna fara structura de raft, doar paleti pe jos.
  if (beamYs.length){
    for (let i = 0; i <= nBays; i++) out.posts.push([x0 + i * bayW, 0, z, 0]);
    for (const by of beamYs){
      for (let i = 0; i < nBays; i++) out.beams.push([x0 + i * bayW + bayW / 2, by, z, 0]);
    }
  }
  // incarcaturi: nivel podea (0) + fiecare nivel de grinda, doua sloturi pe travee, fiecare
  // pe un palet de lemn vizibil. Umplere mai densa jos, mai rara sus — un depozit real e
  // aproape plin la baza si mai gol pe nivelurile de rezerva de sus; asta si lasa culoarele
  // si structura vizibile de la distanta, in loc sa citeasca ca un bloc solid.
  const levels = [0, ...beamYs.map((y) => y + 0.1)];
  levels.forEach((ly, li) => {
    const emptyChance = 0.1 + li * 0.16;     // nivelul podelei ~10% gol, urmatoarele 26/42/58%
    for (let i = 0; i < nBays; i++){
      const bx = x0 + i * bayW;
      for (const half of [0.28, 0.72]){
        if (Math.random() < emptyChance) continue;
        const cx = bx + half * bayW;
        const w = rand(0.78, 0.9), d = rand(0.78, 0.88);        // paletul standard e fix; incarcatura variaza
        const h = Math.min(loadCapH, rand(0.45, loadCapH));
        out.pallets.push([cx, ly, z, rand(-0.06, 0.06)]);
        out.loads.push([cx, ly + PALLET_H, z, rand(-0.06, 0.06), w, h, d, pick(LOAD_COLORS)]);
      }
    }
  });
}

/* ---------- rampe de încărcare pe peretele S ---------- */

function loadingDocks(L, W, out){
  const doorW = 3, doorH = 3, spacing = 4;
  const n = clamp(Math.floor((L - 6) / spacing), 1, 26);
  const startX = -((n - 1) * spacing) / 2;
  for (let i = 0; i < n; i++){
    const x = startX + i * spacing;
    out.leaf.push([x, 0, W / 2 - 0.04, 0]);
    out.frame.push([x, 0, W / 2 - 0.09, 0]);
    out.pad.push([x - doorW / 2 - 0.16, 0, W / 2 - 0.22, 0]);
    out.pad.push([x + doorW / 2 + 0.16, 0, W / 2 - 0.22, 0]);
    out.level.push([x, 0.001, W / 2 - 0.95, 0]);
  }
  return { n, startX, doorW, doorH, spacing };
}

/* ---------- marcaj galben de culoar ---------- */

function aisleLine(len, cx, z, mat){
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.004, 0.1), mat);
  m.position.set(cx, 0.004, z);
  return m;
}

// conturul unei zone de stationare (dreptunghi vopsit, 4 linii subtiri).
function laneRect(w, d, mat){
  const grp = new THREE.Group();
  const t = 0.08;
  const mk = (bw, bd, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.004, bd), mat); m.position.set(x, 0.004, z); return m; };
  grp.add(mk(w, t, 0, -d / 2), mk(w, t, 0, d / 2), mk(t, d, -w / 2, 0), mk(t, d, w / 2, 0));
  return grp;
}

/* ---------- construcție ---------- */

export async function build({ L, W, H }){
  const g = new THREE.Group();

  const floorMat  = pbr('PUCementFloor', { tile: 4.5, roughness: 0.55, tint: 0x8e948d, env: 0.75 });
  const colMat    = pbr('GalvSteel', { tile: 0.8, roughness: 0.55, metalness: 1 });
  const frameMat  = flat(0x1c3f66, { metalness: 0.55, roughness: 0.4 });
  const beamMat   = flat(0xd8651f, { metalness: 0.4, roughness: 0.45 });
  const loadMat   = flat(0xffffff, { roughness: 0.8 });
  const palletMat = flat(0xa07c4f, { roughness: 0.85 });
  const tread     = pbr('TreadPlate', { tile: 0.6, roughness: 0.5, metalness: 0.85 });
  const dockLeaf  = pbr('GalvSteel', { tile: 0.35, roughness: 0.5, metalness: 0.6, tint: 0xcfd3d5 });
  const dockFrame = flat(0x2b2f33, { metalness: 0.5, roughness: 0.5 });
  const dockPad   = flat(0x22262a, { roughness: 0.8 });
  const yellow    = flat(0xf3c11d, { roughness: 0.55 });
  const highbay   = flat(0xf5f8ff, { emissive: 0xdcecff, emissiveIntensity: 3.0, roughness: 0.5 });

  g.add(floorPlane(L, W, floorMat, 0, 0.002, 0));

  // --- structura: stalpi de cadru portal, rari, cate un rand pe fiecare perete (onWall) ---
  for (const side of ['N', 'S', 'E', 'W']) g.add(wallColumns(L, W, H, colMat, side));

  // --- niveluri de raft: tintim ~55% din H, nu tavanul minus 1 m — la 12 m rafturile
  // pline pana sus lasa prea putin cer vizibil si culoarele nu se mai citesc de la distanta.
  const beamYs = [];
  { let y = 1.5;
    const capY = Math.min(H - 1.0, H * 0.55);
    while (y + 1.3 + 0.15 <= capY && beamYs.length < 4){ beamYs.push(y); y += 1.6; } }
  const loadCapH = Math.min(1.3, Math.max(0.5, H - 0.7));

  // --- randuri de rafturi, paralele cu L, in perechi spate-in-spate ---
  const marginEnds = 2.6;               // culoar transversal la capete
  const usableL = Math.max(4, L - 2 * marginEnds);
  const bayW = clamp(usableL / Math.max(2, Math.round(usableL / 2.7)), 2.2, 3.0);
  const nBays = Math.max(1, Math.round(usableL / bayW));
  const rowLen = nBays * bayW;
  const rowX0 = -rowLen / 2;

  const southApron = 9;                 // rezerva pt. rampe + manevra camioanelor
  const northMargin = 3;
  const unit = 2.3 + 5.0;               // adancime dubla (spate-in-spate) + culoar reach truck,
                                         // mai lat decat minimul tehnic — la 120 m culoarele
                                         // trebuie sa ramana vizibile de la distanta, nu doar
                                         // traversabile; randuri mai putine si mai lizibile
                                         // vand mai bine spatiul decat un bloc plin.
  const usableW = Math.max(unit, W - southApron - northMargin);
  const nPairs = clamp(Math.floor(usableW / unit), 1, 8);
  const firstZ = -W / 2 + northMargin + 1.15;

  const acc = { posts: [], beams: [], loads: [], pallets: [] };
  const rowZs = [];
  for (let i = 0; i < nPairs; i++){
    const zc = firstZ + i * unit;
    for (const dz of [-0.62, 0.62]){
      const z = zc + dz;
      rowZs.push(z);
      rackRow(rowX0, nBays, bayW, z, beamYs, loadCapH, acc);
    }
  }
  const rackTop = beamYs.length ? Math.min(beamYs[beamYs.length - 1] + 0.6, H - 0.3) : 0;
  if (acc.posts.length) g.add(instances(0.12, rackTop, 0.12, frameMat, acc.posts));
  if (acc.beams.length){
    const beams = instances(bayW - 0.15, 0.14, 0.12, beamMat, acc.beams);
    beams.castShadow = false;                 // vezi nota de la loadBoxes()
    g.add(beams);
  }
  if (acc.pallets.length) g.add(instances(1.0, PALLET_H, 1.2, palletMat, acc.pallets));
  if (acc.loads.length) g.add(loadBoxes(acc.loads, loadMat));

  // --- marcaje de podea: axul fiecarui culoar de trecere dintre perechile de randuri ---
  const aisleZs = [];
  for (let i = 0; i < rowZs.length - 1; i++){
    const gap = rowZs[i + 1] - rowZs[i];
    if (gap > 1.5) aisleZs.push((rowZs[i] + rowZs[i + 1]) / 2);
  }
  for (const z of aisleZs) g.add(aisleLine(rowLen + 1.2, 0, z, yellow));

  // --- rampe de incarcare pe peretele S ---
  const dockAcc = { leaf: [], frame: [], pad: [], level: [] };
  const docks = loadingDocks(L, W, dockAcc);
  if (dockAcc.leaf.length){
    const leaf = instances(docks.doorW - 0.15, docks.doorH, 0.05, dockLeaf, dockAcc.leaf);
    onWall(leaf, 'S'); g.add(leaf);
    const frame = instances(docks.doorW + 0.2, docks.doorH + 0.22, 0.09, dockFrame, dockAcc.frame);
    onWall(frame, 'S'); g.add(frame);
    const pads = instances(0.22, docks.doorH * 0.72, 0.42, dockPad, dockAcc.pad);
    onWall(pads, 'S'); g.add(pads);
    const levels = instances(1.7, 0.06, 1.15, tread, dockAcc.level);
    g.add(levels);
  }

  // --- zona de asteptare (marshalling) intre rafturi si rampe: culoare de stationare
  // vopsite + paleti stationati, ca zona sa nu ramana podea goala fara rost ---
  const apronFrontZ = rowZs.length ? Math.max(...rowZs) + 1.35 : 0;
  const apronBackZ = W / 2 - 3.4;            // liber de manevra chiar la usi
  if (apronBackZ - apronFrontZ > 3.5){
    const zoneDepth = apronBackZ - apronFrontZ;
    const zoneCenterZ = (apronFrontZ + apronBackZ) / 2;
    const zoneWidth = Math.min(rowLen + 2, L - 4);
    const border = laneRect(zoneWidth, zoneDepth, yellow);
    border.position.z = zoneCenterZ;
    g.add(border);
    const nLanes = clamp(Math.round(zoneWidth / 6), 2, 6);
    // liniile de banda sunt paralele cu Z (geometria aisleLine() e lunga pe X, nu se potriveste).
    for (let i = 1; i < nLanes; i++){
      const lx = -zoneWidth / 2 + i * (zoneWidth / nLanes);
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.004, zoneDepth - 0.2), yellow);
      line.position.set(lx, 0.004, zoneCenterZ);
      g.add(line);
    }
    const stagedPallets = [], stagedLoads = [];
    const nStaged = clamp(Math.round(nLanes * 1.5), 4, 12);
    for (let i = 0; i < nStaged; i++){
      const lane = (Math.random() * nLanes) | 0;
      const lx = -zoneWidth / 2 + (lane + 0.5) * (zoneWidth / nLanes) + rand(-0.5, 0.5);
      const lz = zoneCenterZ + rand(-zoneDepth * 0.32, zoneDepth * 0.32);
      const ry = rand(-0.3, 0.3);
      stagedPallets.push([lx, 0, lz, ry]);
      const w = rand(0.78, 0.9), d = rand(0.78, 0.88), h = Math.min(loadCapH, rand(0.45, loadCapH));
      stagedLoads.push([lx, PALLET_H, lz, ry, w, h, d, pick(LOAD_COLORS)]);
    }
    if (stagedPallets.length) g.add(instances(1.0, PALLET_H, 1.2, palletMat, stagedPallets));
    if (stagedLoads.length) g.add(loadBoxes(stagedLoads, loadMat));
  }

  // --- iluminat LED highbay, grid pe tavan ---
  const nlx = clamp(Math.round(L / 9), 2, 20);
  const nlz = clamp(Math.round(W / 9), 2, 14);
  const lampList = [];
  for (let i = 0; i < nlx; i++){
    for (let j = 0; j < nlz; j++){
      lampList.push([-L / 2 + (i + 0.5) * (L / nlx), H - 0.07, -W / 2 + (j + 0.5) * (W / nlz), 0]);
    }
  }
  const lamps = instances(1.4, 0.07, 0.35, highbay, lampList);
  onWall(lamps, 'C');
  g.add(lamps);

  // --- stivuitor + camion ---
  const forkA = await glb('forklift.glb', 2.3, 'z');
  if (forkA && aisleZs.length){
    forkA.rotation.y = Math.PI / 2;
    forkA.position.set(rowX0 + rowLen * 0.32, 0, aisleZs[0]);
    g.add(forkA);
  }
  if (aisleZs.length > 1){
    const forkB = await glb('forklift.glb', 2.3, 'z');
    if (forkB){
      forkB.rotation.y = -Math.PI / 2;
      forkB.position.set(rowX0 + rowLen * 0.68, 0, aisleZs[Math.min(1, aisleZs.length - 1)]);
      g.add(forkB);
    }
  }
  // camioane in zona de manevra, cu spatele spre usile de rampa (nu afara — dincolo de
  // perete nu exista podea, si peretele S se ascunde oricum cand camera se uita spre el).
  const truck = await glb('truck.glb', clamp(L * 0.06, 6, 8), 'z');
  if (truck && docks.n){
    truck.rotation.y = Math.PI;
    truck.position.set(docks.startX, 0, W / 2 - 3.6);
    g.add(truck);
  }
  if (docks.n > 4){
    const truck2 = await glb('truck.glb', clamp(L * 0.06, 6, 8), 'z');
    if (truck2){
      truck2.rotation.y = Math.PI;
      truck2.position.set(docks.startX + docks.spacing * (docks.n - 1), 0, W / 2 - 3.6);
      g.add(truck2);
    }
  }

  return g;
}
