/* Animații de text.
 *
 * O singură mișcare în toată pagina: descoperirea de la stânga la dreapta,
 * aceeași cu frontul de gel care șterge peretele. Singura excepție e sigiliul
 * de garanție din hero, care sare intenționat (animația lui e în CSS).
 * Fiecare element e vizibil fără JS — clasa de pe <html> e cea care activează starea inițială ascunsă, deci dacă scriptul nu rulează, pagina
 * rămâne citibilă.
 */

export function initReveal({ reduced }){
  const items = Array.from(document.querySelectorAll('[data-reveal]'));
  if (!items.length) return;

  if (reduced || !('IntersectionObserver' in window)){
    items.forEach((n) => n.classList.add('in'));
    return;
  }

  document.documentElement.classList.add('reveal-on');

  // Indexul de ordine se dă pe grup, ca rândurile unui tabel să curgă unul
  // după altul, nu toate deodată.
  const groups = new Map();
  for (const n of items){
    const key = n.dataset.revealGroup || 'default';
    const arr = groups.get(key) || [];
    arr.push(n);
    groups.set(key, arr);
  }
  for (const arr of groups.values()){
    arr.forEach((n, i) => n.style.setProperty('--i', String(i)));
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries){
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  for (const n of items){
    // Ce e deja pe ecran la încărcare pornește imediat: prima imagine a paginii
    // trebuie să fie completă, nu o listă de elemente invizibile.
    const r = n.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9) {
      requestAnimationFrame(() => n.classList.add('in'));
    } else {
      io.observe(n);
    }
  }

  // Plasă de siguranță: dacă observatorul nu se declanșează dintr-un motiv
  // oarecare, textul nu are voie să rămână ascuns.
  window.addEventListener('load', () => {
    setTimeout(() => items.forEach((n) => n.classList.add('in')), 6000);
  });
}
