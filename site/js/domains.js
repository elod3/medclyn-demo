/* Conformitate: aceeași fișă, pentru industria alimentară sau pentru spitale.
 * Tab-uri cu tastatura (săgeți), ca la orice tablist. Sigiliul de garanție
 * duce la un rând din fișa alimentară, deci #garantie o deschide pe aceea.
 */

export function initDomains(){
  const tabs = Array.from(document.querySelectorAll('.domain [role="tab"]'));
  if (!tabs.length) return;

  function select(tab, focus){
    for (const t of tabs){
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      select(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

  const food = tabs[0];
  const openFood = () => { if (location.hash === '#garantie') select(food); };
  window.addEventListener('hashchange', openFood);
  document.querySelectorAll('a[href="#garantie"]').forEach((a) => a.addEventListener('click', () => select(food)));
  openFood();

  // ?domeniu=medical — link direct pentru spitale
  if (new URLSearchParams(location.search).get('domeniu') === 'medical') select(tabs[1]);
}
