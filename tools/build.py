#!/usr/bin/env python3
"""Generează paginile secundare ale site-ului din tools/content.py.

Prima pagină, magazinul, coșul și paginile legale sunt scrise de mână; restul
(domenii, lucrări, produse, prețuri, ghiduri, întrebări, contact, sitemap) iese
de aici, ca HTML static complet: se citește fără JS și îl citesc și motoarele
de căutare.

    python3 tools/build.py                 # demo: noindex, adrese pe GitHub Pages
    MEDCLYN_LIVE=1 python3 tools/build.py  # producție: indexabil, adrese pe medclyn.com

Paginile stau în foldere (`industria-alimentara/index.html`) și au
`<base href="../">`, ca linkurile și modulele JS să rămână relative la
rădăcină, exact ca pe prima pagină.
"""
import html, json, os, pathlib, re, subprocess, sys, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
sys.path.insert(0, str(ROOT / 'tools'))
import content as C  # noqa: E402

LIVE = os.environ.get('MEDCLYN_LIVE') == '1'
BASE = 'https://www.medclyn.com' if LIVE else 'https://elod3.github.io/medclyn-demo'
TODAY = datetime.date.today().isoformat()

e = lambda s: html.escape(str(s), quote=True)
IMGS = json.loads((ROOT / 'tools' / 'content_imgs.json').read_text())
FILMS = {f['page'].rsplit('-', 1)[1]: f for f in json.loads((SITE / 'data' / 'films.json').read_text())}
RO = json.loads((ROOT / 'tools' / 'romania.json').read_text())

def catalog():
    out = subprocess.run(['node', '--input-type=module', '-e',
        "import('" + (SITE / 'js' / 'catalog.js').as_uri() + "').then(m=>console.log(JSON.stringify({c:m.CATALOG,g:m.GROUPS})))"],
        capture_output=True, text=True, check=True).stdout
    return json.loads(out)
CAT = catalog()
PRODUCTS = CAT['c']
GROUPS = CAT['g']
PSLUG = {'p1': 'placa-antibacteriana-2-mm', 'p3': 'bagheta-imbinare-tata-mama', 'p4': 'bagheta-imbinare-cu-garnitura',
         'p6': 'bagheta-finisaj-u', 'p7': 'coltar-unghi-interior', 'p8': 'coltar-unghi-exterior-90',
         'p9': 'coltar-unghi-reglabil', 'p11': 'plinta-protectie-pvc', 'p10': 'plinta-polietilena',
         'p5': 'element-protectie-pereti', 'p12': 'terminatie-element-protectie', 'p2': 'adeziv-mastic'}
UNITCODE = {'m²': 'MTK', 'ml': 'MTR', 'buc': 'H87'}

def lei(v):
    s = f'{v:,.2f}'.replace(',', ' ').replace('.', ',').replace(' ', '.')
    return s + ' lei'
def m2(v):
    return f'{v:,}'.replace(',', '.') + ' m²'

COMPANY = dict(name='MedClyn', legal='S.C. Multi Contrast Design S.R.L.', vat='RO19063140',
               phone='+40733200500', phone_h='0733 200 500', email='contact@medclyn.com',
               street='Strada Oltului 141', city='Băicoi', region='Prahova', zip='105200')

ORG = {
  '@type': 'Organization', '@id': BASE + '/#org', 'name': 'MedClyn', 'legalName': COMPANY['legal'],
  'url': BASE + '/', 'logo': BASE + '/img/medclyn-mark.svg', 'vatID': COMPANY['vat'],
  'telephone': COMPANY['phone'], 'email': COMPANY['email'],
  'address': {'@type': 'PostalAddress', 'streetAddress': COMPANY['street'], 'addressLocality': COMPANY['city'],
              'addressRegion': COMPANY['region'], 'postalCode': COMPANY['zip'], 'addressCountry': 'RO'},
  'sameAs': ['https://www.facebook.com/MedClynRomania/', 'https://www.instagram.com/MedClynRomania/'],
}

# ─────────────────────────────── piese comune ───────────────────────────────

ICON = (SITE / 'index.html').read_text().split('<link rel="icon" href="', 1)[1].split('"', 1)[0]

def head(*, path, title, desc, depth, ld=(), og_img='img/og.jpg', kind='website'):
    url = BASE + '/' + path
    base = '../' * depth
    robots = 'index, follow, max-image-preview:large' if LIVE else 'noindex, nofollow'
    graph = [ORG] + list(ld)
    ldjson = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(',', ':'))
    return f'''<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<base href="{base or './'}">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{e(url)}">
<meta name="robots" content="{robots}">
<meta property="og:type" content="{kind}">
<meta property="og:site_name" content="MedClyn">
<meta property="og:locale" content="ro_RO">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(BASE + '/' + og_img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#061a3a">
<link rel="icon" href="{ICON}">
<link rel="preload" href="fonts/k3kQo8UDI-1M0wlSfdfoLmvDIaK18A.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="fonts.css">
<link rel="stylesheet" href="css/app.css">
<script type="application/ld+json">{ldjson}</script>
</head>
<body class="page">
<!-- hud:start -->
<!-- hud:end -->
<main>
'''

def foot(script='js/page.js'):
    return f'''</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<!-- callbar:start -->
<!-- callbar:end -->
<!-- footer:start -->
<!-- footer:end -->
<script type="module" src="{script}"></script>
</body>
</html>
'''

def crumbs(items):
    """items: [(nume, cale sau None)]"""
    parts = ['<a href="./">MedClyn</a>']
    for name, p in items:
        parts.append(f'<a href="{p}">{e(name)}</a>' if p else e(name))
    return f'<p class="crumbs data">{" / ".join(parts)}</p>'

def bc_ld(items, path):
    lst = [{'@type': 'ListItem', 'position': 1, 'name': 'MedClyn', 'item': BASE + '/'}]
    for i, (name, p) in enumerate(items, 2):
        lst.append({'@type': 'ListItem', 'position': i, 'name': name, 'item': BASE + '/' + (p or path)})
    return {'@type': 'BreadcrumbList', 'itemListElement': lst}

def faq_ld(qs):
    return {'@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in qs]}

def faq_html(qs, open_first=True):
    out = ['<div class="faq">']
    for i, (q, a) in enumerate(qs):
        out.append(f'<details{" open" if (i == 0 and open_first) else ""}><summary>{e(q)}</summary><p>{e(a)}</p></details>')
    out.append('</div>')
    return '\n'.join(out)

def lead_form(fid, *, title, note, ctx, wall_default=None):
    """Cererea scurtă de ofertă: cinci câmpuri, contextul paginii merge ascuns."""
    walls = ['panou sandwich vopsit', 'faianță', 'zidărie vopsită', 'rigips sau construcție nouă', 'altceva']
    if wall_default in walls:
        walls.remove(wall_default); walls.insert(0, wall_default)
    opts = ''.join(f'<option>{e(w)}</option>' for w in walls)
    return f'''<section class="band lead" id="oferta">
  <div class="wrap">
    <div class="lead-grid">
      <div class="shead">
        <p class="kicker data"><b class="idx">→</b>Ofertă</p>
        <h2>{e(title)}</h2>
        <p class="sub">{note}</p>
        <a class="lead-tel" href="tel:{COMPANY['phone']}"><span class="data">sau sună, luni – vineri, 08–20</span>{COMPANY['phone_h']}</a>
      </div>
      <form class="lead-form" id="{fid}" data-lead="oferta" novalidate>
        <input type="hidden" name="context" value="{e(ctx)}">
        <div class="fields two">
          <div class="field"><label for="{fid}-area">Suprafață aproximativă <span class="opt">m²</span></label><input id="{fid}-area" name="area" type="number" inputmode="numeric" min="1" placeholder="ex. 300"></div>
          <div class="field"><label for="{fid}-wall">Ce e acum pe pereți</label><select id="{fid}-wall" name="wall">{opts}</select></div>
          <div class="field"><label for="{fid}-name">Nume</label><input id="{fid}-name" name="name" type="text" autocomplete="name" required></div>
          <div class="field"><label for="{fid}-tel">Telefon</label><input id="{fid}-tel" name="tel" type="tel" autocomplete="tel" required></div>
        </div>
        <div class="field"><label for="{fid}-co">Firmă și localitate <span class="opt">opțional</span></label><input id="{fid}-co" name="company" type="text" autocomplete="organization"></div>
        <label class="hp" aria-hidden="true">Site <input name="website" tabindex="-1" autocomplete="off"></label>
        <label class="check consent" for="{fid}-ok"><input id="{fid}-ok" name="consent" type="checkbox" required> <span>Sunt de acord să fiu sunat pentru ofertă. Detalii în <a href="confidentialitate.html">politica de confidențialitate</a>.</span></label>
        <button class="cta" type="submit">Cere oferta</button>
        <p class="of-note" tabindex="-1" role="status" hidden></p>
      </form>
    </div>
  </div>
</section>'''

def case_url(c): return f'lucrari/{c["slug"]}/'
def dom_url(k): return C.DOMAINS[k]['slug'] + '/'
def prod_url(p): return f'magazin/{PSLUG[p["id"]]}/'

def cover(c):
    imgs = IMGS.get(c['key'])
    if imgs: return imgs[0]
    f = FILMS.get(c.get('video') or '')
    if f: return dict(src=f['poster'], w=640, h=360)
    return None

def jobs_table(cases, caption, link=True):
    rows = []
    for c in cases:
        name = f'<a href="{case_url(c)}">{e(c["client"])}</a>' if link else e(c['client'])
        where = ', '.join(x for x in [c.get('place'), 'Franța' if c.get('country') == 'FR' and 'Franța' not in (c.get('place') or '') else None] if x)
        sub = ' · '.join(x for x in [c['sector'], where] if x)
        area = m2(c['area']) + (f' + {e(c["extra"].split(" ")[0])} ml' if c.get('extra') and 'ml' in c['extra'] else '')
        rows.append(f'''<tr class="job" data-dom="{c['domain']}">
  <th scope="row">{name}<small>{e(sub)}</small></th>
  <td class="num" data-label="Suprafață">{area}</td>
  <td class="num" data-label="Durată">{e(c.get('duration') or '—')}</td>
  <td class="num" data-label="Echipă">{e(c.get('team') or '—')}</td>
</tr>''')
    return f'''<div class="jobs-scroll">
<table class="jobs jobs-all">
  <caption>{caption}</caption>
  <thead><tr><th scope="col">Șantier</th><th scope="col">Suprafață</th><th scope="col">Durată</th><th scope="col">Echipă</th></tr></thead>
  <tbody>
{''.join(rows)}
  </tbody>
</table>
</div>'''

def case_cards(cases, n=3):
    out = ['<ul class="case-cards">']
    for c in cases[:n]:
        cv = cover(c)
        img = f'<img src="{cv["src"]}" width="{cv["w"]}" height="{cv["h"]}" alt="{e(c["client"])}, după placare" loading="lazy" decoding="async">' if cv else ''
        out.append(f'''<li><a href="{case_url(c)}">
  {img}
  <span class="cc-meta data">{m2(c["area"])}{' · ' + e(c['duration']) if c.get('duration') else ''}</span>
  <b>{e(c['client'])}</b>
  <span class="cc-sub">{e(c['sector'])}{', ' + e(c['place']) if c.get('place') else ''}</span>
</a></li>''')
    out.append('</ul>')
    return '\n'.join(out)

def rules_html(k):
    r = C.RULES[k]
    rows = ''.join(f'''<div class="crow in"><p class="req">{q}</p><p class="ans">{e(a)}</p><span class="verdict">conform</span></div>''' for q, a in r['rows'])
    return f'<div class="conform">{rows}</div><p class="src data">{e(r["src"])} Răspunsurile sunt datele publicate de MedClyn.</p>'

def write(path, html_text):
    out = SITE / path
    if path.endswith('/'): out = out / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html_text)
    PAGES.append(path)

