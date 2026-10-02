/* Formularele care trimit ceva la MedClyn: cererea de ofertă și contactul.
 *
 * În demo (config.apiBase gol) nu pleacă nimic și nu se păstrează nimic;
 * nota de sub buton spune asta pe față. Live, merg la /api/lead.
 */

import { submitLead } from './api.js';
import { CONFIG } from './config.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function bindLeadForm(form, { kind, note, extra, onSent }){
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');
  const show = (html, bad) => {
    if (!note) return;
    note.innerHTML = html;
    note.classList.toggle('bad', !!bad);
    note.hidden = false;
    note.focus();
  };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.consent;
    Object.assign(data, extra ? extra() : {});

    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'se trimite…';
    try {
      const r = await submitLead(kind, data);
      form.reset();
      if (r.demo){
        show(`<strong>Demo: mesajul nu a plecat nicăieri și nu am păstrat nimic.</strong> În site-ul final ajunge pe email la MedClyn. Până atunci: <a href="tel:${CONFIG.company.phoneHref}">${CONFIG.company.phone}</a>.`);
      } else {
        show(`<strong>Am primit.</strong> Te sunăm în programul de lucru (${esc(CONFIG.company.hours.toLowerCase())}).`);
      }
      if (onSent) onSent();
    } catch (err){
      show(`<strong>${esc(err.message)}</strong>`, true);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}
