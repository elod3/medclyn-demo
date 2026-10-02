/* Drumul de la calcul la ofertă.
 *
 * Patru lucruri legate de aceleași trei numere ale halei:
 *  - costul pe 20 de ani: revopsirea la câțiva ani față de o singură placare;
 *  - linkul cu hala, de trimis celui care semnează;
 *  - fișa de cerere, cu dimensiunile deja completate;
 *  - bara de jos, care ține oferta la un clic de oriunde din pagină.
 * Dimensiunile vin din câmpurile calculatorului, deci totul merge și fără WebGL.
 */

import { estimate, readDims, clampNum, bomItems } from './price.js';
import { replaceCart } from './cart.js';
import { bindLeadForm } from './forms.js';

const YEARS = 20;   // cât garanția pe manoperă
const nf0 = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const lei = (v) => nf0.format(Math.round(v)) + ' lei';
const $ = (id) => document.getElementById(id);
const put = (id, txt) => { const n = $(id); if (n) n.textContent = txt; };

/* ---------- costul în timp ---------- */
function repaints(cycle){
  // peretele de azi e deja de revopsit: prima revopsire e în anul 0
  const out = [];
  for (let y = 0; y < YEARS - 1e-6; y += cycle) out.push(y);
  return out;
}

function drawCost(svg, e, paint, cycle){
  const W = 640, H = 260, padL = 8, padR = 8, padT = 22, padB = 26;
  const per = e.arie * paint;
  const marks = repaints(cycle);
  const repaintTotal = per * marks.length;
  const top = Math.max(repaintTotal, e.total) * 1.08;
  const x = (y) => padL + (y / YEARS) * (W - padL - padR);
  const yv = (v) => H - padB - (v / top) * (H - padT - padB);

  // treptele revopsirii
  let d = `M${x(0)},${yv(0)}`;
  let acc = 0;
  for (const m of marks){
    d += ` H${x(m).toFixed(1)} V${yv(acc + per).toFixed(1)}`;
    acc += per;
  }
  d += ` H${x(YEARS)}`;

  // anul în care revopsirea trece de placare
  let cross = null;
  acc = 0;
  for (const m of marks){ acc += per; if (acc > e.total){ cross = m; break; } }

  let ticks = '';
  for (let y = 0; y <= YEARS; y += 5){
    ticks += `<line x1="${x(y)}" x2="${x(y)}" y1="${H - padB}" y2="${H - padB + 5}" class="c-tick"/>`
      + `<text x="${x(y)}" y="${H - 6}" class="c-lbl" text-anchor="${y === 0 ? 'start' : y === YEARS ? 'end' : 'middle'}">${y === 0 ? 'azi' : 'anul ' + y}</text>`;
  }
  const mk = marks.map((m) => `<line x1="${x(m)}" x2="${x(m)}" y1="${padT}" y2="${H - padB}" class="c-cycle"/>`).join('');
  const crossMark = cross === null ? '' :
    `<circle cx="${x(cross)}" cy="${yv(e.total)}" r="4" class="c-dot"/>`;

  svg.innerHTML = `
    ${mk}
    <line x1="${padL}" x2="${W - padR}" y1="${H - padB}" y2="${H - padB}" class="c-axis"/>
    ${ticks}
    <path d="M${x(0)},${yv(0)} V${yv(e.total)} H${x(YEARS)}" class="c-medclyn"/>
    <path d="${d}" class="c-paint"/>
    <text x="${cross === null ? x(0) + 8 : x(YEARS)}" y="${yv(e.total) + (cross === null ? -8 : 16)}" text-anchor="${cross === null ? 'start' : 'end'}" class="c-lbl c-l-medclyn">MedClyn, o dată · ${lei(e.total)}</text>
    <text x="${x(YEARS)}" y="${yv(repaintTotal) + 16}" class="c-lbl c-l-paint" text-anchor="end">revopsire × ${marks.length} · ${lei(repaintTotal)}</text>
    ${crossMark}`;
  return { marks, repaintTotal, cross, perYear: per / cycle };
}