PAGES = []
SITEMAP = []   # (path, lastmod, [imagini])

CASES = sorted(C.CASES, key=lambda c: c['date'], reverse=True)
BY_DOM = {k: [c for c in CASES if c['domain'] == k] for k in C.DOMAINS}
RO_CASES = [c for c in CASES if c.get('country') == 'RO']
TOTAL_M2 = sum(c['area'] for c in CASES)

# ─────────────────────────────── domenii ───────────────────────────────

FARMA_NEAR = BY_DOM['farma']
HERO = {'alimentar': 'b36', 'medical': 'b31', 'farma': 'b20', 'cosmetic': 'b20', 'bucatarii': 'b13', 'alte': 'b7'}
for k, d in C.DOMAINS.items():
    cp = C.DOMAIN_COPY[k]
    path = d['slug'] + '/'
    cases = BY_DOM[k] or FARMA_NEAR
    qs = C.FAQ_DOMAIN.get(k, []) + C.FAQ_COMMON
    area = sum(c['area'] for c in BY_DOM[k])
    if BY_DOM[k]:
        stat = f'<p class="dom-stat"><b>{len(BY_DOM[k])}</b> lucrări publicate · <b>{m2(area)}</b></p>'
        tbl_caption = f'{e(d["name"])} · lucrări încheiate, cu cifrele din studiile de caz MedClyn'
        tbl_head = 'Lucrări în domeniu'
    else:
        stat = '<p class="dom-stat">Nicio lucrare publicată încă · cele mai apropiate, din farma</p>'
        tbl_caption = 'Lucrări din industria farmaceutică, cu cerințe apropiate'
        tbl_head = 'Cele mai apropiate lucrări'
    where = ''.join(f'<li>{e(w)}</li>' for w in C.WHERE[k])
    others = ''.join(f'<a href="{dom_url(o)}">{e(C.DOMAINS[o]["name"])}</a>' for o in C.DOMAINS if o != k)
    service = {'@type': 'Service', 'name': cp['title'], 'serviceType': 'Placare antibacteriană pentru pereți și tavane',
               'provider': {'@id': BASE + '/#org'}, 'areaServed': {'@type': 'Country', 'name': 'România'},
               'description': cp['desc'], 'url': BASE + '/' + path,
               'offers': {'@type': 'Offer', 'priceCurrency': 'RON', 'price': '350',
                          'priceSpecification': {'@type': 'UnitPriceSpecification', 'price': '350', 'priceCurrency': 'RON', 'unitCode': 'MTK',
                                                 'description': 'Estimare MedClyn cu material, accesorii și manoperă; prețul exact după măsurătoare'}}}
    page = head(path=path, title=cp['title'] + ' | MedClyn', desc=cp['desc'], depth=1,
                ld=[service, bc_ld([(d['name'], None)], path), faq_ld(qs)],
                og_img=(cover(next(c for c in CASES if c['key'] == HERO[k])) or {'src': 'img/og.jpg'})['src'])
    hero_case = next((c for c in CASES if c['key'] == HERO[k]), cases[0])
    hc = cover(hero_case)
    hero_fig = f'<figure class="dom-fig"><img src="{hc["src"]}" width="{hc["w"]}" height="{hc["h"]}" alt="{e(hero_case["client"])}, după placare" fetchpriority="high"><figcaption class="data"><a href="{case_url(hero_case)}">{e(hero_case["client"])}</a> · {m2(hero_case["area"])}{" · " + e(hero_case["duration"]) if hero_case.get("duration") else ""}</figcaption></figure>' if hc else ''
    page += f'''<section class="band dom-hero">
  <div class="wrap">
    {crumbs([(d['name'], None)])}
    <div class="dom-top">
    <div class="shead">
      <p class="kicker data"><b class="idx">{e(d['short'])}</b>{e(d['name'])}</p>
      <h1 class="h1-page">{e(cp['h1'])}</h1>
      <p class="sub">{e(cp['lede'])}</p>
      {stat}
      <p class="hero-act"><a class="cta" href="{path}#oferta">Cere oferta pentru spațiul tău</a> <a class="quiet" href="index.html#calcul">sau calculează singur prețul</a></p>
    </div>
    {hero_fig}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="shead">
      <p class="kicker data"><b class="idx">01</b>Ce cere norma</p>
      <h2>Cerința în stânga. Fișa tehnică în dreapta.</h2>
    </div>
    {rules_html(k)}
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="shead">
      <p class="kicker data"><b class="idx">02</b>{tbl_head}</p>
      <h2>{e(cp['pain'].split('.')[0])}.</h2>
      <p class="sub">{e('.'.join(cp['pain'].split('.')[1:]).strip())}</p>
    </div>
    {case_cards(cases, 3)}
    {jobs_table(cases, tbl_caption)}
    <p class="more"><a href="lucrari/">Toate cele {len(CASES)} de lucrări, pe hartă</a></p>
  </div>
</section>

<section class="band">
  <div class="wrap two-col">
    <div class="shead">
      <p class="kicker data"><b class="idx">03</b>Unde se montează</p>
      <h2>Unde s-a montat deja.</h2>
    </div>
    <ul class="where">{where}</ul>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="shead">
      <p class="kicker data"><b class="idx">04</b>Întrebări</p>
      <h2>Ce se întreabă înainte de ofertă.</h2>
    </div>
    {faq_html(qs)}
  </div>
</section>

{lead_form('lf', title='Te sunăm cu prețul.', note='Cinci câmpuri, fără cont. Pentru o ofertă cu manoperă, echipa vine la măsurătoare; materialele le poți vedea deja în <a href="preturi/">lista de prețuri</a>.', ctx='domeniu: ' + d['name'], wall_default={'bucatarii': 'faianță', 'medical': 'zidărie vopsită', 'farma': 'zidărie vopsită', 'cosmetic': 'zidărie vopsită', 'alte': 'faianță'}.get(k, 'panou sandwich vopsit'))}

<nav class="band dom-others" aria-label="Alte domenii"><div class="wrap"><p class="data">Alte domenii</p><div class="dom-links">{others}</div></div></nav>
'''
    page += foot()
    write(path, page)
    SITEMAP.append((path, TODAY, [cover(c)['src'] for c in cases[:3] if cover(c)]))

# ─────────────────────────────── lucrări ───────────────────────────────

LEFT_LABELS = {'Dâmbovița', 'Buzău', 'Cugir', 'Târgu Jiu', 'Monor'}

