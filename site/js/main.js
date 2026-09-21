import { createWall } from './wall.js';
import { createCalc } from './calc.js';
import { initReveal } from './reveal.js';
import { initCases } from './cases.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const loader = document.getElementById('loader');
const bar = document.getElementById('loader-bar');
const hint = document.getElementById('hint');
const stage = document.getElementById('hero');

/* Daca incarcarea se impotmoleste, pagina nu ramane blocata sub loader. */
let loaderDone = false;
function hideLoader(){
  if (loaderDone || !loader) return;
  loaderDone = true;
  loader.classList.add('done');
  setTimeout(() => { loader.hidden = true; }, 650);
}
setTimeout(hideLoader, 9000);

function fail(err){
  console.error('[medclyn]', err);
  const box = document.getElementById('nogl');
  if (box) box.hidden = false;
  hideLoader();
}
window.addEventListener('error', (e) => fail(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => fail(e.reason));

initReveal({ reduced });
initCases().catch((err) => console.warn('[medclyn] șantiere:', err));

/* ---------- peretele ---------- */
let wall = null;
try {
  wall = createWall({
    canvas: document.getElementById('cv-wall'),
    reduced,
    onProgress(p){ if (bar) bar.style.transform = `scaleX(${Math.max(0.02, p)})`; },
    onReady(){
      wall.resize();
      hideLoader();
    },
    onFirstTouch(){ if (hint) hint.classList.add('gone'); }
  });
} catch (err){
  fail(err);
}

/* ---------- calculatorul ---------- */
let calc = null;
try {
  const container = document.getElementById('room');
  const canvas = document.getElementById('cv-room');
  if (container && canvas) calc = createCalc({ container, canvas, reduced });
} catch (err){
  console.error('[medclyn] calculatorul 3D nu a pornit:', err);
}

/* ---------- vizibilitate + buclă ---------- */
const scenes = [];
if (wall) scenes.push({ el: document.getElementById('stage'), obj: wall, visible: true });
if (calc) scenes.push({ el: document.getElementById('room'), obj: calc, visible: true });

scenes.forEach((s) => s.obj.resize());

const resetBtn = document.getElementById('reset');
if (resetBtn && wall){
  resetBtn.addEventListener('click', () => {
    wall.reset();
    if (hint) hint.classList.remove('gone');
  });
}

/* Peretele se curăță pe măsură ce cobori prin pagină. */
const forcedClean = new URLSearchParams(location.search).get('clean');
const heroEl = document.getElementById('hero');
function updateScrollClean(){
  // --hs: cât din hero a trecut de marginea de sus (0..1) — parallax-ul din CSS
  if (heroEl && !reduced){
    const hs = Math.min(1, Math.max(0, window.scrollY / Math.max(1, heroEl.offsetHeight)));
    heroEl.style.setProperty('--hs', hs.toFixed(3));
  }
  if (!wall) return;
  if (forcedClean !== null){ wall.scrollClean = parseFloat(forcedClean) || 0; return; }
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  wall.scrollClean = window.scrollY / max;
}
window.addEventListener('scroll', updateScrollClean, { passive: true });
updateScrollClean();

if ('IntersectionObserver' in window){
  const io = new IntersectionObserver((entries) => {
    for (const en of entries){
      const s = scenes.find((x) => x.el === en.target);
      if (s) s.visible = en.isIntersecting;
    }
  }, { rootMargin: '150px' });
  scenes.forEach((s) => io.observe(s.el));
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => scenes.forEach((s) => s.obj.resize()), 120);
});

/* parametri folositi doar la capturile de ecran din headless */
const sp = new URLSearchParams(location.search);
if (sp.has('flat')) document.documentElement.classList.add('flat');
if (sp.has('only')){
  const id = sp.get('only');
  document.querySelectorAll('section, header.hud, footer').forEach((n) => {
    if (n.id !== id) n.hidden = true;
  });
  document.documentElement.classList.add('flat');
}
if (sp.has('seal')){
  // îngheață saltul sigiliului la secunda dată din ciclul de 3,4 s (capturi)
  const t = -(parseFloat(sp.get('seal')) || 0);
  document.querySelectorAll('.seal-hop, .seal-shadow, .hero-seal').forEach((n) => {
    n.style.animationDelay = n.classList.contains('hero-seal') ? '-5s' : t + 's';
    n.style.animationPlayState = 'paused';
  });
}
if (sp.has('scroll')){
  const y = parseInt(sp.get('scroll'), 10) || 0;
  setTimeout(() => window.scrollTo(0, y), 400);
  setTimeout(() => window.scrollTo(0, y), 2500);
}

let last = performance.now();
(function loop(now){
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const s of scenes){ if (s.visible) s.obj.render(dt); }
  requestAnimationFrame(loop);
})(last);
