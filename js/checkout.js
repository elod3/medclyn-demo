/* Coșul și comanda.
 *
 * Bonul din stânga se redesenează din coș la fiecare schimbare; formularul din
 * dreapta trimite { items, customer } la server, care reface prețurile.
 *   card → Stripe Checkout, apoi comanda.html?id=…&session_id=…
 *   op   → comanda.html?id=…&plata=op, proforma vine pe email
 * În demo nu pleacă nimic: comanda se arată pe comanda.html, marcată „demo”.
 */

import { byId } from './catalog.js';
import { cartItems, cartSummary, setQty, bindCartBadge, clearCart } from './cart.js';
import { fmtLei, checkCustomer, orderId, CARD_MAX_BANI } from './order.js';
import { qtyControl, ruleText } from './qty.js';
import { submitOrder, health } from './api.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

bindCartBadge();

const form = $('co-form');
const send = $('co-send');
const qs = new URLSearchParams(location.search);

/* ---------- bonul ---------- */
function paintSlip(){
  // butoanele − / + redesenează bonul; focusul rămâne pe același buton
  const act = document.activeElement;
  const keep = act && act.className && act.closest && act.closest('.slip-row')
    ? { id: act.closest('.slip-row').dataset.id, cls: act.className } : null;
  const sum = cartSummary();
  const rows = $('slip-rows');
  const empty = sum.lines.length === 0;
  rows.innerHTML = '';
  $('slip-empty').hidden = !empty;
  $('slip-sum').hidden = empty;
  form.hidden = empty;
  $('slip-meta').textContent = empty ? 'gol' : `${sum.lines.length} ${sum.lines.length === 1 ? 'rând' : 'rânduri'}`;

  for (const l of sum.lines){
    const p = byId(l.id);
    const li = document.createElement('li');
    li.className = 'slip-row';
    li.dataset.id = p.id;
    li.innerHTML = `
      <img src="${p.img}" width="52" height="52" alt="">
      <div><div class="nm">${esc(p.name)}</div><div class="rule">${fmtLei(l.unitBani)} / ${p.unit} · ${ruleText(p)}</div></div>
      <div class="tot">${fmtLei(l.totalBani)}</div>
      <div class="ctl"></div>`;
    const q = qtyControl(p, l.qty, (v) => setQty(p.id, v), p.name);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'rm';
    rm.textContent = 'scoate';
    rm.setAttribute('aria-label', 'Scoate ' + p.name);
    rm.addEventListener('click', () => setQty(p.id, 0));
    li.querySelector('.ctl').append(q.el, rm);
    rows.appendChild(li);
  }
  if (keep){
    const again = rows.querySelector(`.slip-row[data-id="${keep.id}"] .${keep.cls.split(' ')[0]}`);
    if (again && !again.disabled) again.focus();
  }
  $('s-sub').textContent = fmtLei(sum.totalBani);
  $('s-vat').textContent = fmtLei(sum.vatBani);
  $('s-total').textContent = fmtLei(sum.totalBani);
  paintButton();
}

const from = $('slip-from');
if (qs.get('din') === 'calculator'){
  from.textContent = 'Necesarul din calculator, rotunjit la regulile magazinului. Verifică cantitățile înainte de comandă: la uși, ferestre și utilaje se schimbă.';
  from.hidden = false;
} else if (qs.get('anulat')){
  from.textContent = 'Plata a fost anulată. Nu s-a încasat nimic, iar coșul e cum l-ai lăsat.';
  from.hidden = false;
}

window.addEventListener('medclyn:cart', paintSlip);

/* ---------- formularul ---------- */
const pay = () => form.elements.pay.value;
const type = () => form.elements.type.value;

function paintType(){
  const pj = type() === 'pj';
  form.querySelector('.pj-only').hidden = !pj;
  $('co-company').required = pj;
  $('co-cui').required = pj;
  $('co-name-l').textContent = pj ? 'Persoana de contact' : 'Nume și prenume';
}

let serverCard = true;

