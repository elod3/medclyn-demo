/* După comandă: bonul cu ștampila lui.
 *
 *   ?demo=1               demo, nimic trimis, nimic încasat
 *   ?session_id=cs_…      întors din Stripe: serverul confirmă plata
 *   ?plata=op             ordin de plată: comanda a ajuns, proforma vine pe email
 * Rândurile bonului vin din fila asta (sessionStorage). Pe alt dispozitiv se
 * vede doar numărul comenzii, care ajunge oricum și pe email.
 */

import { byId } from './catalog.js';
import { fmtLei, fmtQty } from './order.js';
import { bindCartBadge, clearCart } from './cart.js';
import { fetchSession } from './api.js';
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const qs = new URLSearchParams(location.search);

bindCartBadge();

let order = null;
try { order = JSON.parse(sessionStorage.getItem('medclyn.lastOrder') || 'null'); } catch { /* nimic */ }
const id = qs.get('id') || (order && order.id) || '';
if (order && order.id !== id) order = null;

$('done-id').textContent = id || 'Comandă';
$('done-date').textContent = new Date(order ? order.at : Date.now())
  .toLocaleString('ro-RO', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

if (order){
  const rows = $('slip-rows');
  for (const l of order.lines){
    const p = byId(l.id);
    const li = document.createElement('li');
    li.className = 'slip-row';
    li.innerHTML = `
      ${p ? `<img src="${p.img}" width="52" height="52" alt="">` : '<span></span>'}
      <div><div class="nm">${esc(l.name)}</div><div class="rule">${fmtQty(l.qty, l.unit)} × ${fmtLei(l.unitBani)}</div></div>
      <div class="tot">${fmtLei(l.totalBani)}</div>`;
    rows.appendChild(li);
  }
  $('s-sub').textContent = fmtLei(order.totalBani);
  $('s-vat').textContent = fmtLei(order.vatBani);
  $('s-total').textContent = fmtLei(order.totalBani);
  $('slip-sum').hidden = false;
}

function stamp(text, small, wait){
  const s = $('stamp');
  s.innerHTML = `${esc(text)}<small>${esc(small)}</small>`;
  s.classList.toggle('wait', !!wait);
  s.hidden = false;
}

function steps(list){
  $('next').innerHTML = list.map((t) => `<li><span>${t}</span></li>`).join('');
}

const who = order ? order.who : '';   // doar în textContent, nu în HTML
const mail = order ? `<b>${esc(order.email)}</b>` : 'adresa din comandă';
const tel = order ? `<b>${esc(order.phone)}</b>` : 'numărul din comandă';
const hours = CONFIG.company.hours.toLowerCase();

async function main(){
  if (qs.get('demo')){
    $('done-h').textContent = 'Comanda de probă.';
    $('done-sub').textContent = 'Demo: nu a plecat nimic și nu s-a încasat nimic. Așa arată pagina pe care o vede clientul după plată.';
    stamp('Demo', 'nimic încasat', true);
    $('s-total-k').textContent = 'Ar fi plătit acum';
    steps([
      `Cu cardul, clientul plătește pe pagina Stripe și se întoarce aici cu ștampila <b>plătit</b>. MedClyn primește comanda pe email și o vede în Stripe.`,
      `Cu ordin de plată, comanda ajunge pe email la MedClyn, iar clientul primește confirmarea cu tot bonul.`,
      `Transportul se stabilește la telefon cu ${tel}, pentru că depinde de lungimea plăcilor și de adresă.`
    ]);
    return;
  }

  if (qs.get('plata') === 'op'){
    $('done-h').textContent = 'Am primit comanda.';
    $('done-sub').textContent = `${who ? who + ', comanda' : 'Comanda'} e înregistrată. Nu s-a încasat nimic încă.`;
    stamp('Primită', 'așteaptă plata', true);
    $('s-total-k').textContent = 'De plătit pe proformă';
    steps([
      `Te sunăm la ${tel} pentru transport, ${hours}.`,
      `Proforma cu produsele și transportul vine pe ${mail}.`,
      `Comanda pleacă din depozitul din Băicoi după ce plata intră în cont.`
    ]);
    clearCart();
    return;
  }

  const sid = qs.get('session_id');
  if (sid){
    $('done-h').textContent = 'Verificăm plata…';
    try {
      const s = await fetchSession(sid);
      if (s.paid){
        $('done-h').textContent = 'Plata a intrat.';
        $('done-sub').textContent = `Mulțumim${who ? ', ' + who : ''}. Confirmarea plății vine pe ${s.email || 'email'}.`;
        stamp('Plătit', fmtLei(s.total), false);
        $('s-total-k').textContent = 'Plătit cu cardul';
        steps([
          `Te sunăm la ${tel} pentru transport, ${hours}. Transportul se facturează separat.`,
          `Factura fiscală vine pe ${mail}.`,
          `Piesele pleacă din depozitul din Băicoi după ce stabilim livrarea.`
        ]);
        clearCart();
      } else {
        $('done-h').textContent = 'Plata e în curs.';
        $('done-sub').textContent = 'Banca n-a confirmat încă plata. Când o confirmă, primești emailul de la Stripe.';
        stamp('În curs', 'se confirmă plata', true);
        steps([`Dacă nu primești emailul într-o oră, sună la ${CONFIG.company.phone} cu numărul comenzii.`]);
      }
    } catch (err){
      $('done-h').textContent = 'Nu am putut verifica plata.';
      $('done-sub').textContent = `Dacă ai primit emailul de la Stripe, plata e făcută. Altfel sună la ${CONFIG.company.phone} cu numărul comenzii.`;
    }
    return;
  }

  $('done-h').textContent = 'Comanda.';
  $('done-sub').textContent = 'Nu găsim detaliile comenzii în fila asta. Ele vin oricum pe email.';
}

main();
