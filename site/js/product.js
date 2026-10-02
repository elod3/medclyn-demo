/* Pagina unui produs: cantitate și coș, iar la placă necesarul pe încăpere.
 *
 * Necesarul folosește aceeași socoteală ca în calculatorul de pe prima pagină
 * (price.js), deci cifrele sunt aceleași în ambele locuri.
 */

import './page.js';
import { byId } from './catalog.js';
import { addToCart, cartItems, replaceCart } from './cart.js';
import { fmtLei, toBani, fmtQty, fitQty } from './order.js';
import { qtyControl } from './qty.js';
import { estimate, bomItems, clampNum } from './price.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const toast = document.getElementById('toast');
let toastTimer = null;
function say(html){
  toast.innerHTML = html;
  toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('on'), 3600);
}

const box = document.querySelector('.prod');
const p = box && byId(box.dataset.id);
const buy = document.getElementById('buy');
if (p && buy){
  const q = qtyControl(p, p.min, null, p.name);
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'cta';
  add.textContent = 'Adaugă în coș';
  add.addEventListener('click', () => {
    addToCart(p.id, q.value);
    const inCart = cartItems().find((it) => it.id === p.id);
    add.textContent = 'În coș';
    add.classList.add('added');
    setTimeout(() => { add.textContent = 'Adaugă în coș'; add.classList.remove('added'); }, 1600);
    say(`${esc(p.name)} · în coș ${fmtQty(inCart ? inCart.qty : q.value, p.unit)} <a href="cos.html">vezi coșul</a>`);
  });
  buy.append(q.el, add);
}

/* Necesarul pentru o încăpere (doar pe pagina plăcii). */
const kit = document.getElementById('kit');
if (kit){
  const $ = (id) => document.getElementById(id);
  const tbody = $('k-bom').querySelector('tbody');
  let items = [];
  const paint = () => {
    const dims = {
      L: clampNum($('k-l').value, 1.2, 120, 6),
      W: clampNum($('k-w').value, 1.2, 120, 4),
      H: clampNum($('k-h').value, 2, 14, 3),
      ceil: $('k-c').checked
    };
    items = bomItems(estimate(dims));
    let total = 0;
    tbody.innerHTML = items.map(({ id, qty }) => {
      const it = byId(id);
      const q = fitQty(it, qty);
      const v = Math.round(toBani(it.price) * q);
      total += v;
      return `<tr><th>${esc(it.name)}</th><td class="qty">${fmtQty(q, it.unit)}</td><td class="val">${fmtLei(v)}</td></tr>`;
    }).join('');
    $('k-tot').textContent = fmtLei(total);
  };
  kit.addEventListener('input', paint);
  $('k-add').addEventListener('click', () => {
    replaceCart(items);
    say(`Necesarul pentru încăpere e în coș. <a href="cos.html">vezi coșul</a>`);
  });
  paint();
}