function paintButton(){
  const total = cartSummary().totalBani;
  // peste plafonul Stripe, comanda merge doar pe proformă
  const cardIn = form.querySelector('input[name="pay"][value="card"]');
  cardIn.disabled = !serverCard || total > CARD_MAX_BANI;
  if (cardIn.disabled && cardIn.checked) form.querySelector('input[name="pay"][value="op"]').checked = true;
  send.textContent = pay() === 'card' ? `Plătește ${fmtLei(total)} cu cardul` : 'Trimite comanda';
  $('pay-hint').textContent = pay() === 'card'
    ? 'Plătești acum produsele. Transportul îl stabilim la telefon și se facturează separat, înainte de expediere.'
    : (total > CARD_MAX_BANI ? 'Peste 999.999 lei, plata cu cardul nu e posibilă. ' : '')
      + 'Primești pe email proforma cu produsele și transportul. Comanda pleacă după ce plata intră în cont.';
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'type') paintType();
  if (e.target.name === 'pay') paintButton();
});

function showErrors(err){
  form.querySelectorAll('.field.bad').forEach((f) => f.classList.remove('bad'));
  form.querySelectorAll('.field-err:not(#err-terms)').forEach((n) => n.remove());
  const termsErr = $('err-terms');
  termsErr.hidden = true;
  let first = null;
  for (const [k, msg] of Object.entries(err)){
    if (k === 'terms'){
      termsErr.textContent = msg; termsErr.hidden = false;
      first = first || $('co-terms');
      continue;
    }
    const input = form.elements[k];
    if (!input || !input.closest) continue;
    const f = input.closest('.field');
    f.classList.add('bad');
    const s = document.createElement('span');
    s.className = 'field-err';
    s.textContent = msg;
    f.appendChild(s);
    first = first || input;
  }
  if (first) first.focus();
}

function note(html, bad){
  const n = $('co-note');
  n.innerHTML = html;
  n.classList.toggle('bad', !!bad);
  n.hidden = false;
  n.focus();
}

/* Ce arată comanda.html după trimitere: rămâne doar în fila asta. */
function remember(id, customer, priced, mode){
  const o = { id, mode, pay: customer.pay, at: Date.now(), lines: priced.lines, totalBani: priced.totalBani, vatBani: priced.vatBani,
    who: customer.type === 'pj' ? customer.company : customer.name, email: customer.email, phone: customer.phone };
  try { sessionStorage.setItem('medclyn.lastOrder', JSON.stringify(o)); } catch { /* fără istoric */ }
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const fd = Object.fromEntries(new FormData(form).entries());
  const raw = { ...fd, terms: $('co-terms').checked };
  const chk = checkCustomer(raw);
  if (!chk.ok){ showErrors(chk.err); return; }
  showErrors({});

  const items = cartItems();
  const priced = cartSummary();
  if (!priced.lines.length) return;

  send.disabled = true;
  const label = send.textContent;
  send.textContent = pay() === 'card' ? 'se deschide plata…' : 'se trimite…';
  try {
    const r = await submitOrder(items, { ...chk.customer, website: fd.website || '' });
    if (r.demo){
      const id = orderId();
      remember(id, chk.customer, priced, 'demo');
      clearCart();
      location.href = `comanda.html?id=${id}&demo=1`;
      return;
    }
    remember(r.orderId, chk.customer, priced, 'live');
    if (r.url){ location.href = r.url; return; }        // Stripe Checkout
    clearCart();
    location.href = `comanda.html?id=${encodeURIComponent(r.orderId)}&plata=op`;
  } catch (err){
    if (err.fields) showErrors(err.fields);
    note(`<strong>${esc(err.message)}</strong>`, true);
    send.disabled = false;
    send.textContent = label;
  }
});

/* Metodele pe care serverul nu le are pornite se dezactivează. */
health().then((h) => {
  serverCard = !!h.card;
  form.querySelector('input[name="pay"][value="op"]').disabled = !h.op;
  if (!h.card && !h.op) note('<strong>Comenzile online nu sunt pornite acum.</strong> Sună la 0733 200 500 și preluăm comanda la telefon.', true);
  paintButton();
});

paintType();
paintSlip();