def map_svg(cases):
    pts = {}
    for c in cases:
        if not c.get('ll'): continue
        lat, lon = c['ll']
        x = (lon * RO['k'] - RO['minx']) * RO['s']; y = (RO['maxy'] - lat) * RO['s']
        pts.setdefault((round(x), round(y)), []).append(c)
    dots = []
    for (x, y), cs in pts.items():
        a = sum(c['area'] for c in cs)
        r = 7 + min(18, (a ** 0.5) / 2.2)
        label = ' · '.join(c['client'] for c in cs)
        place = cs[0]['place'].replace('județul ', '')
        href = case_url(cs[0])
        left = place.split(',')[0] in LEFT_LABELS
        dots.append(f'''<a href="{href}" class="pin" aria-label="{e(label)}, {e(place)}, {m2(a)}">
  <circle cx="{x}" cy="{y}" r="{r:.1f}" class="pin-area"/>
  <circle cx="{x}" cy="{y}" r="3.5" class="pin-dot"/>
  <text x="{(x - r - 6) if left else (x + r + 6):.0f}" y="{y + 5}" class="pin-t"{' text-anchor="end"' if left else ''}>{e(place.split(',')[0])}</text>
  <title>{e(label)} · {m2(a)}</title>
</a>''')
    return f'''<svg class="ro-map" viewBox="-20 -20 {RO['w'] + 120} {RO['h'] + 40}" role="img" aria-label="Harta lucrărilor MedClyn din România">
  <path d="{RO['d']}" class="ro-shape"/>
  {''.join(dots)}
</svg>'''

def build_lucrari_index():
    path = 'lucrari/'
    ro_m2 = sum(c['area'] for c in RO_CASES)
    fr = [c for c in CASES if c.get('country') == 'FR']
    filt = ''.join(f'<button type="button" class="chip" data-f="{k}" aria-pressed="false">{e(d["short"])} <span class="data">{len(BY_DOM[k])}</span></button>' for k, d in C.DOMAINS.items() if BY_DOM[k])
    itemlist = {'@type': 'ItemList', 'name': 'Lucrări MedClyn', 'numberOfItems': len(CASES),
                'itemListElement': [{'@type': 'ListItem', 'position': i, 'url': BASE + '/' + case_url(c), 'name': c['h1']} for i, c in enumerate(CASES, 1)]}
    desc = f'{len(CASES)} de lucrări de placare antibacteriană cu suprafața, durata și echipa: abatoare, fabrici de lactate, spitale, fabrici de medicamente, bucătării. {m2(TOTAL_M2)} publicați.'
    page = head(path=path, title='Lucrări MedClyn: abatoare, lactate, spitale, farma', desc=desc, depth=1,
                ld=[itemlist, bc_ld([('Lucrări', None)], path)], og_img=cover(CASES[0])['src'])
    page += f'''<section class="band">
  <div class="wrap">
    {crumbs([('Lucrări', None)])}
    <div class="shead">
      <p class="kicker data"><b class="idx">03</b>Lucrări</p>
      <h1 class="h1-page">{len(CASES)} de lucrări. {m2(TOTAL_M2)}.</h1>
      <p class="sub">Toate studiile de caz publicate de MedClyn, cu cifrele lor. {len(RO_CASES)} sunt în România, {len(fr)} în Franța, iar câteva clienți au cerut să nu le fie publicat numele.</p>
    </div>
    <div class="map-wrap">
      {map_svg(RO_CASES)}
      <div class="map-side">
        <p class="data">România · {m2(ro_m2)} pe hartă</p>
        <p>Cercul crește cu suprafața. Cele mai multe lucrări sunt peste panouri sandwich ruginite, în fabrici care n-au putut opri linia.</p>
        <p class="data">Franța · {len(fr)} lucrări · {m2(sum(c["area"] for c in fr))}</p>
        <p>Echipa a montat sistemul 15 ani în Franța înainte să vină în România: Sanofi, Nestlé, Ladurée, Chai 33.</p>
      </div>
    </div>
  </div>
</section>
<section class="band">
  <div class="wrap">
    <div class="chips" role="group" aria-label="Filtrează după domeniu">
      <button type="button" class="chip" data-f="" aria-pressed="true">toate <span class="data">{len(CASES)}</span></button>{filt}
    </div>
    {jobs_table(CASES, 'Lucrări încheiate · cifre din studiile de caz publicate de MedClyn · „—” înseamnă că articolul nu spune')}
  </div>
</section>
{lead_form('lf', title='Ai o hală ca acestea? Trimite-o.', note='Spune-ne cât de mare e și ce e acum pe pereți. Te sună cineva care a montat, nu un call-center.', ctx='pagina: lucrări')}
'''
    page += foot()
    write(path, page)
    SITEMAP.append((path, TODAY, []))

def build_case(c):
    path = case_url(c)
    d = C.DOMAINS[c['domain']]
    imgs = IMGS.get(c['key'], [])
    film = FILMS.get(c.get('video') or '')
    place = ', '.join(x for x in [c.get('place'), 'Franța' if c.get('country') == 'FR' and 'Franța' not in (c.get('place') or '') else None] if x)
    title = c['h1']
    desc = f"{c['client']}: {m2(c['area'])}" + (f", {c['duration']}" if c.get('duration') else '') + (f", {c['team']}" if c.get('team') else '') + f". {c['story'][0][:110].rsplit(' ', 1)[0]}…"
    rel = [x for x in BY_DOM[c['domain']] if x is not c][:3]
    if len(rel) < 3: rel += [x for x in CASES if x is not c and x not in rel][:3 - len(rel)]
    year = c['date'][:4]
    sheet = [('Suprafață', m2(c['area']) + (f" + {c['extra']}" if c.get('extra') else '')),
             ('Durată', c.get('duration')), ('Echipă', c.get('team')), ('Locul', place or None), ('Anul', year)]
    sheet_html = ''.join(f'<div><dt>{k}</dt><dd>{e(v)}</dd></div>' for k, v in sheet if v)
    ld = {'@type': 'Article', 'headline': title[:110], 'datePublished': c['date'], 'dateModified': TODAY,
          'author': {'@id': BASE + '/#org'}, 'publisher': {'@id': BASE + '/#org'},
          'mainEntityOfPage': BASE + '/' + path, 'description': desc,
          'image': [BASE + '/' + i['src'] for i in imgs[:3]] or [BASE + '/img/og.jpg'],
          'about': {'@type': 'Service', 'name': 'Placare antibacteriană MedClyn'}}
    lds = [ld, bc_ld([('Lucrări', 'lucrari/'), (c['client'], None)], path)]
    main = imgs[0] if imgs else (dict(src=film['poster'], w=640, h=360) if film else None)
    hero_img = f'<figure class="case-cover"><img src="{main["src"]}" width="{main["w"]}" height="{main["h"]}" alt="{e(c["client"])}: pereții după placare" fetchpriority="high" decoding="async"><figcaption class="data">după placare · fotografie MedClyn</figcaption></figure>' if main else ''
    gallery = ''
    if len(imgs) > 1:
        gallery = '<div class="case-gallery">' + ''.join(
            f'<figure><img src="{i["src"]}" width="{i["w"]}" height="{i["h"]}" alt="{e(c["client"])}, detaliu după lucrare" loading="lazy" decoding="async"></figure>' for i in imgs[1:]) + '</div>'
    film_html = ''
    if film:
        film_html = f'''<a class="case-film" href="{film['page']}" target="_blank" rel="noopener">
  <span class="cf-img"><img src="{film['poster']}" alt="" loading="lazy" width="640" height="360"><span class="film-play" aria-hidden="true"></span></span>
  <span class="cf-meta"><span class="data">film de pe șantier · {film['dur'] // 60}:{film['dur'] % 60:02d} · pe medclyn.com</span><b>{e(film['title'])}</b></span>
</a>'''
    quote = ''
    if c.get('quote'):
        quote = f'<blockquote class="case-quote"><p>„{e(c["quote"][0])}”</p><cite>{e(c["quote"][1])}</cite></blockquote>'
    did = ''.join(f'<li>{e(x)}</li>' for x in c['did'])
    stamp_txt = f"{m2(c['area'])}" + (f" · {c['duration']}" if c.get('duration') else '')
    conf = '<p class="src data">Clientul a cerut să nu-i fie publicat numele.</p>' if c.get('confidential') else ''
    page = head(path=path, title=f"{c['client']}: {m2(c['area'])} placați | Lucrări MedClyn", desc=desc, depth=2,
                ld=lds, og_img=main['src'] if main else 'img/og.jpg', kind='article')
    page += f'''<article>
<section class="band case-head">
  <div class="wrap">
    {crumbs([('Lucrări', 'lucrari/'), (c['client'], None)])}
    <div class="case-top">
      <div class="shead">
        <p class="kicker data"><a href="{dom_url(c['domain'])}">{e(d['name'])}</a> · {e(c['sector'])}</p>
        <h1 class="h1-page">{e(title)}</h1>
      </div>
      <p class="stamp case-stamp" aria-hidden="true">lucrare încheiată<small>{e(stamp_txt)}</small></p>
    </div>
    <dl class="sheet case-sheet">{sheet_html}</dl>
    {hero_img}
  </div>
</section>
<section class="band case-body">
  <div class="wrap">
  <div class="case-grid">
    <div class="case-text">
      {''.join(f'<p>{e(p)}</p>' for p in c['story'])}
      {quote}
      {conf}
    </div>
    <aside class="case-facts">
      <div><h2 class="data">Ce era pe perete</h2><p>{e(c['before'])}</p></div>
      {f'<div><h2 class="data">Producția</h2><p>{e(c["stop"])}</p></div>' if c.get('stop') else ''}
      <div><h2 class="data">Ce s-a montat</h2><ul>{did}</ul></div>
      <p class="data case-src">Sursa: <a href="https://www.medclyn.com/{c['old']}" rel="noopener">studiul de caz de pe medclyn.com</a></p>
    </aside>
  </div>
  {film_html}{gallery}
  </div>
</section>
</article>
{lead_form('lf', title='Ai o încăpere ca asta?', note=f'Spune-ne suprafața și ce e pe pereți. O comparăm cu lucrarea de la {e(c["client"])} și te sunăm cu o cifră, în aceeași zi lucrătoare.', ctx='lucrare: ' + c['client'], wall_default='panou sandwich vopsit' if 'sandwich' in c['before'] else ('faianță' if 'aianț' in c['before'] else None))}
<section class="band">
  <div class="wrap">
    <div class="shead"><p class="kicker data"><b class="idx">+</b>Lucrări asemănătoare</p><h2>Tot {e(d['short'])}.</h2></div>
    {case_cards(rel, 3)}
    <p class="more"><a href="{dom_url(c['domain'])}">Tot ce trebuie știut pentru {e(d['name'].lower())}</a> · <a href="lucrari/">toate lucrările</a></p>
  </div>
</section>
'''
    page += foot()
    write(path, page)
    SITEMAP.append((path, c['date'], [i['src'] for i in imgs]))

