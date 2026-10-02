/* Magazinul: catalogul pe grupe, cu cantitate și „adaugă” pe fiecare rând. */

import { CATALOG, GROUPS } from './catalog.js';
import { addToCart, bindCartBadge, cartItems } from './cart.js';
import { fmtLei, toBani, fmtQty } from './order.js';
import { qtyControl, ruleText } from './qty.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

bindCartBadge();

const root = document.getElementById('catalog');
const toast = document.getElementById('toast');
let toastTimer = null;

function say(html){
  toast.innerHTML = html;
  toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('on'), 3200);
}

let n = 0;
for (const g of GROUPS){
  const parts = CATALOG.filter((p) => p.group === g.id);
  if (!parts.length) continue;
  const sec = document.createElement('section');
  sec.className = 'cat-group';
  sec.setAttribute('aria-labelledby', 'g-' + g.id);
  sec.innerHTML = `<div class="cat-h"><h2 id="g-${g.id}">${esc(g.name)}</h2><span class="data">${parts.length} ${parts.length === 1 ? 'produs' : 'produse'}</span></div>`;

  for (const p of parts){
    n++;
    const row = document.createElement('article');
    row.className = 'part';
    row.id = p.id;
    row.innerHTML = `
      <span class="part-n">${String(n).padStart(2, '0')}</span>
      <img class="part-img" src="${p.img}" width="104" height="104" alt="" loading="lazy" decoding="async">
      <div>
        <h3 class="part-name">${esc(p.name)}</h3>
        <p class="part-note">${esc(p.note)}</p>
        <a class="part-src data" href="${p.src}" target="_blank" rel="noopener">fișa pe medclyn.com</a>
      </div>
      <p class="part-price"><b>${fmtLei(toBani(p.price))}</b><span>/ ${p.unit} · ${ruleText(p)}</span></p>
      <div class="part-buy"></div>`;

    const q = qtyControl(p, p.min, null, p.name);
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'cta';
    add.textContent = 'Adaugă';
    add.addEventListener('click', () => {
      addToCart(p.id, q.value);
      const inCart = cartItems().find((it) => it.id === p.id);
      add.textContent = 'În coș';
      add.classList.add('added');
      setTimeout(() => { add.textContent = 'Adaugă'; add.classList.remove('added'); }, 1600);
      say(`${esc(p.name)} · în coș ${fmtQty(inCart ? inCart.qty : q.value, p.unit)} <a href="cos.html">vezi coșul</a>`);
    });
    row.querySelector('.part-buy').append(q.el, add);
    sec.appendChild(row);
  }
  root.appendChild(sec);
}

// link direct spre un produs: magazin.html#p7
if (location.hash){
  const el = document.getElementById(location.hash.slice(1));
  if (el) el.scrollIntoView({ block: 'center' });
}
