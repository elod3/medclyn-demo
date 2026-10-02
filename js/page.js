/* Paginile generate (domenii, lucrări, prețuri, ghiduri, contact).
 *
 * Totul se citește și fără JS. Scriptul doar trimite formularele, ține
 * numărul de pe coș, filtrează tabelul de lucrări și leagă bara de jos de
 * formularul paginii.
 */

import { bindCartBadge } from './cart.js';
import { bindLeadForm } from './forms.js';
import { initReveal } from './reveal.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

bindCartBadge();
initReveal({ reduced });

/* Formularele: cererea scurtă de ofertă și contactul. Contextul paginii
   (domeniul, lucrarea) pleacă ascuns, ca omul care sună să știe de unde vine. */
document.querySelectorAll('form[data-lead]').forEach((form) => {
  bindLeadForm(form, {
    kind: form.dataset.lead,
    note: form.querySelector('.of-note'),
    extra: () => ({ page: location.pathname })
  });
});

/* Paginile au <base href>, deci „#oferta” singur ar duce la prima pagină.
   Linkurile spre formular primesc adresa paginii curente. */
const offer = document.getElementById('oferta');
document.querySelectorAll('[data-offer-link]').forEach((a) => {
  if (offer) a.href = location.pathname + '#oferta';
});
document.querySelectorAll('a[href$="#oferta"]').forEach((a) => {
  if (!offer) return;
  a.addEventListener('click', (ev) => {
    ev.preventDefault();
    offer.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', location.pathname + '#oferta');
    const first = offer.querySelector('input:not([type=hidden])');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), reduced ? 0 : 500);
  });
});

/* Filtrul de pe pagina lucrărilor. */
const chips = document.querySelectorAll('.chip[data-f]');
if (chips.length){
  const rows = document.querySelectorAll('.jobs-all tbody tr');
  const set = (f) => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.f === f)));
    rows.forEach((r) => { r.hidden = !!f && r.dataset.dom !== f; });
  };
  chips.forEach((c) => c.addEventListener('click', () => set(c.dataset.f)));
}