# ─────────────────────────────── ce este ───────────────────────────────

SPECS = [('Grosime', '1,6 – 2 mm'), ('Lățime', '1,2 – 3 m'), ('Lungime', '2 – 10 m'), ('Fibră de sticlă', '900 g/m²'),
         ('Conținut de sticlă', '30%'), ('Densitate', '1,5 g/cm³'), ('Greutate', '3.000 g/m²'),
         ('Duritate Barcol (UNI EN 59)', '40 / 45'), ('Rezistență la tracțiune (UNI EN ISO 527)', '86 MPa'),
         ('Modul de elasticitate (UNI EN ISO 527)', '7.100 MPa'), ('Aderența adezivului', '~60 kg/cm²'),
         ('Culoare', 'alb lucios, RAL 9010'), ('Garanție', '20 de ani, materiale și lucrare')]

STEPS = [('Vizita', 'Echipa vede spațiul și ce e pe pereți.'),
         ('Măsurătorile', 'Le face echipa care montează, nu un agent.'),
         ('Contractul', 'Cu prețul, programul pe ture și cât stă linia.'),
         ('Debitarea', 'Piesele se taie la depozitul din Băicoi. Pe șantier ajunge 80% gata tăiat.'),
         ('Montajul', 'Cu toate materialele, fără oprirea producției sau pe sectoare.')]

def compare_table():
    rows = ''.join(f'''<tr class="job {'ok' if r['dsv'] else 'bad'}"><th scope="row">{e(r['name'])}<small>{e(r['note'])}</small></th>
<td class="num" data-label="Cost / m²">{e(r['m2'])}</td><td class="num" data-label="Renovări">{e(r['renov'])}</td><td class="num" data-label="Total pe 20 de ani"><b>{e(r['total'])}</b></td><td data-label="DSV"><span class="verdict">{'acceptat' if r['dsv'] else 'neconform'}</span></td></tr>''' for r in C.COMPARE)
    return f'''<div class="jobs-scroll"><table class="jobs cmp">
<caption>Costul unui m² de perete pe 20 de ani · cifrele publicate de MedClyn pe pagina „Ce este MedClyn”</caption>
<thead><tr><th scope="col">Finisaj</th><th scope="col">Cost / m² (material + manoperă)</th><th scope="col">Renovări în 20 de ani</th><th scope="col">Total / m² pe 20 de ani</th><th scope="col">DSV</th></tr></thead>
<tbody>{rows}</tbody></table></div>
<p class="src data">La vopsea, MedClyn dă un total de minimum 250 lei pe 10 renovări; costul pe renovare de mai sus e împărțirea lor. Faianța rectificată trece de DSV doar dacă e montată etanș.</p>'''

def build_ce_este():
    path = 'ce-este-medclyn/'
    desc = 'Placa MedClyn: rășină poliesterică și fibră de sticlă cu GelCoat, 1,6–2 mm, până la 3 × 10 m. Fișa tehnică, montajul în 5 pași, garanția de 20 de ani și costul față de faianță.'
    spec_rows = ''.join(f'<tr><th>{e(k)}</th><td class="val">{e(v)}</td></tr>' for k, v in SPECS)
    steps = ''.join(f'<li><b>{e(a)}</b><span>{e(b)}</span></li>' for a, b in STEPS)
    prod = {'@type': 'Product', 'name': 'Sistemul de placare antibacteriană MedClyn', 'brand': {'@type': 'Brand', 'name': 'MedClyn'},
            'description': desc, 'image': BASE + '/img/produse/p1.webp', 'material': 'rășină poliesterică armată cu fibră de sticlă, GelCoat',
            'color': 'RAL 9010', 'url': BASE + '/' + path,
            'additionalProperty': [{'@type': 'PropertyValue', 'name': k, 'value': v} for k, v in SPECS],
            'offers': {'@type': 'Offer', 'price': '252.88', 'priceCurrency': 'RON', 'url': BASE + '/' + prod_url(PRODUCTS[0]),
                       'priceSpecification': {'@type': 'UnitPriceSpecification', 'price': '252.88', 'priceCurrency': 'RON', 'unitCode': 'MTK', 'valueAddedTaxIncluded': True}}}
    page = head(path=path, title='Ce este MedClyn: placa antibacteriană, fișa tehnică și montajul', desc=desc, depth=1,
                ld=[prod, bc_ld([('Ce este MedClyn', None)], path)], og_img='img/produse/p1.webp')
    page += f'''<section class="band">
  <div class="wrap">
    {crumbs([('Ce este MedClyn', None)])}
    <div class="shead">
      <p class="kicker data"><b class="idx">01</b>Sistemul</p>
      <h1 class="h1-page">O placă de 2 mm care ține locul faianței, vopselei și panoului.</h1>
      <p class="sub">Rășină poliesterică armată cu fibră de sticlă, acoperită cu un strat de GelCoat cu porozitate zero. Se lipește peste ce e deja pe perete: cărămidă, tencuială, faianță, vopsea, rigips sau panou sandwich.</p>
    </div>
    <div class="spec-grid">
      <table class="bom spec"><caption>Fișa tehnică a plăcii</caption><tbody>{spec_rows}</tbody></table>
      <div class="spec-side">
        <figure class="spec-img"><img src="img/produse/p1.webp" width="600" height="600" alt="Placa antibacteriană MedClyn la sul" loading="lazy"></figure>
        <p>Pe lângă placă: baghete de îmbinare tată-mamă (cu garnitură pentru zonele spălate cu jet), colțare concave pentru unghiurile interioare, colțare de protecție pentru muchii, plinte și bare de protecție. Toate se găsesc <a href="magazin.html">în magazin</a>.</p>
        <p>Clienții spun că se curăță de până la 4 ori mai repede decât gresia și faianța. Placa e lucioasă, deci reflectă lumina, iar încăperea pare mai luminoasă cu aceleași corpuri de iluminat.</p>
      </div>
    </div>
  </div>
</section>
<section class="band">
  <div class="wrap">
    <div class="shead"><p class="kicker data"><b class="idx">02</b>Montajul</p><h2>De la vizită la perete gata, în cinci pași.</h2>
      <p class="sub">Echipa are peste 15 ani de montaj în Franța, Germania și Belgia. Cine măsoară e același om care montează.</p></div>
    <ol class="steps steps-5">{steps}</ol>
  </div>
</section>
<section class="band">
  <div class="wrap">
    <div class="shead"><p class="kicker data"><b class="idx">03</b>Costul</p><h2>Cât costă un perete în 20 de ani.</h2>
      <p class="sub">Vopseaua e cea mai ieftină azi și cea mai scumpă pe 20 de ani. Faianța rectificată trece de DSV, dar costă aproape dublu. <a href="ghid/faianta-sau-placi-antibacteriene/">Comparația pe larg</a>.</p></div>
    {compare_table()}
  </div>
</section>
<section class="band">
  <div class="wrap two-col">
    <div class="shead"><p class="kicker data"><b class="idx">04</b>Garanția</p><h2>20 de ani, scris în contract.</h2></div>
    <div class="prose">
      <p>Fața plăcii e un gel de densitate mare, alb RAL 9010, care își păstrează culoarea și luciul peste 20 de ani, inclusiv la curățare regulată cu peroxid de hidrogen, ca în spitale și în farma.</p>
      <p>Dacă la folosire normală apare o problemă, echipa MedClyn vine și înlocuiește porțiunea. Oferta e valabilă 20 de ani de la montaj.</p>
      <p>Garanția cere un suport solid. Unde peretele de dedesubt e slab, se curăță înainte, ca la <a href="lucrari/lactate-bradet-arges/">Lactate Brădet</a>.</p>
    </div>
  </div>
</section>
<section class="band">
  <div class="wrap">
    <div class="shead"><p class="kicker data"><b class="idx">05</b>Unde</p><h2>Șase domenii, aceeași placă.</h2></div>
    <div class="dom-grid">{''.join(f'<a href="{dom_url(k)}"><b>{e(d["name"])}</b><span class="data">{len(BY_DOM[k]) or "—"} {"lucrări" if len(BY_DOM[k]) != 1 else "lucrare"}</span></a>' for k, d in C.DOMAINS.items())}</div>
  </div>
</section>
{lead_form('lf', title='Vrei să vezi placa pe peretele tău?', note='Spune-ne ce e pe pereți și cât de mare e spațiul. Măsurătoarea o face echipa care montează.', ctx='pagina: ce este MedClyn')}
'''
    page += foot()
    write(path, page)
    SITEMAP.append((path, TODAY, ['img/produse/p1.webp']))

