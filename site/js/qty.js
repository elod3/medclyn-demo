/* Selectorul de cantitate: − [ 12 ] + m², cu pasul și minimul produsului.
 * Ce scrii de mână se îndreaptă la ieșirea din câmp (7 ml devine 9 ml),
 * ca să vezi pe loc ce intră de fapt în comandă.
 */

import { fitQty } from './order.js';

export function qtyControl(p, value, onChange, label){
  const wrap = document.createElement('div');
  wrap.className = 'stepper';
  wrap.innerHTML = `
    <button type="button" class="dec" aria-label="mai puțin">−</button>
    <input type="number" inputmode="decimal" min="${p.min}" step="${p.step}" aria-label="${label || 'Cantitate'} (${p.unit})">
    <span class="u" aria-hidden="true">${p.unit}</span>
    <button type="button" class="inc" aria-label="mai mult">+</button>`;
  const input = wrap.querySelector('input');
  const dec = wrap.querySelector('.dec');
  let cur = fitQty(p, value) || p.min;

  function set(v, emit){
    cur = fitQty(p, v) || p.min;
    input.value = String(cur);
    dec.disabled = cur <= p.min;
    if (emit && onChange) onChange(cur);
  }
  dec.addEventListener('click', () => set(cur - p.step, true));
  wrap.querySelector('.inc').addEventListener('click', () => set(cur + p.step, true));
  input.addEventListener('change', () => set(parseFloat(input.value.replace(',', '.')), true));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); input.blur(); } });
  set(cur, false);

  return { el: wrap, get value(){ return cur; }, set: (v) => set(v, false) };
}

/* „de la 10 m²” / „în multipli de 3 ml” / „bucată” */
export function ruleText(p){
  if (p.step > 1) return `în multipli de ${p.step} ${p.unit}`;
  if (p.min > 1) return `de la ${p.min} ${p.unit}`;
  return p.unit === 'buc' ? 'la bucată' : `la ${p.unit}`;
}
