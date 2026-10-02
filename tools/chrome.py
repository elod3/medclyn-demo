#!/usr/bin/env python3
"""Copiază subsolul (și bara de sus a paginilor secundare) în toate paginile.

Site-ul n-are build: fiecare pagină are HTML-ul complet, ca să se citească și
fără JS. Blocurile comune stau aici o singură dată și se rescriu între
markerele <!-- footer:start --> … <!-- footer:end --> (și hud:start/hud:end).

    python3 tools/chrome.py
"""
import pathlib, re

SITE = pathlib.Path(__file__).resolve().parent.parent / 'site'

DOMENII = [('industria-alimentara/', 'Industria alimentară'), ('domeniul-medical/', 'Spitale și clinici'),
           ('industria-farmaceutica/', 'Industria farmaceutică'), ('industria-cosmetica/', 'Industria cosmetică'),
           ('bucatarii-profesionale/', 'Bucătării profesionale'), ('alte-domenii/', 'Săli de sport, vestiare, școli')]
PAGINI = [('ce-este-medclyn/', 'Ce este MedClyn'), ('lucrari/', 'Lucrări'), ('preturi/', 'Prețuri'), ('magazin.html', 'Magazin'),
          ('index.html#calcul', 'Calculator'), ('intrebari/', 'Întrebări'), ('ghid/', 'Ghiduri'), ('contact/', 'Contact')]
LEGAL = [('termeni.html', 'Termeni și condiții'), ('confidentialitate.html', 'Confidențialitate'), ('cookie.html', 'Cookie-uri')]
links = lambda xs: ''.join(f'<a href="{h}">{t}</a>' for h, t in xs)

FOOTER = f'''<!-- footer:start -->
<footer class="foot">
  <div class="wrap">
    <div class="foot-id">
      <p class="foot-brand"><b>M</b>ed<b>C</b>lyn</p>
      <p class="foot-tel"><a href="tel:+40733200500">0733 200 500</a></p>
      <p class="data">luni – vineri, 08:00 – 20:00 · <a href="mailto:contact@medclyn.com">contact@medclyn.com</a></p>
      <p class="data">S.C. Multi Contrast Design S.R.L. · CUI RO19063140 · J29/2121/2006<br>Strada Oltului 141, Băicoi, Prahova, 105200</p>
      <p class="data"><a href="https://www.facebook.com/MedClynRomania/" rel="noopener">Facebook</a> · <a href="https://www.instagram.com/MedClynRomania/" rel="noopener">Instagram</a></p>
    </div>
    <nav class="foot-col data" aria-label="Domenii"><p>Domenii</p>{links(DOMENII)}</nav>
    <nav class="foot-col data" aria-label="Pagini"><p>Site</p>{links(PAGINI)}</nav>
    <nav class="foot-col data" aria-label="Legal"><p>Legal</p>{links(LEGAL)}
      <a class="anpc" href="https://anpc.ro/sal" target="_blank" rel="noopener"><img src="img/anpc-sal.png" width="201" height="50" alt="ANPC · Soluționarea alternativă a litigiilor" loading="lazy"></a>
    </nav>
    <p class="data idx foot-demo">Demo de concept · realizat pe baza informațiilor publice de pe medclyn.com · nu este site-ul oficial · three.js, texturi ambientCG CC0, panoramă HDR Poly Haven CC0, contur Natural Earth</p>
  </div>
</footer>
<!-- footer:end -->'''

# bara de sus pentru paginile fără perete (magazin, coș, comandă, pagini legale, paginile generate)
HUD = '''<!-- hud:start -->
<header class="hud hud-page">
  <a class="brand" href="./" aria-label="MedClyn, prima pagină">
    <svg class="brand-mark" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="4,4 96,4 72,28 28,28" fill="#24BFCD"/>
      <polygon points="96,4 96,96 72,72 72,28" fill="#1479B1"/>
      <polygon points="96,96 4,96 28,72 72,72" fill="#2A4C98"/>
      <polygon points="4,96 4,4 28,28 28,72" fill="#1878A8"/>
      <line x1="100" y1="0" x2="70" y2="30" class="gap"/>
      <line x1="0" y1="100" x2="30" y2="70" class="gap"/>
    </svg>
    <span class="brand-word"><b>M</b>ed<b>C</b>lyn</span>
  </a>
  <nav class="index data" aria-label="Cuprins">
    <a href="ce-este-medclyn/"><b>01</b>Sistemul</a>
    <a href="lucrari/"><b>02</b>Lucrări</a>
    <a href="preturi/"><b>03</b>Prețuri</a>
    <a href="magazin.html"><b>04</b>Magazin</a>
    <a href="contact/"><b>05</b>Contact</a>
  </nav>
  <div class="hud-end">
    <p class="marker data"><s>demo de concept</s> · nu este site-ul oficial</p>
    <a class="cart-link data mob-only" href="lucrari/">lucrări</a>
    <a class="cart-link data" href="cos.html">coș <b data-cart-count>0</b></a>
  </div>
</header>
<!-- hud:end -->'''

# bara de jos pe telefon: cele două lucruri pe care le face un client B2B
CALLBAR = '''<!-- callbar:start -->
<nav class="callbar" aria-label="Contact rapid">
  <a class="cb-tel" href="tel:+40733200500"><span class="data">sună</span>0733 200 500</a>
  <a class="cb-offer" href="contact/" data-offer-link>Cere oferta</a>
</nav>
<!-- callbar:end -->'''

def put(html, name, block):
    pat = re.compile(rf'<!-- {name}:start -->.*?<!-- {name}:end -->', re.S)
    if pat.search(html):
        return pat.sub(lambda _: block, html)
    marker = f'<!--{name.upper()}-->'
    return html.replace(marker, block)

for page in sorted(SITE.rglob('*.html')):
    if 'vendor' in page.parts: continue
    html = page.read_text()
    new = put(html, 'footer', FOOTER)
    if page.name != 'index.html' or page.parent != SITE:
        new = put(new, 'hud', HUD)
        new = put(new, 'callbar', CALLBAR)
    if new != html:
        page.write_text(new)
        print('actualizat', page.relative_to(SITE))