# ─────────────────────────────── prețuri ───────────────────────────────

def price_rows():
    out = []
    for g in GROUPS:
        ps = [p for p in PRODUCTS if p['group'] == g['id']]
        if not ps: continue
        out.append(f'<tr class="grp"><th colspan="3" scope="colgroup">{e(g["name"])}</th></tr>')
        for p in ps:
            rule = f"în multipli de {p['step']} {p['unit']}" if p['step'] > 1 else (f"de la {p['min']} {p['unit']}" if p['min'] > 1 else 'la bucată')
            out.append(f'<tr class="job"><th scope="row"><a href="{prod_url(p)}">{e(p["name"])}</a><small>{e(rule)}</small></th><td class="num" data-label="Unitate">{p["unit"]}</td><td class="num" data-label="Preț cu TVA"><b>{lei(p["price"])}</b></td></tr>')
    return ''.join(out)

def build_preturi():
    path = 'preturi/'
    desc = 'Prețurile MedClyn cu TVA: placa antibacteriană 252,88 lei/m², baghete, colțare, plinte, adeziv. Aproximativ 350 lei/m² cu manoperă. Calculator pentru hala ta.'
    offers = {'@type': 'OfferCatalog', 'name': 'Prețuri MedClyn', 'url': BASE + '/' + path,
              'itemListElement': [{'@type': 'Offer', 'price': f"{p['price']:.2f}", 'priceCurrency': 'RON',
                                   'itemOffered': {'@type': 'Product', 'name': p['name'], 'url': BASE + '/' + prod_url(p)}} for p in PRODUCTS]}
    page = head(path=path, title='Prețuri MedClyn: placă antibacteriană de la 252,88 lei/m²', desc=desc, depth=1,
                ld=[offers, bc_ld([('Prețuri', None)], path)])
    page += f'''<section class="band">
  <div class="wrap">
    {crumbs([('Prețuri', None)])}
    <div class="shead">
      <p class="kicker data"><b class="idx">€</b>Prețuri</p>
      <h1 class="h1-page">Prețul, înainte de telefon.</h1>
      <p class="sub">Materialele au prețuri publice, cu TVA. Lucrarea completă, cu manoperă, iese în jur de <b>350 lei/m²</b> după calculul MedClyn, o singură dată pe 20 de ani. Prețul exact vine după măsurătoare, pentru că depinde de ce e pe pereți și de câte utilaje sunt în cale.</p>
    </div>
    <div class="price-top">
      <div class="price-big"><span class="data">placa, 2 mm</span><b>252,88 lei</b><span class="data">/ m² cu TVA · de la 10 m²</span></div>
      <div class="price-big"><span class="data">lucrare completă, estimat</span><b>~350 lei</b><span class="data">/ m² cu accesorii și manoperă</span></div>
      <div class="price-act"><a class="cta" href="index.html#calcul">Calculează pentru hala ta</a><a class="cta ghost" href="magazin.html">Cumpără materialele</a></div>
    </div>
    <div class="jobs-scroll"><table class="jobs price-list"><caption>Lista de prețuri · aceleași ca în magazinul medclyn.com, verificate pe {e(datetime.date(2026, 10, 2).strftime('%d.%m.%Y'))}</caption>
      <thead><tr><th scope="col">Produs</th><th scope="col">Unitate</th><th scope="col">Preț cu TVA</th></tr></thead>
      <tbody>{price_rows()}</tbody></table></div>
    <p class="src data">Transportul nu e inclus: piesele sunt lungi și grele, iar costul se stabilește la telefon după comandă.</p>
  </div>
</section>
<section class="band">
  <div class="wrap">
    <div class="shead"><p class="kicker data"><b class="idx">20</b>ani</p><h2>Ieftin azi sau ieftin în 20 de ani.</h2></div>
    {compare_table()}
  </div>
</section>
{lead_form('lf', title='Vrei prețul cu manoperă pentru spațiul tău?', note='Cinci câmpuri. Te sunăm în aceeași zi lucrătoare cu o estimare și, dacă vrei, programăm măsurătoarea.', ctx='pagina: prețuri')}
'''
    page += foot()
    write(path, page)
    SITEMAP.append((path, TODAY, []))

# ─────────────────────────────── produse ───────────────────────────────

USES = {'placa': 'Pe pereți și tavane, peste suportul existent.', 'imbinare': 'Între două plăci sau la marginea liberă a plăcii.',
        'coltar': 'La colțurile interioare și exterioare ale încăperii.', 'protectie': 'La baza peretelui și la înălțimea cărucioarelor și transpaletelor.',
        'montaj': 'Lipește placa pe perete și pe tavan.'}
WITH = {'p1': ['p3', 'p7', 'p11', 'p2'], 'p3': ['p1', 'p4', 'p6'], 'p4': ['p1', 'p3'], 'p6': ['p1', 'p3'], 'p7': ['p1', 'p8', 'p11'],
        'p8': ['p7', 'p9'], 'p9': ['p8', 'p7'], 'p11': ['p10', 'p5'], 'p10': ['p11', 'p5'], 'p5': ['p12', 'p11'], 'p12': ['p5'], 'p2': ['p1']}

def build_product(p):
    path = prod_url(p)
    g = next(x for x in GROUPS if x['id'] == p['group'])
    rule = f"în multipli de {p['step']} {p['unit']}" if p['step'] > 1 else (f"de la {p['min']} {p['unit']}" if p['min'] > 1 else 'la bucată')
    desc = f"{p['name']}: {lei(p['price'])} / {p['unit']} cu TVA, {rule}. {p['note']}"
    by = {x['id']: x for x in PRODUCTS}
    rel = [by[i] for i in WITH.get(p['id'], []) if i in by]
    rel_html = ''.join(f'<li><a href="{prod_url(r)}"><img src="{r["img"]}" width="72" height="72" alt="" loading="lazy"><span>{e(r["name"])}</span><b class="data">{lei(r["price"])} / {r["unit"]}</b></a></li>' for r in rel)
    specs = ''
    kit = ''
    if p['id'] == 'p1':
        specs = '<table class="bom spec"><caption>Fișa tehnică</caption><tbody>' + ''.join(f'<tr><th>{e(k)}</th><td class="val">{e(v)}</td></tr>' for k, v in SPECS) + '</tbody></table>'
        kit = '''<div class="kit" id="kit">
  <p class="data">Tot ce trebuie pentru o încăpere</p>
  <div class="fields three">
    <div class="field"><label for="k-l">Lungime (m)</label><input id="k-l" type="number" inputmode="decimal" value="6" min="1.2" step="0.1"></div>
    <div class="field"><label for="k-w">Lățime (m)</label><input id="k-w" type="number" inputmode="decimal" value="4" min="1.2" step="0.1"></div>
    <div class="field"><label for="k-h">Înălțime (m)</label><input id="k-h" type="number" inputmode="decimal" value="3" min="2" step="0.1"></div>
  </div>
  <label class="check"><input id="k-c" type="checkbox"> <span>și tavanul</span></label>
  <table class="bom" id="k-bom"><tbody></tbody><tfoot><tr><td>Total materiale</td><td class="val" id="k-tot">—</td></tr></tfoot></table>
  <button type="button" class="cta" id="k-add">Pune tot în coș</button>
</div>'''
    offer = {'@type': 'Offer', 'url': BASE + '/' + path, 'priceCurrency': 'RON', 'price': f"{p['price']:.2f}",
             'priceSpecification': {'@type': 'UnitPriceSpecification', 'price': f"{p['price']:.2f}", 'priceCurrency': 'RON',
                                    'unitCode': UNITCODE[p['unit']], 'referenceQuantity': {'@type': 'QuantitativeValue', 'value': 1, 'unitCode': UNITCODE[p['unit']]},
                                    'valueAddedTaxIncluded': True},
             'eligibleQuantity': {'@type': 'QuantitativeValue', 'minValue': p['min'], 'unitCode': UNITCODE[p['unit']]},
             'seller': {'@id': BASE + '/#org'},
             'hasMerchantReturnPolicy': {'@type': 'MerchantReturnPolicy', 'applicableCountry': 'RO', 'returnPolicyCountry': 'RO',
                                         'returnPolicyCategory': 'https://schema.org/MerchantReturnFiniteReturnWindow', 'merchantReturnDays': 14,
                                         'returnMethod': 'https://schema.org/ReturnByMail', 'returnFees': 'https://schema.org/ReturnShippingFees'}}
    prod = {'@type': 'Product', 'name': p['name'], 'sku': 'MC-' + p['id'].upper(), 'brand': {'@type': 'Brand', 'name': 'MedClyn'},
            'description': p['note'], 'image': BASE + '/' + p['img'], 'category': g['name'], 'offers': offer}
    page = head(path=path, title=f"{p['name']} · {lei(p['price'])}/{p['unit']} | MedClyn", desc=desc, depth=2,
                ld=[prod, bc_ld([('Magazin', 'magazin.html'), (p['name'], None)], path)], og_img=p['img'], kind='product')
    page += f'''<section class="band">
  <div class="wrap">
    {crumbs([('Magazin', 'magazin.html'), (g['name'], f'magazin.html#g-{g["id"]}'), (p['name'], None)])}
    <div class="prod" data-id="{p['id']}">
      <figure class="prod-img"><img src="{p['img']}" width="600" height="600" alt="{e(p['name'])}" fetchpriority="high"></figure>
      <div class="prod-main">
        <p class="kicker data"><b class="idx">{p['id'].upper()}</b>{e(g['name'])}</p>
        <h1 class="h1-prod">{e(p['name'])}</h1>
        <p class="sub">{e(p['note'])}</p>
        <p class="prod-price"><b>{lei(p['price'])}</b><span class="data">/ {p['unit']} · cu TVA · {e(rule)}</span></p>
        <div class="prod-buy" id="buy"></div>
        <dl class="shop-terms prod-terms">
          <div><dt>Unde</dt><dd>{e(USES[p['group']])}</dd></div>
          <div><dt>Transport</dt><dd>se stabilește <b>după comandă</b>, la telefon</dd></div>
          <div><dt>Plată</dt><dd>card, sau ordin de plată pe proformă</dd></div>
          <div><dt>Retur</dt><dd>14 zile pentru persoane fizice, dacă nu e tăiat pe comandă</dd></div>
        </dl>
      </div>
    </div>
    {kit}
    {specs}
  </div>
</section>
<section class="band">
  <div class="wrap">
    <div class="shead"><p class="kicker data"><b class="idx">+</b>Merge cu</p><h2>Ce se mai pune lângă.</h2></div>
    <ul class="rel">{rel_html}</ul>
    <p class="more"><a href="magazin.html">Tot magazinul</a> · <a href="index.html#calcul">calculatorul pentru o hală întreagă</a> · <a href="preturi/">lista de prețuri</a></p>
  </div>
</section>
'''
    page += foot('js/product.js')
    write(path, page)
    SITEMAP.append((path, TODAY, [p['img']]))

