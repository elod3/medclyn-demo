/* Serverul magazinului MedClyn — Cloudflare Worker, fără dependențe.
 *
 *   GET  /api/health          ce metode de plată sunt active (pentru coș)
 *   POST /api/checkout        comanda din coș → Stripe Checkout sau ordin de plată
 *   GET  /api/session?id=…    pagina de după plată verifică sesiunea la Stripe
 *   POST /api/lead            cererea de ofertă și formularul de contact
 *   POST /api/stripe/webhook  Stripe anunță plata încasată
 *
 * Prețurile nu vin din browser: comanda aduce doar { id, qty }, iar sumele se
 * refac din site/js/catalog.js, același fișier pe care îl citește magazinul.
 *
 * Variabile (wrangler secret put …):
 *   STRIPE_SECRET_KEY      sk_live_… / sk_test_…            plata cu cardul
 *   STRIPE_WEBHOOK_SECRET  whsec_…                           confirmarea plății
 *   SITE_URL               https://www.medclyn.com           unde se întoarce clientul
 *   ALLOWED_ORIGIN         https://www.medclyn.com[,…]       cine are voie să cheme API-ul
 *   RESEND_API_KEY, MAIL_FROM, MAIL_TO                       emailurile (opțional)
 */

import { priceOrder, checkCustomer, orderId, fmtLei, fmtQty, CARD_MAX_BANI } from '../../site/js/order.js';

const STRIPE = 'https://api.stripe.com/v1';

/* ---------- utilitare ---------- */

function cors(env, req){
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  const h = { 'vary': 'origin' };
  if (allowed.includes(origin)){
    h['access-control-allow-origin'] = origin;
    h['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    h['access-control-allow-headers'] = 'content-type';
    h['access-control-max-age'] = '86400';
  }
  return h;
}

const json = (data, status, extra) => new Response(JSON.stringify(data), {
  status: status || 200,
  headers: { 'content-type': 'application/json; charset=utf-8', ...(extra || {}) }
});

/* Stripe vrea form-urlencoded, cu chei imbricate: line_items[0][price_data][currency] */
export function formEncode(obj, prefix, out = new URLSearchParams()){
  for (const [k, v] of Object.entries(obj)){
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(env, method, path, params, idem){
  const headers = { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  let body;
  if (params){
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = formEncode(params).toString();
  }
  if (idem) headers['idempotency-key'] = idem;
  const res = await fetch(STRIPE + path, { method, headers, body });
  const data = await res.json();
  if (!res.ok) throw new Error('stripe: ' + ((data.error && data.error.message) || res.status));
  return data;
}

const hasMail = (env) => !!(env.RESEND_API_KEY && env.MAIL_FROM && env.MAIL_TO);

async function mail(env, { to, subject, text, replyTo }){
  if (!hasMail(env)){
    console.log('[mail dezactivat]', subject, '\n' + text);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text, reply_to: replyTo })
  });
  if (!res.ok) console.error('[mail] resend', res.status, await res.text());
  return res.ok;
}

function randomId(){
  const b = crypto.getRandomValues(new Uint32Array(4));
  let i = 0;
  return orderId(new Date(), () => b[i++] / 2 ** 32);
}

/* ---------- textul comenzii, același în email și în Stripe ---------- */

function orderText(id, priced, c){
  const rows = priced.lines.map((l) => `  ${l.name}\n    ${fmtQty(l.qty, l.unit)} × ${fmtLei(l.unitBani)} = ${fmtLei(l.totalBani)}`).join('\n');
  const who = c.type === 'pj'
    ? `${c.company} · CUI ${c.cui}${c.regcom ? ' · ' + c.regcom : ''}\nPersoană de contact: ${c.name}`
    : c.name;
  return [
    `Comanda ${id}`,
    '',
    rows,
    '',
    `Total produse: ${fmtLei(priced.totalBani)} (din care TVA ${fmtLei(priced.vatBani)})`,
    'Transport: se stabilește telefonic, înainte de expediere.',
    '',
    who,
    `Telefon: ${c.phone}`,
    `Email: ${c.email}`,
    `Livrare: ${c.address}, ${c.city}, jud. ${c.county}`,
    c.notes ? `Observații: ${c.notes}` : '',
    `Plată: ${c.pay === 'card' ? 'card (Stripe)' : 'ordin de plată, pe proformă'}`
  ].filter((l) => l !== null).join('\n');
}

/* ---------- rute ---------- */

async function checkout(req, env){
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Cerere invalidă.' }, 400); }
  if (body && body.customer && body.customer.website) return json({ ok: true }, 200);   // capcană de boți

  const priced = priceOrder(body && body.items);
  if (!priced.lines.length) return json({ error: 'Coșul e gol.' }, 400);
  const chk = checkCustomer(body.customer);
  if (!chk.ok) return json({ error: 'Verifică datele marcate.', fields: chk.err }, 422);
  const c = chk.customer;
  const id = randomId();
  const text = orderText(id, priced, c);

  if (c.pay === 'card'){
    if (!env.STRIPE_SECRET_KEY) return json({ error: 'Plata cu cardul nu e activă. Alege ordin de plată.' }, 503);
    if (priced.totalBani > CARD_MAX_BANI) return json({ error: 'Peste 999.999 lei plata cu cardul nu e posibilă. Alege ordin de plată.' }, 422);
    const site = (env.SITE_URL || '').replace(/\/$/, '');
    const session = await stripe(env, 'POST', '/checkout/sessions', {
      mode: 'payment',
      locale: 'ro',
      client_reference_id: id,
      customer_email: c.email,
      success_url: `${site}/comanda.html?id=${id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/cos.html?anulat=1`,
      line_items: priced.lines.map((l) => ({
        quantity: l.qty,
        price_data: {
          currency: 'ron',
          unit_amount: l.unitBani,
          tax_behavior: 'inclusive',
          product_data: { name: l.name, metadata: { id: l.id, unit: l.unit } }
        }
      })),
      payment_intent_data: { description: `MedClyn ${id}`, metadata: { order_id: id } },
      metadata: {
        order_id: id,
        tip: c.type,
        nume: c.name,
        telefon: c.phone,
        firma: c.company,
        cui: c.cui,
        regcom: c.regcom,
        livrare: `${c.address}, ${c.city}, jud. ${c.county}`.slice(0, 500),
        observatii: c.notes.slice(0, 500),
        produse: priced.lines.map((l) => `${l.id}×${l.qty}`).join('; ').slice(0, 500)
      }
    }, id);
    return json({ orderId: id, url: session.url });
  }

  // ordin de plată: comanda ajunge pe email, proforma o emite MedClyn
  if (!hasMail(env)) return json({ error: 'Comanda prin ordin de plată nu e activă încă. Sună-ne și o preluăm la telefon.' }, 503);
  await mail(env, { to: env.MAIL_TO, subject: `Comandă nouă ${id} · ordin de plată · ${fmtLei(priced.totalBani)}`, text, replyTo: c.email });
  await mail(env, {
    to: c.email,
    subject: `Am primit comanda ${id}`,
    text: `Bună ziua,\n\nAm primit comanda de mai jos. Vă sunăm pentru transport și vă trimitem proforma pe email; comanda pleacă după ce plata ajunge în cont.\n\n${text}\n\nMedClyn`
  });
  return json({ orderId: id });
}

async function session(req, env){
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id) || !env.STRIPE_SECRET_KEY) return json({ error: 'Sesiune necunoscută.' }, 404);
  const s = await stripe(env, 'GET', '/checkout/sessions/' + id);
  return json({
    orderId: s.client_reference_id,
    paid: s.payment_status === 'paid',
    total: s.amount_total,
    email: s.customer_details && s.customer_details.email
  });
}

