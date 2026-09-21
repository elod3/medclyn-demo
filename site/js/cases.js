/* Șantierele, cu pozele lor.
 *
 * Tabelul rămâne documentul; un clic pe un rând deschide sub el lucrarea:
 * poza mare (sau perechea înainte/după, unde există), pozele din timpul
 * montajului și filmul de pe șantier. Datele vin din
 * data/cases.json, generat din pozele și textele publicate de MedClyn.
 */

function el(tag, cls, html){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Înainte și după stau alături, cu eticheta lor. Pozele de pe șantier nu sunt
   făcute din același unghi, așa că un glisor le-ar suprapune fals. */
function pair(before, after, alt){
  const f = el('figure', 'case-pair');
  f.innerHTML = `
    <div><img src="${before.src}" width="${before.w}" height="${before.h}" alt="${esc(alt)} — înainte" loading="lazy" decoding="async"><span class="tag-b data">înainte</span></div>
    <div><img src="${after.src}" width="${after.w}" height="${after.h}" alt="${esc(alt)} — după placare" loading="lazy" decoding="async"><span class="tag-a data">după</span></div>`;
  return f;
}

/* Filmul se încarcă doar la clic: până atunci e o poză, fără cookie-uri Vimeo. */
function film(v){
  // Filmele Vimeo ale MedClyn sunt restricționate la domeniul lor: le deschidem acolo.
  const b = el(v.external ? 'a' : 'button', 'film');
  if (v.external){ b.href = v.page; b.target = '_blank'; b.rel = 'noopener'; }
  else b.type = 'button';
  b.innerHTML = `<img src="${v.poster}" alt="" loading="lazy" decoding="async">
    <span class="film-meta"><span class="data">${v.who ? esc(v.who) + ' · ' : 'film · '}${Math.floor(v.dur / 60)}:${String(v.dur % 60).padStart(2, '0')}${v.external ? ' · pe medclyn.com' : ''}</span><b>${esc(v.title)}</b></span>
    <span class="film-play" aria-hidden="true"></span>`;
  b.setAttribute('aria-label', (v.external ? 'Deschide filmul pe medclyn.com: ' : 'Pornește filmul: ') + v.title);
  if (!v.external) b.addEventListener('click', () => {
    const f = el('div', 'film on');
    const src = v.provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`
      : `https://player.vimeo.com/video/${v.id}?autoplay=1&dnt=1&title=0&byline=0&portrait=0&color=24bfcc`;
    f.innerHTML = `<iframe src="${src}" title="${esc(v.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    b.replaceWith(f);
  });
  return b;
}

function detail(c){
  const d = el('div', 'case');
  const main = el('div', 'case-main');
  if (c.pair) main.appendChild(pair(c.pair[0], c.pair[1], c.client));
  else if (c.main){
    const p = c.main;
    main.appendChild(el('figure', 'case-one', `<img src="${p.src}" width="${p.w}" height="${p.h}" alt="${esc(c.client)} — ${esc(p.label)}" loading="lazy" decoding="async">${c.mainNote ? `<figcaption class="data">${esc(c.mainNote)}</figcaption>` : ''}`));
  }
  d.appendChild(main);

  const side = el('div', 'case-side');
  if (c.quote) side.appendChild(el('blockquote', 'case-quote', `<p>„${esc(c.quote.text)}”</p>${c.quote.who ? `<cite>${esc(c.quote.who)}</cite>` : ''}`));
  if (c.video) side.appendChild(film(c.video));
  if (c.strip && c.strip.length){
    const s = el('ul', 'case-strip');
    c.strip.forEach((p) => {
      s.appendChild(el('li', '', `<figure><img src="${p.src}" width="${p.w}" height="${p.h}" alt="${esc(c.client)} — ${esc(p.label)}" loading="lazy" decoding="async"><figcaption class="data">${esc(p.label)}</figcaption></figure>`));
    });
    side.appendChild(s);
  }
  side.appendChild(el('p', 'case-src data', `sursă: <a href="${c.url}" target="_blank" rel="noopener">studiul de caz pe medclyn.com</a>`));
  d.appendChild(side);
  return d;
}

/* Indexul tuturor filmelor lor, sub tabel. */
async function initFilms(){
  const box = document.getElementById('films');
  if (!box) return;
  const list = box.querySelector('.films-list');
  const films = await (await fetch('data/films.json')).json();
  films.forEach((v) => {
    const li = el('li');
    li.appendChild(film(v));
    list.appendChild(li);
  });
  const total = films.reduce((a, v) => a + v.dur, 0);
  document.getElementById('films-n').textContent = films.length + ' filme, ' + Math.round(total / 60) + ' de minute';
  box.hidden = false;
}

export async function initCases(){
  initFilms().catch((err) => console.warn('[medclyn] filme:', err));
  const body = document.querySelector('#santiere .jobs tbody');
  if (!body) return;
  let data;
  try {
    data = await (await fetch('data/cases.json')).json();
  } catch (err){
    console.warn('[medclyn] șantierele rămân în varianta statică:', err);
    return;
  }
  const heads = [...body.closest('table').querySelectorAll('thead th')].map((h) => h.textContent.trim());
  const cols = heads.length;
  body.innerHTML = '';
  let open = null;
  // ?case=N deschide lucrarea N (capturi, linkuri directe); implicit prima
  const want = parseInt(new URLSearchParams(location.search).get('case'), 10) || 0;

  data.forEach((c, i) => {
    const tr = el('tr', 'job');
    const hasMedia = !!(c.main || c.pair || c.video);
    tr.innerHTML = `
      <th scope="row">${esc(c.client)}<small>${esc(c.note)}</small>${hasMedia ? `<button class="job-open data" type="button" aria-expanded="false">vezi lucrarea</button>` : ''}</th>
      <td class="num" data-label="${esc(heads[1])}">${esc(c.area || '—')}</td>
      <td class="num" data-label="${esc(heads[2])}">${esc(c.days || '—')}</td>
      <td class="num" data-label="${esc(heads[3])}">${esc(c.team || '—')}</td>
      <td class="num" data-label="${esc(heads[4])}">${esc(c.stop || '—')}</td>`;
    body.appendChild(tr);
    if (!hasMedia) return;

    const row = el('tr', 'job-detail');
    row.hidden = true;
    const td = el('td');
    td.colSpan = cols;
    row.appendChild(td);
    body.appendChild(row);

    const btn = tr.querySelector('.job-open');
    const toggle = () => {
      const willOpen = row.hidden;
      if (open && open !== row){
        open.hidden = true;
        open.previousElementSibling.classList.remove('is-open');
        const ob = open.previousElementSibling.querySelector('.job-open');
        ob.setAttribute('aria-expanded', 'false');
        ob.textContent = 'vezi lucrarea';
      }
      if (willOpen && !td.firstChild) td.appendChild(detail(c));
      row.hidden = !willOpen;
      tr.classList.toggle('is-open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
      btn.textContent = willOpen ? 'închide' : 'vezi lucrarea';
      open = willOpen ? row : null;
    };
    btn.addEventListener('click', toggle);
    if (i === want) toggle();   // o lucrare stă deschisă: pozele se văd fără să cauți
  });
}