# ─────────────────────────────── ghiduri ───────────────────────────────

def guide_body(slug):
    sandwich = [c for c in CASES if 'sandwich' in (c['before'] or '') and c.get('country') == 'RO']
    if slug == 'cerinte-dsv-pereti-tavane':
        notes = [
          ('Faianță cu rosturi', 'Rostul înnegrit e prima constatare. Chitul e poros, adună murdărie și nu se mai curăță. La catering, autorizația s-a dat cu faianță, iar la doi ani a venit somația.', 'catering'),
          ('Vopsea „lavabilă”', 'La linia de miere din Dâmbovița, DSV a spus de la început că nu o aprobă. Unde se spală des, se cojește peste linie: exact „desprinderea de particule” din regulament.', 'miere'),
          ('Panou sandwich ruginit', 'Panoul în sine e acceptat. Rugina și vopseaua exfoliată nu, pentru că suprafața nu mai e „în stare bună”. Fazakas Prodcarmi a fost atenționată exact pentru asta.', 'fazakas'),
          ('Tavan cu condens și mucegai', 'Regulamentul cere separat ca tavanul să reducă condensul și mucegaiul. La Lactate Solomonescu, auditul unui lanț de supermarketuri a picat pe tavane.', 'solomonescu'),
        ]
        links = {'catering': 'lucrari/bucatarie-catering/', 'miere': 'lucrari/linie-imbuteliere-miere-dambovita/', 'fazakas': 'lucrari/carmangeria-fazakas-prodcarmi/', 'solomonescu': 'lucrari/lactate-solomonescu-botosani/'}
        ledger = ''.join(f'<div class="crow bad in"><p class="req"><b>{e(a)}</b></p><p class="ans">{e(b)} <a href="{links[k]}">Lucrarea</a>.</p><span class="verdict">neconform</span></div>' for a, b, k in notes)
        return f'''<h2>Ce scrie în regulament</h2>
<p>Regulamentul (CE) nr. 852/2004 se aplică oricărei unități care prepară, procesează sau vinde alimente: abator, fabrică, carmangerie, brutărie, restaurant, cantină. Anexa II, capitolul II, spune ce trebuie să fie pereții și tavanele din încăperile unde se lucrează cu alimente.</p>
{rules_html('alimentar')}
<h2>Ce notează inspectorul, de obicei</h2>
<p>Patru constatări apar iar și iar în studiile de caz MedClyn. Niciuna nu ține de neglijență: sunt finisaje care, la spălarea zilnică, nu mai respectă regulamentul după câțiva ani.</p>
<div class="conform">{ledger}</div>
<h2>Ce trece</h2>
<p>Orice suprafață impermeabilă, neabsorbantă, netedă și ușor de dezinfectat, ținută în stare bună. În practică: faianță rectificată montată etanș, panouri noi, sau placare compozită fără rosturi, ca MedClyn, avizată DSV pentru spații de procesare alimentară.</p>
<p>Diferența dintre ele e cât țin. Vopseaua și faianța cu rosturi se refac la 2–3 ani, cu linia oprită. <a href="ghid/faianta-sau-placi-antibacteriene/">Comparația pe 20 de ani</a> arată cât costă asta.</p>
<h2>Dacă ai controlul mâine</h2>
<p>La Ladurée, pe Champs-Élysées, patronul a aflat seara că a doua zi vine controlul. Zece oameni au placat 200 m² de bucătărie într-o noapte de 12–14 ore. Nu e calea obișnuită, dar se poate. Sună la <a href="tel:{COMPANY['phone']}">{COMPANY['phone_h']}</a>.</p>'''
    if slug == 'renovare-panouri-sandwich':
        rows = jobs_table(sandwich, f'Lucrări MedClyn în România peste panouri sandwich · {m2(sum(c["area"] for c in sandwich))}')
        return f'''<h2>De ce nu ține vopseaua</h2>
<p>Panoul sandwich e bun pentru compartimentare și izolație. Fața lui e tablă vopsită. Într-o hală alimentară, peretele se spală zilnic cu apă sub presiune, abur și dezinfectanți, la temperaturi foarte mari sau foarte mici. În 2–3 ani, vopseaua se exfoliază și tabla de dedesubt ruginește.</p>
<p>Odată ce vopseaua din fabrică a cedat, orice strat pus peste ea cedează și mai repede. Pomarom și Sasha &amp; Vlad dau 1–2 ani pentru revopsire. Bona Avis revopsea la 2–3 ani, până când vopseaua n-a mai ținut deloc.</p>
<h2>Ce înseamnă revopsirea</h2>
<ul class="prose-list"><li>vopseaua veche se curăță până la tablă, cu linia oprită;</li><li>timp de uscare, încăpere cu încăpere;</li><li>în 2–3 ani, din nou.</li></ul>
<h2>Placarea, în locul ei</h2>
<p>Placa MedClyn se lipește direct peste panou, cu adeziv de tip mastic. Rugina rămâne închisă sub un strat etanș, iar îmbinările se acoperă cu baghete tată-mamă. Nu se demontează panoul și nu se usucă nimic.</p>
<p>La Bona Avis, liniile au mers 8 ore din 10 cât a durat lucrarea. La Ursus și la abatorul din Bignan, linia n-a oprit deloc.</p>
{rows}
<h2>Cât costă</h2>
<p>Placa e 252,88 lei/m² cu TVA. Cu accesorii și manoperă, MedClyn calculează aproximativ 350 lei/m², o singură dată, cu garanție de 20 de ani. O revopsire la 2–3 ani, pe 20 de ani, ajunge la 8–10 rânduri de vopsea și tot atâtea opriri. Calculatorul de pe prima pagină face socoteala pentru hala ta.</p>'''
    if slug == 'faianta-sau-placi-antibacteriene':
        return f'''<h2>Comparația</h2>
{compare_table()}
<h2>De ce faianța clasică nu trece</h2>
<p>Faianța e bună. Rostul nu. Chitul dintre plăci e poros, se înnegrește și nu se mai curăță; prin el, apa de la spălare intră în spatele faianței. De aceea, într-o bucătărie profesională sau o hală alimentară, faianța cu rosturi e neconformă după câțiva ani, chiar dacă a primit autorizația la deschidere.</p>
<h2>Faianța rectificată</h2>
<p>Rectificată înseamnă tăiată perfect, ca să se monteze fără rost vizibil. Trece de DSV dacă e montată etanș, dar costă în jur de 600 lei/m² cu montaj, stocurile din România sunt mici și sunt puțini montatori care o pun corect.</p>
<h2>Placa MedClyn</h2>
<p>Plăci de până la 3 × 10 m, deci aproape fără îmbinări, și cele care rămân se închid cu baghete. Se montează peste faianța existentă: rosturile murdare rămân sub placă. În jur de 350 lei/m² cu tot cu manoperă, o singură dată în 20 de ani.</p>
<p>Lucrări peste faianță: <a href="lucrari/the-bistrot-benoit-luvru/">The Bistrot Benoit</a>, <a href="lucrari/sala-de-sport-liceu/">sala de sport a unui liceu</a>, <a href="lucrari/bucatarie-catering/">o firmă de catering</a>.</p>'''

