/* Magazinul: cantitate și „adaugă” pe fiecare rând al catalogului. */

import { byId } from './catalog.js';
import { addToCart, bindCartBadge, cartItems } from './cart.js';
import { fmtQty } from './order.js';
import { qtyControl } from './qty.js';

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

/* Catalogul vine randat în HTML (tools/build.py), ca să se vadă fără JS și
   să-l citească motoarele de căutare. Aici se pun doar cantitatea și butonul. */
for (const row of root.querySelectorAll('.part')){
  const p = byId(row.id);
  if (!p) continue;
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
}

// link direct spre un produs: magazin.html#p7
if (location.hash){
  const el = document.getElementById(location.hash.slice(1));
  if (el) el.scrollIntoView({ block: 'center' });
}