async function lead(req, env){
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Cerere invalidă.' }, 400); }
  const d = (body && body.data) || {};
  if (d.website) return json({ ok: true });                                       // capcană de boți
  const kind = body.kind === 'oferta' ? 'oferta' : 'contact';
  const clean = {};
  for (const [k, v] of Object.entries(d)) if (typeof v === 'string' || typeof v === 'number') clean[k] = String(v).slice(0, 1200);
  if (!clean.name || !(clean.tel || clean.email)) return json({ error: 'Lipsește numele sau un telefon/email.' }, 422);
  if (!hasMail(env)) return json({ error: 'Formularul nu e activ încă. Sună-ne la 0733 200 500.' }, 503);
  const lines = Object.entries(clean).map(([k, v]) => `${k}: ${v}`).join('\n');
  await mail(env, {
    to: env.MAIL_TO,
    subject: kind === 'oferta' ? `Cerere de ofertă · ${clean.company || clean.name} · ${clean.area || ''}` : `Mesaj de pe site · ${clean.subject || clean.name}`,
    text: lines,
    replyTo: clean.email || undefined
  });
  return json({ ok: true });
}

/* Semnătura Stripe: HMAC-SHA256 peste `${t}.${body}`, toleranță 5 minute. */
export async function verifyStripe(payload, header, secret, now = Date.now()){
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  const sigs = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => {
    if (s.length !== hex.length) return false;
    let diff = 0;
    for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ hex.charCodeAt(i);
    return diff === 0;
  });
}

async function webhook(req, env){
  const payload = await req.text();
  if (!(await verifyStripe(payload, req.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET)))
    return json({ error: 'semnătură invalidă' }, 400);
  const ev = JSON.parse(payload);
  if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded'){
    const s = ev.data.object;
    if (s.payment_status === 'paid'){
      const m = s.metadata || {};
      await mail(env, {
        to: env.MAIL_TO,
        subject: `Comandă plătită ${m.order_id} · ${fmtLei(s.amount_total)}`,
        text: [
          `Comanda ${m.order_id} e plătită cu cardul: ${fmtLei(s.amount_total)}.`,
          `Detaliile complete sunt în Stripe, la plata ${s.payment_intent}.`,
          '',
          ...Object.entries(m).map(([k, v]) => `${k}: ${v}`),
          `email: ${s.customer_details && s.customer_details.email}`,
          '',
          'Transportul nu e inclus: sunați clientul pentru livrare.'
        ].join('\n'),
        replyTo: s.customer_details && s.customer_details.email
      });
    }
  }
  return json({ received: true });
}

/* ---------- intrarea ---------- */

export default {
  async fetch(req, env){
    const url = new URL(req.url);
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    try {
      let res;
      if (url.pathname === '/api/health' && req.method === 'GET')
        res = json({ card: !!env.STRIPE_SECRET_KEY, op: hasMail(env), forms: hasMail(env) });
      else if (url.pathname === '/api/checkout' && req.method === 'POST') res = await checkout(req, env);
      else if (url.pathname === '/api/session' && req.method === 'GET') res = await session(req, env);
      else if (url.pathname === '/api/lead' && req.method === 'POST') res = await lead(req, env);
      else if (url.pathname === '/api/stripe/webhook' && req.method === 'POST') return await webhook(req, env);
      else res = json({ error: 'nu există' }, 404);
      for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
      return res;
    } catch (err){
      console.error(err);
      const res = json({ error: 'Ceva n-a mers. Sună-ne la 0733 200 500 și preluăm comanda la telefon.' }, 500);
      for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
      return res;
    }
  }
};
