/* Singurul loc de schimbat când site-ul trece de la demo la producție.
 *
 * apiBase gol = mod demo: coșul, comanda și formularele merg cap-coadă în
 * pagină, dar nu pleacă nimic nicăieri și nu se încasează nimic.
 * Cu adresa serverului din server/ (Cloudflare Worker), comanda cu cardul
 * se deschide în Stripe Checkout, iar restul ajunge pe email la MedClyn.
 * Pașii sunt în README, la „Plăți”.
 */

export const CONFIG = {
  apiBase: '',          // ex. 'https://medclyn-shop.<cont>.workers.dev'

  company: {
    brand: 'MedClyn',
    legal: 'S.C. Multi Contrast Design S.R.L.',
    cui: 'RO19063140',
    regcom: 'J29/2121/2006',
    address: 'Strada Oltului 141, Băicoi, Prahova, 105200',
    phone: '0733 200 500',
    phoneHref: '+40733200500',
    email: 'contact@medclyn.com',
    hours: 'Luni – vineri, 08:00 – 20:00'
  }
};

export const isLive = () => !!CONFIG.apiBase;
