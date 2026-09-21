/* Abator de păsări — hală de procesare, treapta 240–450 m² (preset 24×12×4,2, reper Bona
 * Avis, Ianca/Brăila, 616 m² placați de MedClyn). Detalii verificate în
 * research/rooms/abator.md.
 *
 * Flux de-a lungul liniei aeriene cu cârlige (buclă închisă, formă de stadion, suspendată
 * lângă tavan): opărire → deplumare → eviscerare/podeste → cameră de răcire. Linia de
 * întoarcere (a doua latură a buclei) e flancată de podeste inox pentru muncitori.
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
  const steel     = pbr('BrushedSteel', { tile: 0.9, metalness: 0.92, roughness: 0.36 });
  const steelDull = pbr('BrushedSteel', { tile: 0.9, metalness: 0.85, roughness: 0.55 });
  const galv      = pbr('GalvSteel',    { tile: 0.8, metalness: 0.7,  roughness: 0.5 });
  const tread     = pbr('TreadPlate',   { tile: 0.55, metalness: 0.8, roughness: 0.55 });
  const rubberMat = pbr('Rubber',       { tile: 0.5, roughness: 0.95 });
  const floorMat  = pbr('PUCementFloor',{ tile: 3.2, maps: ['color', 'normal', 'rough', 'ao'], roughness: 0.5, tint: 0x9aa89f });
  const darkPlastic = flat(0x1b1d1f, { roughness: 0.45 });
  const yellow    = flat(0xf2c200, { roughness: 0.5 });
  const whiteCoat = flat(0xf1f0ea, { roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const ledStrip  = flat(0xf2f8ff, { emissive: 0xdcecff, emissiveIntensity: 2.4, roughness: 0.4 });
  const waterMat  = flat(0x2d4a4f, { roughness: 0.25, metalness: 0.1 });
  const doorFabric= flat(0xd8d2b8, { roughness: 0.65 });

  /* ---------- pardoseală ---------- */
  g.add(floorPlane(L, W, floorMat, 0, 0.002, 0));

  /* ================= LINIA AERIANĂ CU CÂRLIGE (buclă tip stadion) ================= */
  const half = clamp((L - 2.6) / 2, 0.9, 55);
  const turnR = clamp(Math.min(W, 8) * 0.2, 0.65, 2.0);
  const rClamped = Math.min(turnR, Math.max(W / 2 - 0.7, 0.5));
  const railY = clamp(H - 0.7, 2.05, 3.0);

  const pathPts = [];
  const ARC_N = 14;
  pathPts.push(new THREE.Vector3(-half, railY, -rClamped));
  pathPts.push(new THREE.Vector3(half, railY, -rClamped));
  for (let i = 1; i < ARC_N; i++){
    const th = -Math.PI / 2 + (Math.PI * i) / ARC_N;
    pathPts.push(new THREE.Vector3(half + rClamped * Math.cos(th), railY, rClamped * Math.sin(th)));
  }
  pathPts.push(new THREE.Vector3(half, railY, rClamped));
  pathPts.push(new THREE.Vector3(-half, railY, rClamped));
  for (let i = 1; i < ARC_N; i++){
    const th = Math.PI / 2 + (Math.PI * i) / ARC_N;
    pathPts.push(new THREE.Vector3(-half + rClamped * Math.cos(th), railY, rClamped * Math.sin(th)));
  }
  const curve = new THREE.CatmullRomCurve3(pathPts, true, 'catmullrom', 0.05);
  const tubeSeg = clamp(Math.round(curve.getLength() * 3), 60, 400);
  const railTube = new THREE.Mesh(new THREE.TubeGeometry(curve, tubeSeg, 0.028, 6, true), galv);
  railTube.castShadow = railTube.receiveShadow = true;
  g.add(railTube);

  // structura de susținere: stâlpi verticali rari, ancorați în tavan (nu în pardoseală, ca
  // să nu aglomereze podeaua) — reprezentați ca tije scurte de la tavan la șină
  const nHangers = clamp(Math.round((2 * (half + rClamped * Math.PI / 2 * 2)) / 3.2), 6, 40);
  const hangerLen = Math.max(H - railY, 0.05);
  for (let i = 0; i < nHangers; i++){
    const t = i / nHangers;
    const p = curve.getPointAt(t);
    g.add(cyl(0.014, hangerLen, galv, p.x, railY, p.z, 6));
  }

  // cârlige (shackles) instanțiate, la interval regulat de-a lungul buclei
  const loopLen = curve.getLength();
  const hookGap = 0.16;
  const nHooks = clamp(Math.round(loopLen / hookGap), 40, 420);
  const hookDrop = 0.11;
  const hookList = [];
  for (let i = 0; i < nHooks; i++){
    const p = curve.getPointAt(i / nHooks);
    hookList.push([p.x, railY - hookDrop, p.z, 0]);
  }
  g.add(instances(0.012, hookDrop, 0.025, steelDull, hookList));

  /* ================= LINIA DE PROCES (latura N, z = -rClamped) ================= */
  const processZ = -rClamped;
  const runLen = 2 * half;
  const startX = -half + 0.6;
  const endX = half - 0.6;

  // opărire (scalder) — bazin inox cu capac
  const scalderX = startX + 0.7;
  {
    const sg = new THREE.Group();
    const tankL = 1.5, tankW = 0.85, tankH = 0.72;
    sg.add(rbox(tankL, tankH, tankW, steel, scalderX, 0, processZ, 0.04));
    sg.add(rbox(tankL - 0.06, 0.05, tankW - 0.06, steelDull, scalderX, tankH, processZ, 0.02));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      sg.add(cyl(0.03, 0.12, steelDull, scalderX + sx * (tankL / 2 - 0.1), 0, processZ + sz * (tankW / 2 - 0.1), 8));
    });
    // abur / apă — luciu de suprafață simplu (fără animație, doar material)
    sg.add(box(tankL - 0.12, 0.01, tankW - 0.12, waterMat, scalderX, tankH - 0.02, processZ));
    g.add(sg);
  }

  // deplumare (plucker) — tambur vertical cu degete de cauciuc instanțiate
  const pluckerX = startX + 2.5;
  {
    const pg = new THREE.Group();
    const drumR = 0.42, drumH = 0.95;
    pg.add(cyl(drumR, drumH, whiteCoat, pluckerX, 0.15, processZ, 18));
    pg.add(cyl(drumR + 0.01, 0.04, steelDull, pluckerX, 0.15, processZ, 18));
    pg.add(cyl(drumR + 0.01, 0.04, steelDull, pluckerX, 0.15 + drumH, processZ, 18));
    const fingerList = [];
    const nFingers = 36;
    for (let i = 0; i < nFingers; i++){
      const a = (i / nFingers) * Math.PI * 2;
      const fx = pluckerX + Math.cos(a) * (drumR + 0.02);
      const fz = processZ + Math.sin(a) * (drumR + 0.02);
      fingerList.push([fx, 0.15 + drumH * 0.15, fz, a]);
    }
    const fingerGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.22, 6);
    fingerGeo.translate(0, 0.11, 0);
    fingerGeo.rotateX(Math.PI / 2.1);
    const fingerMesh = new THREE.InstancedMesh(fingerGeo, darkPlastic, fingerList.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    fingerList.forEach(([x, y, z, a], i) => {
      e.set(0, -a, 0); q.setFromEuler(e); pos.set(x, y, z);
      fingerMesh.setMatrixAt(i, m4.compose(pos, q, one));
    });
    fingerMesh.castShadow = true;
    pg.add(fingerMesh);
    // suport/cadru
    pg.add(box(0.5, 0.03, 0.5, galv, pluckerX, 0.0, processZ));
    g.add(pg);
  }

  // module de eviscerare/lucru repetate pe restul liniei de proces
  {
    const zoneStart = pluckerX + 0.9;
    const zoneLen = Math.max(endX - 1.6 - zoneStart, 0);
    const nMod = clamp(Math.round(zoneLen / 1.9), 0, 12);
    for (let i = 0; i < nMod; i++){
      const mx = zoneStart + (zoneLen / nMod) * (i + 0.5);
      const grp = new THREE.Group();
      grp.add(box(1.3, 0.035, 0.7, steel, mx, 0.88, processZ));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        grp.add(cyl(0.018, 0.88, steel, mx + sx * 0.58, 0, processZ + sz * 0.28, 8));
      });
      grp.add(box(1.1, 0.02, 0.55, steelDull, mx, 0.5, processZ));
      g.add(grp);
    }
  }

  // cameră de răcire (chiller) — capăt de linie, incintă izolată cu ușă și perdea de fâșii
  const chillerX = endX - 0.9;
  {
    const cg = new THREE.Group();
    const cw = 1.7, cd = 1.5, ch = Math.min(H - 0.3, 2.6);
    cg.add(rbox(cw, ch, cd, whiteCoat, chillerX, 0, processZ, 0.05));
    // ușă + perdea pe fața dinspre interior (spre +z, către culoar)
    const doorW = 0.9;
    cg.add(box(doorW, ch - 0.16, 0.05, steelDull, chillerX, 0, processZ + cd / 2 + 0.02));
    const stripN = 6;
    const stripMat = flat(0xe8c34a, { roughness: 0.35, opacity: 0.5, transmission: 0.2 });
    for (let i = 0; i < stripN; i++){
      const sx = -doorW / 2 + 0.1 + (i * (doorW - 0.2)) / (stripN - 1);
      cg.add(box(0.1, (ch - 0.3) * 0.65, 0.006, stripMat, chillerX + sx, -0.05, processZ + cd / 2 + 0.05));
    }
    g.add(cg);
  }

  /* ================= LATURA DE ÎNTOARCERE (S, z = +rClamped) — podeste + mese ================= */
  const walkZ = rClamped;
  {
    const platH = 0.42;
    const zoneLen = runLen - 1.6;
    const nMod = clamp(Math.round(zoneLen / 2.3), 1, 10);
    const modW = zoneLen / nMod;
    for (let i = 0; i < nMod; i++){
      const mx = -half + 0.8 + modW * (i + 0.5);
      const grp = new THREE.Group();
      const platW = Math.min(modW - 0.25, 2.0), platD = 0.85;
      grp.add(box(platW, 0.04, platD, tread, mx, platH - 0.04, walkZ));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        grp.add(cyl(0.03, platH - 0.04, galv, mx + sx * (platW / 2 - 0.08), 0, walkZ + sz * (platD / 2 - 0.08), 8));
      });
      // balustradă spre exterior (departe de linie)
      const railZ2 = walkZ + platD / 2;
      grp.add(box(platW, 0.02, 0.02, galv, mx, platH + 0.9, railZ2));
      grp.add(box(platW, 0.02, 0.02, galv, mx, platH + 0.5, railZ2));
      [-1, 1].forEach((s) => grp.add(cyl(0.015, 0.9, galv, mx + s * (platW / 2 - 0.03), platH, railZ2, 6)));
      // masă de lucru inox deasupra podestei
      grp.add(box(platW - 0.15, 0.03, platD - 0.2, steel, mx, platH + 0.78, walkZ - 0.05));
      g.add(grp);
    }
  }

  /* ---- rigolă centrală, sub axa buclei ---- */
  {
    const drainLen = runLen - 1.0;
    if (drainLen > 1){
      g.add(box(drainLen, 0.03, 0.2, steelDull, 0, 0, 0));
      g.add(box(drainLen, 0.006, 0.14, steelDull, 0, 0.028, 0));
    }
  }

  /* ================= PERETE E — ușă rapidă rulantă ================= */
  {
    const doorGrp = new THREE.Group();
    const doorW = Math.min(2.4, W * 0.4), doorH = Math.min(2.6, H - 0.4);
    doorGrp.add(box(0.1, doorH + 0.3, doorW + 0.24, galv, L / 2 - 0.05, 0, 0)); // toc/ghidaje
    const roll = cyl(0.11, doorW, galv, 0, 0, 0, 12);
    roll.rotation.x = Math.PI / 2;
    roll.position.set(L / 2 - 0.08, doorH + 0.1, 0);
    doorGrp.add(roll);
    doorGrp.add(box(0.04, doorH - 0.12, doorW - 0.1, doorFabric, L / 2 - 0.1, 0.05, 0));
    onWall(doorGrp, 'E');
    g.add(doorGrp);
  }

  /* ================= PERETE W — spălător mâini/cizme + tavă cu apă ================= */
  {
    const wg = new THREE.Group();
    const wz = processZ - 0.3;
    wg.add(rbox(0.42, 0.85, 0.4, steel, -L / 2 + 0.22, 0, wz, 0.02));
    wg.add(cyl(0.014, 0.3, steel, -L / 2 + 0.22, 0.85, wz - 0.12, 8));
    // tavă de dezinfectat cizme, jos
    wg.add(box(0.5, 0.06, 0.7, steelDull, -L / 2 + 0.3, 0, wz + 0.6));
    wg.add(box(0.44, 0.03, 0.64, waterMat, -L / 2 + 0.3, 0.03, wz + 0.6));
    onWall(wg, 'W');
    g.add(wg);
  }

  /* ---- jgheab de cabluri pe peretele W, pe toată lungimea ---- */
  {
    const trayGrp = new THREE.Group();
    const trayLen = Math.max(L - 1.2, 1);
    trayGrp.add(box(trayLen, 0.06, 0.14, galv, 0, H - 0.4, -W / 2 + 0.1));
    onWall(trayGrp, 'N');
    g.add(trayGrp);
  }

  /* ---- bolarzi galbeni lângă scalder/chiller (zone fierbinți/pericol) ---- */
  [[scalderX - 0.9, processZ + 0.65], [chillerX + 0.9, processZ + 0.65]].forEach(([bx, bz]) => {
    g.add(cyl(0.06, 0.6, yellow, bx, 0, bz, 12));
    g.add(cyl(0.09, 0.03, darkPlastic, bx, 0, bz, 14));
  });

  /* ================= tavan — iluminat wash-down IP69, rar, pe ambele laturi ================= */
  {
    const ceilGrp = new THREE.Group();
    const barLen = Math.min(2.6, half * 0.3);
    const nBars = clamp(Math.round(runLen / 3.6), 2, 12);
    [processZ, walkZ].forEach((z) => {
      for (let i = 0; i < nBars; i++){
        const bx = -half + (runLen / nBars) * (i + 0.5);
        ceilGrp.add(box(barLen, 0.06, 0.1, ledStrip, bx, H - 0.05, z));
        ceilGrp.add(box(barLen + 0.03, 0.015, 0.13, darkPlastic, bx, H - 0.02, z));
      }
    });
    onWall(ceilGrp, 'C');
    g.add(ceilGrp);
  }

  return g;
}
