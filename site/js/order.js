/* Regulile comenzii: cantități, total, TVA.
 *
 * Cod pur, fără DOM: îl rulează coșul din browser și, identic, serverul de
 * plată. Serverul primește doar { id, qty } și reface totul de aici.
 * Toate sumele se țin în bani (lei × 100), ca să nu apară 0,30000000004.
 */

import { CATALOG, byId } from './catalog.js';

export const VAT = 0.21;            // cota standard din 1 aug. 2025; prețurile o includ deja
export const MAX_QTY = 99999;       // plafon de bun-simț pe rând (multiplu de 3, ca la profile)
export const CARD_MAX_BANI = 99999999;   // Stripe nu încasează peste 999.999,99 lei într-o plată

/* Aduce o cantitate la regula produsului: minim, multiplu de step, rotunjit în sus. */
export function fitQty(p, qty){
  let q = Number(qty);
  if (!isFinite(q) || q <= 0) return 0;
  q = Math.ceil(q / p.step - 1e-9) * p.step;
  return Math.min(MAX_QTY, Math.max(p.min, q));
}

export const toBani = (lei) => Math.round(lei * 100);

/* items: [{ id, qty }] → rânduri curate, cu sumele în bani.
   Ce nu există în catalog sau are cantitate 0 se aruncă. */
export function priceOrder(items, catalog = CATALOG){
  const find = catalog === CATALOG ? byId : (id) => catalog.find((p) => p.id === id) || null;
  const merged = new Map();
  for (const it of Array.isArray(items) ? items : []){
    if (!it || typeof it.id !== 'string') continue;
    const p = find(it.id);
    if (!p) continue;
    merged.set(p.id, (merged.get(p.id) || 0) + (Number(it.qty) || 0));
  }
  const lines = [];
  for (const [id, raw] of merged){
    const p = find(id);
    const qty = fitQty(p, raw);
    if (!qty) continue;
    const unit = toBani(p.price);
    lines.push({ id, name: p.name, unit: p.unit, qty, unitBani: unit, totalBani: unit * qty });
  }
  const totalBani = lines.reduce((s, l) => s + l.totalBani, 0);
  const vatBani = Math.round(totalBani - totalBani / (1 + VAT));
  return { lines, totalBani, vatBani };
}

const nf2 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtLei = (bani) => nf2.format(bani / 100) + ' lei';
export const fmtQty = (q, unit) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(q) + ' ' + unit;

/* Datele clientului, verificate la fel în browser și pe server. */
export function checkCustomer(c){
  const err = {};
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  const out = {
    type: c && c.type === 'pj' ? 'pj' : 'pf',
    name: s(c && c.name), phone: s(c && c.phone), email: s(c && c.email),
    company: s(c && c.company), cui: s(c && c.cui).toUpperCase().replace(/\s+/g, ''),
    regcom: s(c && c.regcom),
    county: s(c && c.county), city: s(c && c.city), address: s(c && c.address),
    notes: s(c && c.notes).slice(0, 800),
    pay: c && c.pay === 'op' ? 'op' : 'card',
    terms: !!(c && c.terms)
  };
  if (out.name.length < 3) err.name = 'Scrie numele întreg.';
  if (!/^\+?[0-9 ().-]{9,}$/.test(out.phone)) err.phone = 'Un număr la care te putem suna pentru transport.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) err.email = 'Aici vine confirmarea comenzii.';
  if (out.type === 'pj'){
    if (out.company.length < 2) err.company = 'Numele firmei, ca pe factură.';
    if (!/^(RO)?[0-9]{2,10}$/.test(out.cui)) err.cui = 'CUI-ul are doar cifre, cu sau fără RO.';
  }
  if (out.county.length < 2) err.county = 'Județul, pentru transport.';
  if (out.city.length < 2) err.city = 'Localitatea.';
  if (out.address.length < 5) err.address = 'Strada și numărul.';
  if (!out.terms) err.terms = 'Fără acord nu putem prelua comanda.';
  for (const k of ['name', 'phone', 'email', 'company', 'cui', 'regcom', 'county', 'city', 'address'])
    out[k] = out[k].slice(0, 200);
  return { ok: Object.keys(err).length === 0, err, customer: out };
}

/* Numărul comenzii: scurt, de dictat la telefon. */
export function orderId(now = new Date(), rnd = Math.random){
  const d = now.toISOString().slice(2, 10).replace(/-/g, '');
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tail = '';
  for (let i = 0; i < 4; i++) tail += abc[Math.floor(rnd() * abc.length)];
  return `MC-${d}-${tail}`;
}
