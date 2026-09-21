/* Măcelărie / carmangerie cu laborator — treapta 40–240 m² (preset 14×9×3,5, reper AYT
 * Măcelărie & Market București, ~300 m² placați de MedClyn). Detalii verificate în
 * research/rooms/macelarie.md.
 *
 * Zonare de-a lungul adâncimii (z, N → S):
 *   [N] vitrine frigorifice de vânzare → culoar client → mese de lucru din inox
 *   (zona de procesare) → șină cu cârlige pe peretele S.
 * Ușa camerei frigorifice și lavoarul stau pe pereții E/W, ca uși/dotări reale.
 */
import { THREE, pbr, flat, box, floorPlane, cyl, instances, onWall } from './kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function rbox(w, h, d, mat, x, y, z, radius = 0.02, seg = 2){
  const geo = new RoundedBoxGeometry(Math.max(w, 0.02), Math.max(h, 0.02), Math.max(d, 0.02), seg, Math.min(radius, w / 2, h / 2, d / 2));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export async function build({ L, W, H }){
  const g = new THREE.Group();

  /* ---------- materiale ---------- */
  const steel      = pbr('BrushedSteel', { tile: 0.9, metalness: 0.92, roughness: 0.38 });
  const steelDull  = pbr('BrushedSteel', { tile: 0.9, metalness: 0.85, roughness: 0.55 });
  const galv       = pbr('GalvSteel',    { tile: 0.8, metalness: 0.7,  roughness: 0.5 });
  const rubberMat  = pbr('Rubber',       { tile: 0.5, roughness: 0.95 });
  const floorMat   = pbr('QuarryTile',   { tile: 0.6, roughness: 0.88, tint: 0xa8938a });   // teracota stinsă, nu portocaliu
  const glass      = flat(0xdcecef, { transmission: 0.93, thickness: 0.015, roughness: 0.06, metalness: 0 });
  const whiteCoat  = flat(0xf1f0ea, { roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const darkPlastic= flat(0x1b1d1f, { roughness: 0.45 });
  const yellow     = flat(0xf2c200, { roughness: 0.5 });
  const flesh      = flat(0xd9a599, { roughness: 0.62 });
  const fleshDark  = flat(0xb9695f, { roughness: 0.6 });
  const crateBlue  = flat(0x1c4e8c, { roughness: 0.4 });
  const crateRed   = flat(0xb31224, { roughness: 0.4 });
  const emissive   = flat(0xfff6e6, { emissive: 0xfff0d8, emissiveIntensity: 1.6, roughness: 0.5 });
  const ledStrip   = flat(0xfff8ec, { emissive: 0xffe9c2, emissiveIntensity: 2.6, roughness: 0.4 });

  /* ---------- pardoseală ---------- */
  g.add(floorPlane(L, W, floorMat, 0, 0.002, 0));

  // rigolă liniară inox, pe axa lungă, în treimea dinspre S (zona de procesare)
  const drainZ = W / 2 - Math.min(2.2, W * 0.22);
  const drainLen = L - 1.4;
  if (drainLen > 1){
    const drain = box(drainLen, 0.03, 0.16, steelDull, 0, 0.0, drainZ);
    drain.rotation.y = 0;
    g.add(drain);
    const grateW = drainLen;
    const grate = box(grateW, 0.006, 0.1, steelDull, 0, 0.028, drainZ);
    g.add(grate);
  }

  /* ================= ZONA DE VÂNZARE (lângă peretele N) ================= */
  const counterDepth = 0.82, counterH = 1.18;
  const counterFrontZ = -W / 2 + counterDepth / 2 + 0.1;
  const marginX = 0.7;
  const availW = Math.max(L - marginX * 2, 1.4);
  const nCounters = clamp(Math.round(availW / 2.6), 1, 9);
  const counterUnit = availW / nCounters;
  const counterW = Math.min(counterUnit - 0.12, 3.0);

  for (let i = 0; i < nCounters; i++){
    const cx = -L / 2 + marginX + counterUnit * (i + 0.5);
    const grp = new THREE.Group();
    // carcasă inferioară (compresor + dulap)
    grp.add(rbox(counterW, counterH * 0.62, counterDepth, whiteCoat, cx, 0, counterFrontZ, 0.02));
    // plintă neagră
    grp.add(box(counterW - 0.04, 0.06, counterDepth - 0.04, darkPlastic, cx, 0, counterFrontZ));
    // blat inox
    grp.add(box(counterW + 0.02, 0.03, counterDepth + 0.02, steel, cx, counterH * 0.62, counterFrontZ));
    // sticlă curbată frontală (aproximată printr-un cilindru tăiat: folosim un plan înclinat + un sfert de cilindru)
    const curveR = 0.32;
    const curveGeo = new THREE.CylinderGeometry(curveR, curveR, counterW - 0.06, 20, 1, true, Math.PI * 0.02, Math.PI * 0.48);
    const curveMesh = new THREE.Mesh(curveGeo, glass);
    curveMesh.rotation.z = Math.PI / 2;
    curveMesh.position.set(cx, counterH * 0.62 + curveR * 0.72, counterFrontZ - counterDepth / 2 + 0.06);
    curveMesh.castShadow = false;
    grp.add(curveMesh);
    // capac superior plat sticlă (partea din spate a vitrinei)
    grp.add(box(counterW - 0.06, 0.02, counterDepth * 0.4, glass, cx, counterH * 0.62 + curveR * 1.15, counterFrontZ + counterDepth * 0.18));
    // tavă de expunere cu produs stilizat (blocuri roz — carne fără detaliu figurativ, doar formă)
    const trayN = clamp(Math.round((counterW - 0.2) / 0.4), 1, 6);
    for (let t = 0; t < trayN; t++){
      const tx = cx - counterW / 2 + 0.2 + t * ((counterW - 0.4) / Math.max(trayN - 1, 1));
      grp.add(rbox(0.32, 0.09, counterDepth * 0.55, t % 2 ? flesh : fleshDark, tx, counterH * 0.62 + 0.03, counterFrontZ, 0.015));
    }
    // reper roz cald în interior (lumină de expunere) — emisiv discret, fără PointLight
    grp.add(box(counterW - 0.1, 0.015, 0.03, flat(0xffd9c2, { emissive: 0xffb488, emissiveIntensity: 1.2 }), cx, counterH * 0.62 + curveR * 1.05, counterFrontZ - 0.05));
    g.add(grp);
  }

  // bollarzi galbeni la capetele șirului de vitrine
  const bollardZ = counterFrontZ + counterDepth / 2 + 0.35;
  [-1, 1].forEach((s) => {
    const bx = s * (availW / 2 + marginX - 0.25);
    g.add(cyl(0.06, 0.65, yellow, bx, 0, bollardZ, 12));
    g.add(cyl(0.09, 0.03, darkPlastic, bx, 0, bollardZ, 14));
  });

  /* ================= ZONA DE PROCESARE (spre S) ================= */
  const aisle = clamp(W * 0.13, 1.0, 1.7);
  const procStartZ = counterFrontZ + counterDepth / 2 + aisle;
  const railClearance = 0.9; // fâșie liberă lângă peretele S pentru șina cu cârlige
  const procEndZ = W / 2 - railClearance;
  const procDepth = Math.max(procEndZ - procStartZ, 0.6);

  const tableH = 0.9, tableD = 0.75;
  // linii continue de lucru (module lipite cap la cap), nu mese răzlețe: așa arată un laborator
  const rows = clamp(Math.round(procDepth / 2.6), 1, 2);
  const rowGap = procDepth / rows;
  const tMarginX = clamp(L * 0.16, 1.4, 3.2);   // capete libere pentru trecere și utilaje
  const tAvailW = Math.max(L - tMarginX * 2, 1.2);
  const perRow = clamp(Math.round(tAvailW / 1.6), 1, 14);
  const tUnit = tAvailW / perRow;
  const tableW = tUnit - 0.01;

  for (let r = 0; r < rows; r++){
    const tz = procStartZ + rowGap * (r + 0.5);
    for (let i = 0; i < perRow; i++){
      const tx = -L / 2 + tMarginX + tUnit * (i + 0.5);
      const grp = new THREE.Group();
      // picioare tubulare inox
      const legR = 0.02;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        grp.add(cyl(legR, tableH - 0.03, steel, tx + sx * (tableW / 2 - 0.06), 0, tz + sz * (tableD / 2 - 0.06), 8));
      });
      // etajeră inferioară
      grp.add(box(tableW - 0.1, 0.02, tableD - 0.1, steelDull, tx, tableH * 0.35, tz));
      // blat
      grp.add(box(tableW, 0.035, tableD, steel, tx, tableH - 0.03, tz));
      // muchie ridicată perimetrală subțire (blat de tranșare cu prag)
      grp.add(box(tableW, 0.02, 0.02, steelDull, tx, tableH, tz - tableD / 2 + 0.01));
      grp.add(box(tableW, 0.02, 0.02, steelDull, tx, tableH, tz + tableD / 2 - 0.01));
      g.add(grp);
    }
  }

  /* ---- utilaje: fierăstrău panglică, tocător, ambalator vacuum — lângă peretele W, în zona de procesare ---- */
  const eqX = -L / 2 + 0.55;
  const eqZs = [];
  const eqCount = clamp(Math.round(procDepth / 1.6), 1, 3);
  for (let i = 0; i < eqCount; i++) eqZs.push(procStartZ + (procDepth / eqCount) * (i + 0.5));

  // fierăstrău panglică (bandsaw): corp în C, roți sus/jos, lamă verticală
  if (eqZs[0] !== undefined){
    const bz = eqZs[0];
    const bs = new THREE.Group();
    const bodyH = Math.min(1.75, H - 0.4);
    bs.add(rbox(0.5, bodyH, 0.62, whiteCoat, eqX, 0, bz, 0.03));
    bs.add(cyl(0.19, 0.06, darkPlastic, eqX, bodyH - 0.22, bz - 0.02, 20));
    bs.add(cyl(0.19, 0.06, darkPlastic, eqX, 0.42, bz - 0.02, 20));
    bs.add(box(0.02, bodyH - 0.5, 0.01, steel, eqX, 0.42, bz + 0.28));
    bs.add(box(0.55, 0.04, 0.5, steel, eqX, 0.5, bz)); // blat de lucru
    g.add(bs);
  }
  // tocător de banc (mincer)
  if (eqZs[1] !== undefined){
    const mz = eqZs[1];
    const mg = new THREE.Group();
    mg.add(rbox(0.34, 0.42, 0.5, steel, eqX, 0.78, mz, 0.02));
    mg.add(cyl(0.07, 0.34, steel, eqX, 1.0, mz - 0.28, 12));
    mg.add(cyl(0.045, 0.05, darkPlastic, eqX, 1.0 + 0.17, mz - 0.32, 12));
    mg.add(cyl(0.1, 0.02, steelDull, eqX, 0.78 + 0.42, mz, 12));
    // suport / masă sub el
    mg.add(box(0.5, 0.03, 0.55, steelDull, eqX, 0.78, mz));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      mg.add(cyl(0.018, 0.78, steel, eqX + sx * 0.22, 0, mz + sz * 0.24, 8));
    });
    g.add(mg);
  }
  // ambalator vacuum
  if (eqZs[2] !== undefined){
    const vz = eqZs[2];
    const vg = new THREE.Group();
    vg.add(box(0.6, 0.03, 0.5, steelDull, eqX, 0.78, vz));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      vg.add(cyl(0.018, 0.78, steel, eqX + sx * 0.26, 0, vz + sz * 0.21, 8));
    });
    vg.add(rbox(0.5, 0.16, 0.4, whiteCoat, eqX, 0.78, vz, 0.02));
    vg.add(box(0.42, 0.01, 0.05, darkPlastic, eqX, 0.78 + 0.16, vz - 0.15));
    g.add(vg);
  }

  /* ---- E2 crates stivuite, colț lângă utilaje ---- */
  const crateCornerX = -L / 2 + 0.5;
  const crateCornerZ = Math.min(procEndZ - 0.35, W / 2 - 0.5);
  if (crateCornerZ > procStartZ){
    const crateList = [];
    const stackN = clamp(Math.round(L / 10), 1, 3);
    for (let s = 0; s < stackN; s++){
      const cx = crateCornerX + s * 0.46;
      for (let lvl = 0; lvl < 4; lvl++) crateList.push([cx, lvl * 0.235, crateCornerZ, (s + lvl) % 2 ? 0.02 : -0.02]);
    }
    g.add(instances(0.4, 0.22, 0.3, crateBlue, crateList));
    // câteva lăzi roșii deasupra, ca variație
    const redList = crateList.filter((_, i) => i % 5 === 0).map(([x, y, z]) => [x, y + 0.02, z, 0.05]);
    if (redList.length) g.add(instances(0.4, 0.22, 0.3, crateRed, redList));
  }

  /* ================= PERETE S — șină cu cârlige ================= */
  {
    const railY = clamp(H - 0.55, 1.9, 2.5);
    const railOut = 0.4; // distanță de la peretele S spre interior
    const railZ = W / 2 - railOut;
    const railGroup = new THREE.Group();
    const railLen = Math.max(L - 1.2, 1);
    railGroup.add(box(railLen, 0.05, 0.05, galv, 0, railY, railZ));
    // bride de prindere pe perete
    const nBrackets = clamp(Math.round(railLen / 1.8), 2, 8);
    for (let i = 0; i < nBrackets; i++){
      const bx = -railLen / 2 + (railLen / (nBrackets - 1 || 1)) * i;
      railGroup.add(box(0.04, 0.04, railOut, steelDull, bx, railY, W / 2 - railOut / 2));
    }
    // cârlige instanțiate
    const hookGap = 0.42;
    const nHooks = clamp(Math.floor(railLen / hookGap), 2, 60);
    const hookDrop = 0.18;
    const hookList = [];
    for (let i = 0; i < nHooks; i++) hookList.push([-railLen / 2 + hookGap * (i + 0.5), railY - hookDrop, railZ, 0]);
    railGroup.add(instances(0.02, hookDrop, 0.02, steelDull, hookList));
    // câteva carcase agățate (siluetă simplă, nu grafică explicită) — LatheGeometry conic,
    // capătul subțire (y=0.63, profil) atârnă chiar sub vârful cârligului
    const carcassProfile = [
      new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.05, 0.02), new THREE.Vector2(0.1, 0.09),
      new THREE.Vector2(0.11, 0.22), new THREE.Vector2(0.09, 0.36), new THREE.Vector2(0.1, 0.5),
      new THREE.Vector2(0.06, 0.6), new THREE.Vector2(0.0, 0.63)
    ];
    const carcassGeo = new THREE.LatheGeometry(carcassProfile, 10);
    const nCarcass = clamp(Math.floor(nHooks / 5), 0, 10);
    for (let i = 0; i < nCarcass; i++){
      const idx = Math.floor((i + 0.5) * (nHooks / nCarcass));
      const hx = -railLen / 2 + hookGap * (idx + 0.5);
      const cm = new THREE.Mesh(carcassGeo, i % 2 ? flesh : fleshDark);
      cm.position.set(hx, railY - hookDrop - 0.63, railZ);
      cm.castShadow = cm.receiveShadow = true;
      railGroup.add(cm);
    }
    onWall(railGroup, 'S');
    g.add(railGroup);
  }

  /* ================= PERETE E — ușă cameră frigorifică ================= */
  {
    const doorW = 1.05, doorH = Math.min(2.15, H - 0.25);
    const doorGrp = new THREE.Group();
    const doorZ = 0;
    doorGrp.add(box(0.08, doorH + 0.12, doorW + 0.16, steelDull, L / 2 - 0.04, 0, doorZ)); // toc
    doorGrp.add(box(0.05, doorH, doorW, whiteCoat, L / 2 - 0.06, 0, doorZ));
    // mâner orizontal
    doorGrp.add(box(0.03, 0.5, 0.03, steel, L / 2 - 0.09, 0.9, doorZ + doorW / 2 - 0.12));
    // perdea de fâșii PVC
    const stripN = 8;
    for (let i = 0; i < stripN; i++){
      const sz = -doorW / 2 + 0.14 + (i * (doorW - 0.28)) / (stripN - 1);
      const strip = box(0.1, doorH * 0.62, 0.006, flat(0xE8C34A, { roughness: 0.35, opacity: 0.55, transmission: 0.25 }), L / 2 - 0.14, 0, doorZ + sz);
      doorGrp.add(strip);
    }
    onWall(doorGrp, 'E');
    g.add(doorGrp);
  }

  /* ================= PERETE W — lavoar cu pedală ================= */
  {
    const sinkGrp = new THREE.Group();
    const sz = procStartZ + 0.4;
    const sy = 0.85;
    sinkGrp.add(rbox(0.4, 0.18, 0.34, steel, -L / 2 + 0.2, sy, sz, 0.02));
    sinkGrp.add(cyl(0.015, 0.28, steel, -L / 2 + 0.2, sy + 0.18, sz - 0.1, 8));
    sinkGrp.add(box(0.02, 0.5, 0.02, steel, -L / 2 + 0.06, 0, sz));
    // pedală genunchi
    sinkGrp.add(box(0.05, 0.14, 0.05, steelDull, -L / 2 + 0.28, 0, sz + 0.24));
    onWall(sinkGrp, 'W');
    g.add(sinkGrp);
  }

  /* ================= tavan — corpuri de iluminat emisive, rare ================= */
  {
    const barLen = Math.min(2.4, L * 0.16);
    const nBars = clamp(Math.round(L / 3.2), 2, 10);
    const ceilGrp = new THREE.Group();
    for (let i = 0; i < nBars; i++){
      const bx = -L / 2 + (L / nBars) * (i + 0.5);
      const bar = box(barLen, 0.06, 0.1, ledStrip, bx, H - 0.06, 0);
      ceilGrp.add(bar);
      ceilGrp.add(box(barLen + 0.03, 0.015, 0.13, darkPlastic, bx, H - 0.03, 0));
    }
    onWall(ceilGrp, 'C');
    g.add(ceilGrp);
  }

  return g;
}
