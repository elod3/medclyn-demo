/* Coșul: doar { id, qty } în localStorage, nimic altceva.
 *
 * Prețul nu se păstrează aici: se recitește din catalog la fiecare afișare,
 * iar serverul de plată îl recalculează oricum. Dacă browserul nu lasă
 * localStorage (fereastră privată, blocat), coșul merge în memorie până la
 * închiderea paginii.
 */

import { byId } from './catalog.js';
import { fitQty, priceOrder } from './order.js';

const KEY = 'medclyn.cart.v1';
let memory = [];

function read(){
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((it) => it && byId(it.id) && it.qty > 0) : [];
  } catch { return memory.slice(); }
}

function write(items){
  memory = items.slice();
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* rămâne în memorie */ }
  window.dispatchEvent(new CustomEvent('medclyn:cart', { detail: { items } }));
}

export const cartItems = read;

export function cartSummary(){ return priceOrder(read()); }

export function cartCount(){ return read().length; }

/* Adaugă peste ce e deja în coș. */
export function addToCart(id, qty){
  const p = byId(id);
  if (!p) return;
  const items = read();
  const cur = items.find((it) => it.id === id);
  if (cur) cur.qty = fitQty(p, cur.qty + qty);
  else items.push({ id, qty: fitQty(p, qty) });
  write(items);
}

/* Pune exact cantitatea dată; 0 scoate rândul. */
export function setQty(id, qty){
  const p = byId(id);
  if (!p) return;
  const q = qty > 0 ? fitQty(p, qty) : 0;
  const items = read().filter((it) => it.id !== id || q > 0);
  const cur = items.find((it) => it.id === id);
  if (cur) cur.qty = q;
  else if (q > 0) items.push({ id, qty: q });
  write(items);
}

/* Necesarul venit din calculator: rândurile lui se înlocuiesc, restul coșului
   (o bară de protecție pusă de mână, de exemplu) rămâne. */
export function replaceCart(list){
  const fresh = list.map(({ id, qty }) => ({ id, qty: fitQty(byId(id), qty) })).filter((it) => it.qty > 0);
  const ids = new Set(list.map((it) => it.id));
  write(fresh.concat(read().filter((it) => !ids.has(it.id))));
}

export function clearCart(){ write([]); }

/* Numărul de pe linkul „Coș” din bara de sus, pe orice pagină. */
export function bindCartBadge(){
  const els = document.querySelectorAll('[data-cart-count]');
  const paint = () => {
    const n = cartCount();
    els.forEach((el) => {
      el.textContent = String(n);
      el.closest('a')?.classList.toggle('has-items', n > 0);
    });
  };
  paint();
  window.addEventListener('medclyn:cart', paint);
  // alt tab a schimbat coșul
  window.addEventListener('storage', (e) => { if (e.key === KEY) paint(); });
}