export function initOffer(){
  const qs = new URLSearchParams(location.search);
  if (qs.get('ceil') === '0' && $('in-ceil')) $('in-ceil').checked = false;

  const svg = $('cost-chart');
  const paintIn = $('in-paint');
  const cycleIn = $('in-cycle');
  let dims = readDims();
  let noun = 'hală';

  function update(){
    const e = estimate(dims);
    const paint = clampNum(paintIn && paintIn.value, 5, 500, 60);
    const cycle = clampNum(cycleIn && cycleIn.value, 1, 10, 2.5);
    const sz = nf1.format(dims.L) + ' × ' + nf1.format(dims.W) + ' × ' + nf1.format(dims.H) + ' m';

    if (svg){
      const r = drawCost(svg, e, paint, cycle);
      put('cost-verdict', r.cross === null
        ? `La ${nf1.format(cycle)} ani între revopsiri, în ${YEARS} de ani revopsirea rămâne sub prețul materialelor. Placarea se apără aici prin orele de producție, nu prin preț.`
        : `Revopsești de ${r.marks.length} ori în ${YEARS} de ani: ${lei(r.repaintTotal)}. Placarea costă ${lei(e.total)} în materiale, o singură dată, cu 20 de ani garanție pe manoperă.`);
      put('cost-year', lei(r.perYear));
      put('cost-cross', r.cross === null ? 'în 20 de ani, revopsirea nu ajunge la prețul materialelor'
        : (r.cross === 0 ? 'de azi' : 'din anul ' + nf1.format(r.cross).replace(',0', '')) + ', revopsirea a costat mai mult decât placarea');
    }

    put('of-hall', `${noun} ${sz}`);
    put('of-area', nf0.format(Math.round(e.arie)) + ' m²' + (dims.ceil ? ', cu tavan' : ', fără tavan'));
    put('of-total', lei(e.total));
    put('dock-sum', nf0.format(Math.round(e.arie)) + ' m² · ' + lei(e.total));
    const btn = $('of-send');
    if (btn) btn.textContent = `Cere oferta pentru ${nf0.format(Math.round(e.arie))} m²`;
  }

  ['in-l', 'in-w', 'in-h'].forEach((id) => { const n = $(id); if (n) n.addEventListener('input', () => { dims = readDims(); update(); }); });
  if ($('in-ceil')) $('in-ceil').addEventListener('change', () => { dims = readDims(); update(); });
  [paintIn, cycleIn].forEach((n) => n && n.addEventListener('input', update));
  // scara de mărimi din calculator schimbă valorile fără eveniment de input
  window.addEventListener('medclyn:dims', (ev) => {
    const d = ev.detail;
    dims = { L: d.L, W: d.W, H: d.H, ceil: d.ceil };
    noun = d.noun || noun;
    update();
  });
  update();

  /* ---------- linkul pentru cel care semnează ---------- */
  const share = $('share');
  if (share){
    const label = share.textContent;
    share.addEventListener('click', async () => {
      const u = new URL(location.href);
      u.search = '';
      u.searchParams.set('l', dims.L); u.searchParams.set('w', dims.W); u.searchParams.set('h', dims.H);
      if (!dims.ceil) u.searchParams.set('ceil', '0');
      u.hash = 'calcul';
      const e = estimate(dims);
      const text = `Placare MedClyn pentru hala noastră: ${nf0.format(Math.round(e.arie))} m², ~${lei(e.total)} materiale.`;
      try {
        if (navigator.share && matchMedia('(pointer:coarse)').matches){
          await navigator.share({ title: 'Hala noastră, placată', text, url: u.href });
          return;
        }
        await navigator.clipboard.writeText(u.href);
        share.textContent = 'link copiat · trimite-l pe mail';
      } catch (err){
        if (err && err.name === 'AbortError') return;
        window.prompt('Copiază linkul:', u.href);
      }
      setTimeout(() => { share.textContent = label; }, 2600);
    });
  }

  /* ---------- fișa de cerere ---------- */
  // hala merge odată cu cererea, ca nimeni să nu mai întrebe dimensiunile la telefon
  bindLeadForm($('offer-form'), {
    kind: 'oferta',
    note: $('of-note'),
    extra: () => {
      const e = estimate(dims);
      return {
        hall: `${noun} ${dims.L} × ${dims.W} × ${dims.H} m${dims.ceil ? ', cu tavan' : ', fără tavan'}`,
        area: nf0.format(Math.round(e.arie)) + ' m²',
        materials: lei(e.total)
      };
    },
    onSent: update
  });

  /* ---------- doar materialele, în coș ---------- */
  const toCart = $('to-cart');
  if (toCart){
    toCart.addEventListener('click', () => {
      replaceCart(bomItems(estimate(dims)));
      location.href = 'cos.html?din=calculator';
    });
  }

  /* ---------- bara de jos ---------- */
  const dock = $('dock');
  const hero = $('hero');
  const oferta = $('oferta');
  if (dock && hero && 'IntersectionObserver' in window){
    let pastHero = false, atForm = false;
    const sync = () => dock.classList.toggle('on', pastHero && !atForm);
    new IntersectionObserver(([en]) => { pastHero = !en.isIntersecting; sync(); }, { threshold: 0.35 }).observe(hero);
    if (oferta) new IntersectionObserver(([en]) => { atForm = en.isIntersecting || en.boundingClientRect.top < 0; sync(); }).observe(oferta);
  }
}
