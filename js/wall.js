/* Peretele contaminat.
 *
 * Nu e un shader procedural: e un perete real de faianta (harti PBR fotografiate,
 * ambientCG Tiles133D, CC0) peste care creste un biofilm viu, iluminat de un HDRI
 * de hala industriala. Mana stearsa peste el pictaeza intr-un render target, iar
 * masca aia decide, pixel cu pixel, daca vezi faianta murdara sau panoul MedClyn.
 */

import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ------------------------------------------------------------------ *
 * Constante fizice — peretele e masurat in metri, ca sa putem vorbi
 * despre latimea placii (1,22 m) si despre raza mainii in unitati reale.
 * ------------------------------------------------------------------ */
const WALL_W = 9.2;         // m
const WALL_H = 5.3;         // m
const TEX_METERS = 3.10;    // o repetitie de textura = ~13 placi de 24 cm
const PANEL_W = 1.22;       // latimea placii MedClyn
const BRUSH_R = 0.62;       // raza "mainii", m

const MASK_W = 1024;
const MASK_H = 592;

/* ------------------------------------------------------------------ *
 * GLSL comun
 * ------------------------------------------------------------------ */
const NOISE = /* glsl */`
  float mc_hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  vec2  mc_hash22(vec2 p){
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
  }
  float mc_noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mc_hash12(i), mc_hash12(i + vec2(1.0, 0.0)), u.x),
               mix(mc_hash12(i + vec2(0.0, 1.0)), mc_hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float mc_fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ v += a * mc_noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  // Colonii: celule Worley care se misca incet. x = distanta la centru, y = id-ul celulei.
  vec2 mc_colony(vec2 p, float t){
    vec2 n = floor(p), f = fract(p);
    float md = 8.0, mid = 0.0;
    for (int j = -1; j <= 1; j++){
      for (int i = -1; i <= 1; i++){
        vec2 g = vec2(float(i), float(j));
        vec2 h = mc_hash22(n + g);
        vec2 o = 0.5 + 0.42 * sin(t * 0.22 + 6.2831 * h);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < md){ md = d; mid = h.x; }
      }
    }
    return vec2(sqrt(md), mid);
  }
`;

/* Masca: fiecare cadru se intinde putin singura, cu un front rupt de zgomot,
 * ca sa nu arate ca un cerc. */
const SPREAD_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tPrev;
  uniform vec2  uTexel;
  uniform float uTime;
  uniform float uCreep;
  ${NOISE}
  void main(){
    float c = texture2D(tPrev, vUv).r;
    float n = mc_noise(vUv * 220.0 + uTime * 0.4);
    float adv = uCreep * (0.25 + n * 1.5);
    float m = c;
    for (int j = -1; j <= 1; j++){
      for (int i = -1; i <= 1; i++){
        vec2 o = vec2(float(i), float(j));
        float len = length(o);
        if (len < 0.001) continue;
        m = max(m, texture2D(tPrev, vUv + o * uTexel).r - adv * len);
      }
    }
    gl_FragColor = vec4(max(c, m), 0.0, 0.0, 1.0);
  }
`;

const QUAD_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const BRUSH_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uStrength;
  ${NOISE}
  void main(){
    float d = length(vUv - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.30, 1.0, d);
    a *= 0.75 + 0.25 * mc_fbm(vUv * 9.0);   // marginea urmei nu e perfect rotunda
    gl_FragColor = vec4(pow(max(a, 0.0), 1.5) * uStrength, 0.0, 0.0, 1.0);
  }
`;

/* ------------------------------------------------------------------ */

