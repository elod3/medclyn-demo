/* Drumul spre server. În demo (fără apiBase) nu se face niciun request. */

import { CONFIG, isLive } from './config.js';

export class ApiError extends Error {
  constructor(msg, fields){ super(msg); this.fields = fields || null; }
}

async function post(path, body){
  let res;
  try {
    res = await fetch(CONFIG.apiBase.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw new ApiError(`Nu am putut ajunge la server. Verifică internetul sau sună la ${CONFIG.company.phone}.`);
  }
  let data = null;
  try { data = await res.json(); } catch { /* răspuns gol */ }
  if (!res.ok) throw new ApiError((data && data.error) || `Serverul a răspuns cu ${res.status}.`, data && data.fields);
  return data || {};
}

/* Comanda din coș.
   card → { url } spre Stripe Checkout; op → { orderId } și proforma vine pe email. */
export function submitOrder(items, customer){
  if (!isLive()) return Promise.resolve({ demo: true });
  return post('/api/checkout', { items, customer });
}

/* Cererea de ofertă și formularul de contact. */
export function submitLead(kind, data){
  if (!isLive()) return Promise.resolve({ demo: true });
  return post('/api/lead', { kind, data });
}

/* Pagina de după plată: serverul confirmă la Stripe că sesiunea e plătită. */
export async function fetchSession(sessionId){
  if (!isLive()) return { demo: true };
  const res = await fetch(CONFIG.apiBase.replace(/\/$/, '') + '/api/session?id=' + encodeURIComponent(sessionId));
  if (!res.ok) throw new ApiError('Nu am putut verifica plata.');
  return res.json();
}

/* Ce metode de plată are serverul pornite: { card, op, forms }. */
export async function health(){
  if (!isLive()) return { card: true, op: true, forms: true, demo: true };
  try {
    const res = await fetch(CONFIG.apiBase.replace(/\/$/, '') + '/api/health');
    return await res.json();
  } catch { return { card: false, op: false, forms: false }; }
}
