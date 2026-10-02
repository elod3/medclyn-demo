/* Testele serverului, cu Stripe și Resend simulați: nu iese nimic pe rețea.
 *   cd server && node --test test/
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { verifyStripe, formEncode } from '../src/worker.js';
import { priceOrder, fitQty, checkCustomer } from '../../site/js/order.js';
import { CATALOG, byId } from '../../site/js/catalog.js';

const ENV = {
  STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test',
  SITE_URL: 'https://www.medclyn.com', ALLOWED_ORIGIN: 'https://www.medclyn.com',
  RESEND_API_KEY: 're_x', MAIL_FROM: 'site@medclyn.com', MAIL_TO: 'contact@medclyn.com'
};
const CUSTOMER = {
  type: 'pj', name: 'Ion Popescu', phone: '0722 123 456', email: 'ion@firma.ro',
  company: 'Abator Test SRL', cui: 'RO 123456', county: 'Brăila', city: 'Ianca',
  address: 'Str. Fabricii 1', pay: 'card', terms: true
};

let calls;
beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/checkout/sessions/cs_test_abc'))
      return Response.json({ client_reference_id: 'MC-1', payment_status: 'paid', amount_total: 100, customer_details: { email: 'a@b.ro' } });
    if (String(url).includes('api.stripe.com')) return Response.json({ id: 'cs_test_abc', url: 'https://checkout.stripe.com/c/pay/cs_test_abc' });
    if (String(url).includes('api.resend.com')) return Response.json({ id: 'mail' });
    throw new Error('rețea neașteptată: ' + url);
  };
});

const req = (path, body, headers) => new Request('https://shop.test' + path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://www.medclyn.com', ...(headers || {}) },
  body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
});

test('cantitățile urmează regulile magazinului', () => {
  assert.equal(fitQty(byId('p1'), 3), 10);       // placa: minim 10 m²
  assert.equal(fitQty(byId('p1'), 10.2), 11);    // rotunjit în sus la m² întreg
  assert.equal(fitQty(byId('p3'), 4), 6);        // profil: multiplu de 3
  assert.equal(fitQty(byId('p3'), 0), 0);
  assert.equal(fitQty(byId('p2'), 2.1), 3);
});

test('prețul vine din catalog, nu din cerere', () => {
  const o = priceOrder([{ id: 'p1', qty: 10, price: 1 }, { id: 'nu-exista', qty: 5 }, { id: 'p3', qty: 3 }]);
  assert.equal(o.lines.length, 2);
  assert.equal(o.totalBani, 25288 * 10 + 5736 * 3);
  assert.equal(o.vatBani, Math.round(o.totalBani - o.totalBani / 1.21));
});

test('rândurile duble se adună', () => {
  const o = priceOrder([{ id: 'p2', qty: 1 }, { id: 'p2', qty: 2 }]);
  assert.equal(o.lines[0].qty, 3);
});

test('fiecare produs are preț, unitate și poză', () => {
  for (const p of CATALOG){
    assert.ok(p.price > 0 && p.min > 0 && p.step > 0, p.id);
    assert.match(p.img, /^img\/produse\/p\d+\.webp$/);
  }
});

test('datele clientului: PJ fără CUI nu trece', () => {
  const r = checkCustomer({ ...CUSTOMER, cui: '' });
  assert.equal(r.ok, false);
  assert.ok(r.err.cui);
  assert.equal(checkCustomer(CUSTOMER).customer.cui, 'RO123456');
});

test('checkout cu cardul creează sesiunea Stripe cu sumele din catalog', async () => {
  const res = await worker.fetch(req('/api/checkout', { items: [{ id: 'p1', qty: 12 }, { id: 'p7', qty: 7 }], customer: CUSTOMER }), ENV);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.match(data.url, /^https:\/\/checkout\.stripe\.com\//);
  assert.match(data.orderId, /^MC-\d{6}-[A-Z2-9]{4}$/);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://www.medclyn.com');

  const call = calls.find((c) => c.url.endsWith('/checkout/sessions'));
  const form = new URLSearchParams(call.init.body);
  assert.equal(call.init.headers.authorization, 'Bearer sk_test_x');
  assert.equal(call.init.headers['idempotency-key'], data.orderId);
  assert.equal(form.get('mode'), 'payment');
  assert.equal(form.get('line_items[0][price_data][currency]'), 'ron');
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '25288');
  assert.equal(form.get('line_items[0][quantity]'), '12');
  assert.equal(form.get('line_items[1][quantity]'), '9');               // 7 ml → 9
  assert.equal(form.get('line_items[1][price_data][unit_amount]'), '7473');
  assert.equal(form.get('customer_email'), 'ion@firma.ro');
  assert.equal(form.get('metadata[cui]'), 'RO123456');
  assert.match(form.get('success_url'), /comanda\.html\?id=MC-.*session_id=\{CHECKOUT_SESSION_ID\}$/);
});

test('origine străină: fără antet CORS', async () => {
  const res = await worker.fetch(req('/api/health', undefined, { origin: 'https://rau.example' }), ENV);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('coș gol și date greșite sunt refuzate', async () => {
  let res = await worker.fetch(req('/api/checkout', { items: [], customer: CUSTOMER }), ENV);
  assert.equal(res.status, 400);
  res = await worker.fetch(req('/api/checkout', { items: [{ id: 'p1', qty: 10 }], customer: { ...CUSTOMER, email: 'x' } }), ENV);
  assert.equal(res.status, 422);
  assert.ok((await res.json()).fields.email);
  assert.equal(calls.length, 0);
});

test('ordin de plată: email la MedClyn și la client, fără Stripe', async () => {
  const res = await worker.fetch(req('/api/checkout', { items: [{ id: 'p2', qty: 4 }], customer: { ...CUSTOMER, pay: 'op' } }), ENV);
  assert.equal(res.status, 200);
  assert.ok((await res.json()).orderId);
  const mails = calls.filter((c) => c.url.includes('resend'));
  assert.equal(mails.length, 2);
  assert.equal(calls.filter((c) => c.url.includes('stripe')).length, 0);
  const toShop = JSON.parse(mails[0].init.body);
  assert.equal(toShop.to, 'contact@medclyn.com');
  assert.match(toShop.text, /Abator Test SRL · CUI RO123456/);
  assert.match(toShop.text, /4 buc × 53,00 lei = 212,00 lei/);
});

test('fără Stripe configurat, cardul răspunde clar', async () => {
  const res = await worker.fetch(req('/api/checkout', { items: [{ id: 'p2', qty: 1 }], customer: CUSTOMER }), { ...ENV, STRIPE_SECRET_KEY: '' });
  assert.equal(res.status, 503);
});

test('health spune ce e activ', async () => {
  const res = await worker.fetch(req('/api/health'), { ...ENV, RESEND_API_KEY: '' });
  assert.deepEqual(await res.json(), { card: true, op: false, forms: false });
});

test('capcana de boți nu trimite nimic', async () => {
  const res = await worker.fetch(req('/api/lead', { kind: 'contact', data: { name: 'x', email: 'a@b.ro', website: 'spam' } }), ENV);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

test('cererea de ofertă ajunge pe email', async () => {
  const res = await worker.fetch(req('/api/lead', { kind: 'oferta', data: { name: 'Ana', company: 'Lactate SRL', tel: '0722000000', area: '420 m²' } }), ENV);
  assert.equal(res.status, 200);
  const m = JSON.parse(calls[0].init.body);
  assert.match(m.subject, /Cerere de ofertă · Lactate SRL · 420 m²/);
});

async function sign(payload, secret, t){
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  return `t=${t},v1=` + Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

test('webhook: semnătura bună trece, cea falsă sau veche nu', async () => {
  const t = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid', amount_total: 252880, metadata: { order_id: 'MC-1' }, customer_details: { email: 'a@b.ro' } } } });
  assert.equal(await verifyStripe(body, await sign(body, 'whsec_test', t), 'whsec_test'), true);
  assert.equal(await verifyStripe(body, await sign(body, 'alt_secret', t), 'whsec_test'), false);
  assert.equal(await verifyStripe(body, await sign(body, 'whsec_test', t - 900), 'whsec_test'), false);

  let res = await worker.fetch(req('/api/stripe/webhook', body, { 'stripe-signature': 't=1,v1=00' }), ENV);
  assert.equal(res.status, 400);
  res = await worker.fetch(req('/api/stripe/webhook', body, { 'stripe-signature': await sign(body, 'whsec_test', t) }), ENV);
  assert.equal(res.status, 200);
  const m = JSON.parse(calls.find((c) => c.url.includes('resend')).init.body);
  assert.match(m.subject, /Comandă plătită MC-1 · 2\.528,80 lei/);
});

test('pagina de după plată verifică sesiunea', async () => {
  const res = await worker.fetch(req('/api/session?id=cs_test_abc'), ENV);
  assert.deepEqual(await res.json(), { orderId: 'MC-1', paid: true, total: 100, email: 'a@b.ro' });
  const bad = await worker.fetch(req('/api/session?id=../../x'), ENV);
  assert.equal(bad.status, 404);
});

test('formEncode imbrică la fel ca Stripe', () => {
  const f = formEncode({ a: { b: [{ c: 1 }] }, d: null });
  assert.equal(f.toString(), 'a%5Bb%5D%5B0%5D%5Bc%5D=1');
});

test('peste plafonul Stripe, cardul e refuzat', async () => {
  const res = await worker.fetch(req('/api/checkout', { items: [{ id: 'p1', qty: 4000 }], customer: CUSTOMER }), ENV);
  assert.equal(res.status, 422);
  assert.equal(calls.length, 0);
});