export function createWall(opts){
  const canvas = opts.canvas;
  const reduced = opts.reduced === true;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(0.0, 0.0, 8.2);

  /* ---- masca pictabila: doua render target-uri in ping-pong ---- */
  const rtOpts = {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
    depthBuffer: false, stencilBuffer: false
  };
  let rtA = new THREE.WebGLRenderTarget(MASK_W, MASK_H, rtOpts);
  let rtB = new THREE.WebGLRenderTarget(MASK_W, MASK_H, rtOpts);

  const maskCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(1, 1);

  const spreadMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: SPREAD_FRAG,
    uniforms: {
      tPrev: { value: null },
      uTexel: { value: new THREE.Vector2(1 / MASK_W, 1 / MASK_H) },
      uTime: { value: 0 },
      uCreep: { value: 0.0045 }
    },
    depthTest: false, depthWrite: false
  });
  const spreadScene = new THREE.Scene();
  spreadScene.add(new THREE.Mesh(quadGeo, spreadMat));

  const brushMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: BRUSH_FRAG,
    uniforms: { uStrength: { value: 1.0 } },
    depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor
  });
  const brushMesh = new THREE.Mesh(quadGeo, brushMat);
  brushMesh.scale.set((BRUSH_R * 2) / WALL_W, (BRUSH_R * 2) / WALL_H, 1);
  const brushScene = new THREE.Scene();
  brushScene.add(brushMesh);

  function clearMask(){
    const prev = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 1);
    for (const rt of [rtA, rtB]){ renderer.setRenderTarget(rt); renderer.clear(true, false, false); }
    renderer.setRenderTarget(null);
    renderer.setClearColor(prev, prevAlpha);
  }

  /* ---- incarcare texturi ---- */
  const manager = new THREE.LoadingManager();
  if (opts.onProgress){
    manager.onProgress = (_url, loaded, total) => opts.onProgress(total ? loaded / total : 0);
  }
  const texLoader = new THREE.TextureLoader(manager);

  function loadMap(file, srgb){
    const t = texLoader.load(file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(WALL_W / TEX_METERS, WALL_H / TEX_METERS);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const mapColor = loadMap('tex/tile_color.jpg', true);
  const mapNormal = loadMap('tex/tile_normal.jpg', false);
  const mapRough = loadMap('tex/tile_rough.jpg', false);
  const mapAO = loadMap('tex/tile_ao.jpg', false);
  const mapDisp = loadMap('tex/tile_disp.jpg', false);

  /* ---- materialul ---- */
  const material = new THREE.MeshPhysicalMaterial({
    map: mapColor,
    normalMap: mapNormal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: mapRough,
    aoMap: mapAO,
    aoMapIntensity: 1.0,
    displacementMap: mapDisp,
    displacementScale: 0.055,
    displacementBias: -0.027,
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0.85,
    clearcoat: 1.0,            // luciul GelCoat-ului, aplicat doar unde masca e 1
    clearcoatRoughness: 0.030
  });

  const uniforms = {
    uMask:        { value: null },
    uMaskForce:   { value: -1.0 },
    uScrollClean: { value: 0 },
    uTime:        { value: 0 },
    uBioAmount:   { value: 1.0 },
    uBioBump:     { value: 0.40 },
    uPanelColor:  { value: new THREE.Color(0xeef1f1).convertSRGBToLinear() },
    uEdgeColor:   { value: new THREE.Color(0x24bfcc).convertSRGBToLinear() },   // cyan-ul lor
    uEdgeStrength:{ value: 0.34 },
    uSeams:       { value: WALL_W / PANEL_W },
    uWallW:       { value: WALL_W }
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec2 vWallUv;
        uniform sampler2D uMask;
        uniform float uMaskForce, uScrollClean;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWallUv = uv;`)
      // panoul MedClyn e plan: acolo unde masca e 1, relieful faiantei dispare
      .replace('#include <displacementmap_vertex>', `
        #ifdef USE_DISPLACEMENTMAP
          float mcClean = uMaskForce >= 0.0 ? uMaskForce : texture2D(uMask, uv).r;
          mcClean = max(mcClean, smoothstep(0.0, 1.0, uScrollClean * 1.6 - 0.30));
          transformed += normalize(objectNormal) * (
            texture2D(displacementMap, vDisplacementMapUv).x * displacementScale * (1.0 - mcClean) + displacementBias * (1.0 - mcClean)
          );
        #endif`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vWallUv;
        uniform sampler2D uMask;
        uniform float uTime, uBioAmount, uBioBump, uEdgeStrength, uSeams, uWallW, uMaskForce, uScrollClean;
        uniform vec3 uPanelColor, uEdgeColor;
        float mcMask, mcBio, mcEdge;
        ${NOISE}`)

      .replace('#include <map_fragment>', `#include <map_fragment>
        mcMask = uMaskForce >= 0.0 ? uMaskForce : texture2D(uMask, vWallUv).r;

        // Pagina se curata pe masura ce cobori: acelasi front oblic, rupt de zgomot.
        float mcWipe = (vWallUv.x * 0.42 + (1.0 - vWallUv.y) * 0.58)
                     + (mc_fbm(vWallUv * 3.2) - 0.5) * 0.5;
        mcMask = max(mcMask, smoothstep(mcWipe - 0.22, mcWipe + 0.22, uScrollClean * 1.6 - 0.30));

        // --- variatie macro: rupe repetitia evidenta a texturii ---
        float mcMacro = mc_fbm(vWallUv * vec2(2.6, 1.6));
        diffuseColor.rgb *= mix(mix(0.58, 1.02, mcMacro), 1.0, mcMask);

        // --- unde sta biofilmul: in rost (relief jos) si in pete ---
        float mcAo    = texture2D(aoMap, vAoMapUv).r;
        float mcGrout = 1.0 - smoothstep(0.30, 0.86, mcAo);
        vec2  mcBp    = vWallUv * vec2(uWallW, uWallW * ${(WALL_H / WALL_W).toFixed(4)});
        float mcPatch = smoothstep(0.46, 0.80, mc_fbm(mcBp * 0.62));
        float mcField = clamp(mcGrout * 0.95 + mcPatch * 0.55, 0.0, 1.0);

        // --- coloniile propriu-zise ---
        vec2  mcCol   = mc_colony(mcBp * 88.0, uTime);
        float mcShape = 1.0 - smoothstep(0.16, 0.52 + mcCol.y * 0.24, mcCol.x);
        mcShape *= 0.55 + 0.45 * mc_fbm(mcBp * 26.0);
        mcBio = mcField * mcShape * smoothstep(0.08, 0.46, mc_fbm(mcBp * 2.1 + 3.7));
        mcBio = clamp(mcBio * uBioAmount, 0.0, 1.0) * (1.0 - mcMask);

        // --- culoarea biofilmului: verde-masliniu spre negru, cu pete ruginii ---
        vec3 mcSlime = mix(vec3(0.014, 0.024, 0.011), vec3(0.078, 0.092, 0.024), mcCol.y);
        mcSlime = mix(mcSlime, vec3(0.062, 0.040, 0.019), smoothstep(0.55, 0.92, mc_fbm(mcBp * 1.1 + 11.0)));
        diffuseColor.rgb = mix(diffuseColor.rgb, mcSlime, mcBio * 0.97);

        // --- panoul MedClyn, cu imbinarea la fiecare 1,22 m ---
        float mcSeamD = abs(fract(vWallUv.x * uSeams + 0.5) - 0.5) / uSeams * uWallW;
        float mcSeam  = 1.0 - smoothstep(0.0, 0.009, mcSeamD);
        vec3  mcPanel = mix(uPanelColor, uPanelColor * 0.90, mcSeam * 0.6);
        diffuseColor.rgb = mix(diffuseColor.rgb, mcPanel, mcMask);

        // --- frontul de gel ---
        mcEdge = smoothstep(0.03, 0.28, mcMask) * (1.0 - smoothstep(0.28, 0.82, mcMask));`)

      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.27, mcBio * 0.8);   // biofilm ud
        roughnessFactor = mix(roughnessFactor, 0.035, mcMask);       // GelCoat
        roughnessFactor = clamp(roughnessFactor, 0.03, 1.0);`)

      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        vec3 mcGeoNormal = normal;`)

      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + vec3(dFdx(mcBio), dFdy(mcBio), 0.0) * uBioBump * 3.0);
        normal = normalize(mix(normal, mcGeoNormal, mcMask));`)

      .replace('#include <aomap_fragment>', `
        #ifdef USE_AOMAP
          float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
          ambientOcclusion = mix(ambientOcclusion, 1.0, mcMask);
          reflectedLight.indirectDiffuse *= ambientOcclusion;
          #if defined( USE_CLEARCOAT )
            clearcoatSpecularIndirect *= ambientOcclusion;
          #endif
          #if defined( USE_SHEEN )
            sheenSpecularIndirect *= ambientOcclusion;
          #endif
          #if defined( USE_ENVMAP ) && defined( STANDARD )
            float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
            reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
          #endif
        #endif`)

      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uEdgeColor * mcEdge * uEdgeStrength;`)

      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        material.clearcoat = saturate(material.clearcoat * mcMask);`);
  };
  // clearcoat-ul se aplica doar unde masca e 1 -> luciul apare odata cu panoul
  material.customProgramCacheKey = () => 'medclyn-wall-v1';

  const geo = new THREE.PlaneGeometry(WALL_W, WALL_H, 320, 190);
  const wall = new THREE.Mesh(geo, material);
  wall.rotation.y = -0.13;   // usor oblic: relieful si reflexiile devin citibile
  scene.add(wall);

  /* ---- lumina ---- */
  // lumina rade peretele dintr-o parte: doar asa se vede relieful rostului
  const key = new THREE.DirectionalLight(0xfff2e0, 1.45);
  key.position.set(-7.0, 2.6, 2.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa9c6d6, 0.28);
  fill.position.set(5.5, -2.0, 4.0);
  scene.add(fill);

  /* ---- HDRI: reflexiile sunt cele care fac panoul sa para real ---- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // Daca panorama nu poate fi incarcata, generam un mediu de studiu procedural:
  // panoul ramane lucios si reflecta ceva, in loc sa arate ca o suprafata moarta.
  function fallbackEnvironment(){
    try {
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    } catch (e){
      console.warn('[medclyn] nu am putut genera mediul de rezerva:', e);
    }
  }

  new RGBELoader(manager).load('hdr/env.hdr',
    (hdr) => {
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
    },
    undefined,
    () => { console.warn('[medclyn] env.hdr indisponibil, folosesc mediul procedural'); fallbackEnvironment(); }
  );

  manager.onLoad = () => {
    clearMask();
    material.clearcoatMap = null;   // clearcoat-ul e modulat prin masca in shader
    if (opts.onReady) opts.onReady();
  };

  /* ---- pointer ---- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const parallax = new THREE.Vector2();
  const parallaxTarget = new THREE.Vector2();
  let lastUv = null;
  let pendingStamps = [];
  let touched = false;
  let idleT = Math.PI * 0.25;

  function pointerTo(e){
    const r = canvas.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    ndc.set(((p.clientX - r.left) / r.width) * 2 - 1, -((p.clientY - r.top) / r.height) * 2 + 1);
    parallaxTarget.set(ndc.x, ndc.y);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(wall, false)[0];
    if (hit && hit.uv) queueStamp(hit.uv.x, hit.uv.y);
    if (!touched){ touched = true; if (opts.onFirstTouch) opts.onFirstTouch(); }
  }

  // Miscarea rapida a mausului ar lasa goluri: interpolam intre cadre.
  function queueStamp(u, v){
    if (lastUv){
      const du = u - lastUv.u, dv = v - lastUv.v;
      const dist = Math.hypot(du * WALL_W, dv * WALL_H);
      const steps = Math.min(28, Math.max(1, Math.ceil(dist / (BRUSH_R * 0.28))));
      for (let i = 1; i <= steps; i++){
        pendingStamps.push({ u: lastUv.u + du * (i / steps), v: lastUv.v + dv * (i / steps) });
      }
    } else {
      pendingStamps.push({ u, v });
    }
    lastUv = { u, v };
  }

  const surface = opts.pointerTarget || window;
  surface.addEventListener('pointermove', pointerTo, { passive: true });
  surface.addEventListener('pointerdown', pointerTo, { passive: true });
  surface.addEventListener('touchmove', (e) => { pointerTo(e); }, { passive: true });
  window.addEventListener('blur', () => { lastUv = null; });

  function reset(){
    clearMask();
    lastUv = null;
    pendingStamps.length = 0;
    touched = false;
    idleT = Math.PI * 0.25;
  }

  /* ---- bucla ---- */
  function updateMask(dt){
    // 1. masca se intinde singura
    spreadMat.uniforms.tPrev.value = rtA.texture;
    spreadMat.uniforms.uTime.value = performance.now() / 1000;
    spreadMat.uniforms.uCreep.value = reduced ? 0.05 : 0.0045;
    renderer.setRenderTarget(rtB);
    renderer.render(spreadScene, maskCam);

    // 2. urmele mainii, peste
    if (pendingStamps.length){
      renderer.autoClear = false;
      for (const s of pendingStamps){
        brushMesh.position.set(s.u - 0.5, s.v - 0.5, 0);
        renderer.render(brushScene, maskCam);
      }
      renderer.autoClear = true;
      pendingStamps.length = 0;
    }
    renderer.setRenderTarget(null);

    const t = rtA; rtA = rtB; rtB = t;
    uniforms.uMask.value = rtA.texture;
  }

  function resize(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // incadram peretele astfel incat sa acopere mereu ecranul
    const needH = WALL_H * 0.62;
    const needW = WALL_W * 0.62;
    const distH = (needH / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const distW = (needW / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / camera.aspect;
    // min, nu max: camera sta la distanta la care AMBELE dimensiuni vizibile
    // raman in perete. Cu max, pe telefon (portret) se departa pana vedea
    // dincolo de marginea peretelui — banda neagra cu muchie dreapta sus.
    camera.position.z = Math.min(distH, distW);
    camera.updateProjectionMatrix();
  }

  function render(dt){
    uniforms.uTime.value = performance.now() / 1000;

    // inainte sa atinga cineva peretele, mana se plimba singura
    if (!touched && !reduced){
      idleT += dt * 0.30;
      const u = 0.5 + Math.sin(idleT) * 0.30 + Math.sin(idleT * 0.37) * 0.07;
      const v = 0.52 + Math.cos(idleT * 0.81) * 0.19;
      queueStamp(u, v);
      parallaxTarget.set((u - 0.5) * 1.4, (v - 0.5) * 1.2);
    }

    updateMask(dt);

    parallax.lerp(parallaxTarget, 0.045);
    camera.position.x = parallax.x * 0.30;
    camera.position.y = parallax.y * 0.18;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  const qs = new URLSearchParams(location.search);
  if (qs.has('mask')) uniforms.uMaskForce.value = parseFloat(qs.get('mask'));

  return { render, resize, reset, renderer,
           set scrollClean(v){ uniforms.uScrollClean.value = Math.min(1, Math.max(0, v)); },
           set maskForce(v){ uniforms.uMaskForce.value = v; },
           get bio(){ return uniforms.uBioAmount.value; },
           set bio(v){ uniforms.uBioAmount.value = v; } };
}