def build_guides():
    idx = []
    for gd in C.GUIDES:
        path = f"ghid/{gd['slug']}/"
        art = {'@type': 'Article', 'headline': gd['title'], 'datePublished': gd['date'], 'dateModified': TODAY,
               'author': {'@id': BASE + '/#org'}, 'publisher': {'@id': BASE + '/#org'}, 'description': gd['desc'],
               'mainEntityOfPage': BASE + '/' + path, 'image': [BASE + '/img/og.jpg']}
        page = head(path=path, title=gd['title'] + ' | MedClyn', desc=gd['desc'], depth=2,
                    ld=[art, bc_ld([('Ghiduri', 'ghid/'), (gd['title'], None)], path)], kind='article')
        page += f'''<article class="band guide">
  <div class="wrap">
    {crumbs([('Ghiduri', 'ghid/'), (gd['title'], None)])}
    <div class="shead"><p class="kicker data"><b class="idx">G</b>Ghid · {e(datetime.date.fromisoformat(gd['date']).strftime('%d.%m.%Y'))}</p>
      <h1 class="h1-page">{e(gd['h1'])}</h1><p class="sub">{e(gd['lede'])}</p></div>
    <div class="prose">{guide_body(gd['slug'])}</div>
  </div>
</article>
{lead_form('lf', title='Vrei o cifră pentru spațiul tău?', note='Spune-ne suprafața și ce e pe pereți. Te sunăm cu prețul, fără să trebuiască să explici tot de la capăt.', ctx='ghid: ' + gd['title'])}
'''
        page += foot()
        write(path, page)
        SITEMAP.append((path, gd['date'], []))
        idx.append(f'<li><a href="{path}"><b>{e(gd["title"])}</b><span>{e(gd["desc"])}</span></a></li>')
    path = 'ghid/'
    page = head(path=path, title='Ghiduri: pereți conformi DSV, panouri sandwich, faianță | MedClyn',
                desc='Ghiduri scurte pentru directori de fabrică și proprietari de restaurante: ce verifică DSV la pereți, ce faci cu panourile sandwich ruginite, faianță sau placă.', depth=1,
                ld=[bc_ld([('Ghiduri', None)], path)])
    page += f'''<section class="band"><div class="wrap">{crumbs([('Ghiduri', None)])}
<div class="shead"><p class="kicker data"><b class="idx">G</b>Ghiduri</p><h1 class="h1-page">Ce trebuie știut înainte de renovare.</h1></div>
<ul class="guide-list">{''.join(idx)}</ul></div></section>'''
    page += foot()
    write(path, page)
    SITEMAP.append((path, TODAY, []))

# ─────────────────────────────── întrebări, contact, 404 ───────────────────────────────

def build_faq():
    path = 'intrebari/'
    qs = C.FAQ_COMMON[:]
    for k in C.DOMAINS:
        for q in C.FAQ_DOMAIN.get(k, []):
            if q not in qs: qs.append(q)
    page = head(path=path, title='Întrebări despre placarea MedClyn: preț, DSV, montaj, garanție',
                desc='Răspunsuri scurte, cu cifre din lucrări: cât stă producția, cât costă pe m², ce dezinfectanți suportă, dacă se montează peste faianță sau panouri sandwich.', depth=1,
                ld=[faq_ld(qs), bc_ld([('Întrebări', None)], path)])
    page += f'''<section class="band"><div class="wrap">{crumbs([('Întrebări', None)])}
<div class="shead"><p class="kicker data"><b class="idx">05</b>Întrebări</p><h1 class="h1-page">Ce se întreabă înainte de semnătură.</h1>
<p class="sub">Răspunsurile vin din fișa tehnică și din lucrările încheiate. Ce nu e aici, întreabă la telefon.</p></div>
{faq_html(qs)}</div></section>
{lead_form('lf', title='Altă întrebare? Te sunăm noi.', note='Lasă numărul și ce e pe pereți. Răspunde cineva care a montat.', ctx='pagina: întrebări')}
'''
    page += foot()
    write(path, page)
    SITEMAP.append((path, TODAY, []))

def build_contact():
    path = 'contact/'
    lb = {'@type': 'HomeAndConstructionBusiness', '@id': BASE + '/#firma', 'name': 'MedClyn', 'parentOrganization': {'@id': BASE + '/#org'},
          'image': BASE + '/img/og.jpg', 'telephone': COMPANY['phone'], 'email': COMPANY['email'], 'url': BASE + '/',
          'address': ORG['address'], 'geo': {'@type': 'GeoCoordinates', 'latitude': 45.04, 'longitude': 25.85},
          'openingHoursSpecification': [{'@type': 'OpeningHoursSpecification', 'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'opens': '08:00', 'closes': '20:00'}],
          'areaServed': {'@type': 'Country', 'name': 'România'}, 'priceRange': '252,88 lei/m² material · ~350 lei/m² cu manoperă'}
    page = head(path=path, title='Contact MedClyn: 0733 200 500, Băicoi, Prahova',
                desc='Sună la 0733 200 500, luni – vineri, 08:00 – 20:00, sau scrie la contact@medclyn.com. Depozit și sediu: Strada Oltului 141, Băicoi, Prahova.', depth=1,
                ld=[lb, bc_ld([('Contact', None)], path)])
    page += f'''<section class="band" id="contact"><div class="wrap">{crumbs([('Contact', None)])}
<div class="shead"><p class="kicker data"><b class="idx">07</b>Contact</p><h1 class="h1-page">Sună. Răspunde cineva care a montat.</h1></div>
<div class="contact">
  <div class="plate">
    <a class="plate-tel" href="tel:{COMPANY['phone']}">{COMPANY['phone_h']}</a>
    <dl class="plate-dl">
      <div><dt>Program</dt><dd>Luni – vineri, 08:00 – 20:00</dd></div>
      <div><dt>Email</dt><dd><a href="mailto:{COMPANY['email']}">{COMPANY['email']}</a></dd></div>
      <div><dt>Depozit și sediu</dt><dd>{COMPANY['street']}, {COMPANY['city']}, {COMPANY['region']}, {COMPANY['zip']}</dd></div>
      <div><dt>Firma</dt><dd>{COMPANY['legal']}<br>CUI {COMPANY['vat']} · J29/2121/2006</dd></div>
      <div><dt>Pe rețele</dt><dd><a href="https://www.facebook.com/MedClynRomania/" rel="noopener">Facebook</a> · <a href="https://www.instagram.com/MedClynRomania/" rel="noopener">Instagram</a></dd></div>
    </dl>
    <p class="plate-note">Plăcile se debitează la depozitul din Băicoi, după măsurătoarea făcută de echipa care montează.</p>
  </div>
  <form id="contact-form" class="contact-form" data-lead="contact" novalidate>
    <div class="fields two">
      <div class="field"><label for="ct-name">Nume</label><input id="ct-name" name="name" type="text" autocomplete="name" required></div>
      <div class="field"><label for="ct-mail">Email</label><input id="ct-mail" name="email" type="email" autocomplete="email" required></div>
    </div>
    <div class="field"><label for="ct-subj">Despre ce</label><select id="ct-subj" name="subject"><option>o lucrare nouă</option><option>o comandă din magazin</option><option>garanție și intervenții</option><option>altceva</option></select></div>
    <div class="field"><label for="ct-msg">Mesaj</label><textarea id="ct-msg" name="message" rows="5" required></textarea></div>
    <label class="hp" aria-hidden="true">Site <input name="website" tabindex="-1" autocomplete="off"></label>
    <label class="check consent" for="ct-ok"><input id="ct-ok" name="consent" type="checkbox" required> <span>Sunt de acord ca datele mele să fie folosite ca să primesc răspuns. Detalii în <a href="confidentialitate.html">politica de confidențialitate</a>.</span></label>
    <button class="cta" type="submit">Trimite mesajul</button>
    <p class="of-note" tabindex="-1" role="status" hidden></p>
  </form>
</div></div></section>
'''
    page += foot()
    write(path, page)
    SITEMAP.append((path, TODAY, []))

def build_404():
    page = head(path='404.html', title='Pagina nu există | MedClyn', desc='Pagina căutată nu există.', depth=0)
    page = page.replace('<base href="./">', f'<base href="{"/" if LIVE else "/medclyn-demo/"}">')
    page = page.replace(f'content="{"index, follow, max-image-preview:large" if LIVE else "noindex, nofollow"}"', 'content="noindex"')
    page += f'''<section class="band"><div class="wrap">
<div class="shead"><p class="kicker data"><b class="idx">404</b>Pagina nu există</p><h1 class="h1-page">Aici a fost un rost.</h1>
<p class="sub">Adresa nu mai duce nicăieri. Paginile vechi de pe medclyn.com au fost mutate; cele mai căutate sunt mai jos.</p></div>
<div class="dom-grid">
<a href="lucrari/"><b>Lucrări</b><span class="data">{len(CASES)} de șantiere</span></a>
<a href="preturi/"><b>Prețuri</b><span class="data">de la 252,88 lei/m²</span></a>
<a href="magazin.html"><b>Magazin</b><span class="data">{len(PRODUCTS)} produse</span></a>
<a href="ce-este-medclyn/"><b>Ce este MedClyn</b><span class="data">fișa tehnică</span></a>
<a href="industria-alimentara/"><b>Industria alimentară</b><span class="data">DSV</span></a>
<a href="contact/"><b>Contact</b><span class="data">{COMPANY['phone_h']}</span></a>
</div></div></section>'''
    page += foot()
    (SITE / '404.html').write_text(page)

# ─────────────────────────────── sitemap, robots, redirecturi ───────────────────────────────

def build_meta_files():
    root = [('', TODAY, ['img/og.jpg']), ('magazin.html', TODAY, [p['img'] for p in PRODUCTS])]
    urls = []
    for path, mod, imgs in root + SITEMAP:
        im = ''.join(f'<image:image><image:loc>{e(BASE + "/" + i)}</image:loc></image:image>' for i in imgs[:10])
        urls.append(f'<url><loc>{e(BASE + "/" + path)}</loc><lastmod>{mod}</lastmod>{im}</url>')
    (SITE / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + '\n'.join(urls) + '\n</urlset>\n')
    robots = 'User-agent: *\n' + ('Disallow: /cos.html\nDisallow: /comanda.html\n' if LIVE else 'Disallow:\n') + f'\nSitemap: {BASE}/sitemap.xml\n'
    (SITE / 'robots.txt').write_text(robots)

    # adresele vechi de pe medclyn.com → cele noi (301). Aceleași reguli în două formate.
    red = [('/magazin-online', '/magazin.html'), ('/portofoliu-clienti', '/lucrari/'), ('/blog', '/lucrari/'), ('/galerie-foto', '/lucrari/'),
           ('/testimoniale', '/lucrari/'), ('/video', '/lucrari/')]
    red += [(f"/{c['old']}", f"/{case_url(c)}") for c in CASES]
    for k, d in C.DOMAINS.items():
        bc = {'alimentar': 'bc1', 'medical': 'bc2', 'farma': 'bc3', 'cosmetic': 'bc4', 'bucatarii': 'bc5', 'alte': 'bc6'}[k]
        red.append((f"/{d['slug']}-{bc}", f"/{d['slug']}/"))
    for p in PRODUCTS:
        n = re.search(r'/([^/?]+)\?', p['src'])
        if n: red.append(('/' + n.group(1), '/' + prod_url(p)))
    (ROOT / 'redirects.txt').write_text('# Adresele vechi de pe medclyn.com → paginile noi (301).\n# Format Netlify/Cloudflare Pages; pentru nginx vezi nginx-redirects.conf.\n' +
                                        ''.join(f'{a}  {b}  301\n' for a, b in red))
    (ROOT / 'nginx-redirects.conf').write_text('# Inclus din nginx.conf: adresele vechi de pe medclyn.com → paginile noi.\n' +
                                               ''.join(f'location = {a} {{ return 301 {b}; }}\n' for a, b in red))

    # llms.txt: rezumatul site-ului pentru motoarele de căutare cu AI.
    lines = ['# MedClyn', '', '> Placare antibacteriană pentru pereți și tavane: plăci din rășină poliesterică și fibră de sticlă cu GelCoat, 1,6–2 mm, montate peste suportul existent fără oprirea producției. Avizate DSV, garanție 20 de ani. România, cu sediul în Băicoi, Prahova. Telefon 0733 200 500.', '',
             '## Pagini', f'- [Ce este MedClyn]({BASE}/ce-este-medclyn/): fișa tehnică, montajul, garanția', f'- [Prețuri]({BASE}/preturi/): placa 252,88 lei/m² cu TVA; ~350 lei/m² cu manoperă',
             f'- [Lucrări]({BASE}/lucrari/): {len(CASES)} studii de caz, {m2(TOTAL_M2)}', f'- [Magazin]({BASE}/magazin.html)', f'- [Întrebări]({BASE}/intrebari/)', f'- [Contact]({BASE}/contact/)', '', '## Domenii']
    lines += [f"- [{d['name']}]({BASE}/{d['slug']}/)" for d in C.DOMAINS.values()]
    lines += ['', '## Ghiduri'] + [f"- [{g['title']}]({BASE}/ghid/{g['slug']}/)" for g in C.GUIDES]
    lines += ['', '## Lucrări'] + [f"- [{c['client']}]({BASE}/{case_url(c)}): {m2(c['area'])}" + (f", {c['duration']}" if c.get('duration') else '') for c in CASES]
    (SITE / 'llms.txt').write_text('\n'.join(lines) + '\n')

# ─────────────────────────────── paginile scrise de mână ───────────────────────────────

def patch_root_pages():
    """Indexare, canonical și date structurate pe paginile scrise de mână."""
    robots = 'index, follow, max-image-preview:large' if LIVE else 'noindex, nofollow'
    for name, path, index in [('index.html', '', True), ('magazin.html', 'magazin.html', True), ('termeni.html', 'termeni.html', True),
                              ('confidentialitate.html', 'confidentialitate.html', True), ('cookie.html', 'cookie.html', True),
                              ('cos.html', 'cos.html', False), ('comanda.html', 'comanda.html', False)]:
        f = SITE / name
        s = f.read_text()
        s = re.sub(r'<meta name="robots" content="[^"]*">', f'<meta name="robots" content="{robots if index else "noindex, follow"}">', s)
        if '<link rel="canonical"' in s:
            s = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{BASE}/{path}">', s)
        else:
            s = s.replace('<meta name="robots"', f'<link rel="canonical" href="{BASE}/{path}">\n<meta name="robots"', 1)
        s = re.sub(r'(<meta property="og:(?:url|image)" content=")https://[^"/]+(?:/medclyn-demo)?/', rf'\g<1>{BASE}/', s)
        s = re.sub(r'\n?<script type="application/ld\+json">.*?</script>', '', s, flags=re.S)
        ld = None
        if name == 'index.html':
            ld = [ORG, {'@type': 'WebSite', '@id': BASE + '/#site', 'url': BASE + '/', 'name': 'MedClyn', 'inLanguage': 'ro-RO', 'publisher': {'@id': BASE + '/#org'}},
                  faq_ld(C.FAQ_COMMON)]
        elif name == 'magazin.html':
            ld = [ORG, {'@type': 'ItemList', 'name': 'Magazin MedClyn', 'itemListElement': [
                {'@type': 'ListItem', 'position': i, 'url': BASE + '/' + prod_url(p), 'name': p['name']} for i, p in enumerate(PRODUCTS, 1)]},
                  bc_ld([('Magazin', None)], 'magazin.html')]
        if ld:
            js = json.dumps({'@context': 'https://schema.org', '@graph': ld}, ensure_ascii=False, separators=(',', ':'))
            s = s.replace('</head>', f'<script type="application/ld+json">{js}</script>\n</head>', 1)
        f.write_text(s)

def patch_shop_static():
    """Catalogul magazinului, randat în HTML: se vede fără JS și îl indexează motoarele.
    shop.js îl găsește și adaugă doar cantitatea și butonul."""
    f = SITE / 'magazin.html'
    s = f.read_text()
    out = []
    n = 0
    for g in GROUPS:
        ps = [p for p in PRODUCTS if p['group'] == g['id']]
        out.append(f'<section class="cat-group" aria-labelledby="g-{g["id"]}"><div class="cat-h"><h2 id="g-{g["id"]}">{e(g["name"])}</h2><span class="data">{len(ps)} {"produs" if len(ps) == 1 else "produse"}</span></div>')
        for p in ps:
            n += 1
            rule = f"în multipli de {p['step']} {p['unit']}" if p['step'] > 1 else (f"de la {p['min']} {p['unit']}" if p['min'] > 1 else ('la bucată' if p['unit'] == 'buc' else f"la {p['unit']}"))
            out.append(f'''<article class="part" id="{p['id']}">
  <span class="part-n">{n:02d}</span>
  <img class="part-img" src="{p['img']}" width="104" height="104" alt="" loading="lazy" decoding="async">
  <div>
    <h3 class="part-name"><a href="{prod_url(p)}">{e(p['name'])}</a></h3>
    <p class="part-note">{e(p['note'])}</p>
    <a class="part-src data" href="{prod_url(p)}">detalii și fișa produsului</a>
  </div>
  <p class="part-price"><b>{lei(p['price'])}</b><span>/ {p['unit']} · {e(rule)}</span></p>
  <div class="part-buy"></div>
</article>''')
        out.append('</section>')
    block = '<!-- catalog:start -->\n' + '\n'.join(out) + '\n<!-- catalog:end -->'
    if '<!-- catalog:start -->' in s:
        s = re.sub(r'<!-- catalog:start -->.*?<!-- catalog:end -->', lambda _: block, s, flags=re.S)
    else:
        s = s.replace('<div id="catalog" class="catalog" aria-live="polite"></div>', f'<div id="catalog" class="catalog" aria-live="polite">\n{block}\n</div>')
    f.write_text(s)

# ─────────────────────────────── rulare ───────────────────────────────

if __name__ == '__main__':
    for k in C.DOMAINS: pass
    build_lucrari_index()
    for c in CASES: build_case(c)
    build_ce_este()
    build_preturi()
    for p in PRODUCTS: build_product(p)
    build_guides()
    build_faq()
    build_contact()
    build_404()
    build_meta_files()
    patch_root_pages()
    patch_shop_static()
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'chrome.py')], check=True)
    print(f'{len(PAGES) + 1} pagini generate · {len(CASES)} lucrări · {m2(TOTAL_M2)} · {"LIVE" if LIVE else "demo, noindex"} · {BASE}')
