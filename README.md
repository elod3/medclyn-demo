# Peretele Viu — demo de concept MedClyn

Demo pentru rebuild-ul site-ului medclyn.com. Peretele contaminat e fundalul întregului
site: îl ștergi cu mâna și apare placa MedClyn, iar pe măsură ce cobori prin pagină se
curăță singur.

> **Nu este site-ul oficial MedClyn.** Nu colectează date și nu preia comenzi.
> Specificațiile, prețurile și cifrele de șantier sunt cele publicate de MedClyn.

## Rulare

```bash
./serve.sh          # http://localhost:8080
./serve.sh 3000     # alt port
```

Folosește `python3 -m http.server`. Nu e nevoie de node sau de build pentru site.
Totul e local, deci demo-ul merge și fără internet.

### Cu Docker

Fișierele de mai jos nu au fost testate.

```bash
docker compose up --build     # http://localhost:8080
```

### GitHub Pages

Demo-ul public (https://elod3.github.io/medclyn-demo/) se publică din ramura `gh-pages`,
care conține doar conținutul folderului `site/`:

```bash
git subtree split --prefix site -b gh-pages-tmp
git push origin gh-pages-tmp:gh-pages --force && git branch -D gh-pages-tmp
```

## Ce e în pagină

| Secțiune | Ce face |
|---|---|
| **Hero** | Perete real de faianță (hărți PBR ambientCG) cu biofilm viu, luminat de un HDRI de hală. Ștergi cu mâna și apare panoul GelCoat. |
| **Referințe** | Numele clienților din studiile de caz, imediat sub hero. |
| **01 Control** | Fișă de constatare (exemplu): ce notează inspectorul la faianță și vopsea, cu punctul din CE 852/2004. |
| **02 Conformitate** | Două fișe, pe file: industria alimentară (CE 852/2004) și spitale (Ordinul MS 1096/2016, cum îl citează MedClyn). Cerința în stânga, fișa tehnică în dreapta. |
| **03 Șantiere** | Opt lucrări cu suprafață, durată, echipă și cât a stat producția, plus ce au făcut clienții după. |
| **04 Calcul** | Hala se construiește în 3D din trei numere, cu necesar și preț pe prețurile lor publice. Dedesubt, costul pe 20 de ani: revopsire periodică față de placare. |
| **05 Întrebări** | Obiecțiile unui director de fabrică, cu răspunsuri din studiile de caz și fișa tehnică. |
| **Ofertă** | Fișa de cerere cu hala deja completată. |
| **07 Contact** | Telefon, program, adresă, datele firmei și formularul de contact. |
| **Magazin** (`magazin.html`) | Cele 12 produse din magazinul lor, cu prețuri, unități și reguli de cantitate (placa de la 10 m², profilele în multipli de 3 ml). |
| **Coș** (`cos.html`) | Bonul de comandă și datele de livrare: firmă cu CUI sau persoană fizică, card sau ordin de plată. Calculatorul pune necesarul direct aici. |
| **Comandă** (`comanda.html`) | Bonul cu ștampila: plătit, primită sau demo. |
| **Pagini legale** | `termeni.html`, `confidentialitate.html`, `cookie.html`: ciorne de verificat de juristul lor. |

Bara de jos (suprafață, preț, „Cere oferta”) apare după hero și pleacă la formular.
Subsolul și bara de sus a paginilor secundare sunt comune: se scriu o dată în `tools/chrome.py`
și se copiază în toate paginile cu `python3 tools/chrome.py`.
Prețul de revopsire (60 lei/m²) e o estimare a noastră, marcată ca atare în pagină.

Identitatea vizuală e a lor: navy `#003a84`, cyan `#24bfcc`, Nunito Sans, simbolul refăcut
vectorial. Fotografiile produselor sunt cele din magazinul lor. Notele de pitch (`research/`,
`CLAUDE.md`) stau doar local și nu sunt în repo.

## Paginile generate și SEO

Pe lângă prima pagină și magazin, site-ul are 60 de pagini statice generate din
`tools/content.py` (lucrări, domenii, ghiduri, întrebări) și `site/js/catalog.js` (produse):

```bash
python3 tools/build.py                  # demo: noindex, adrese pe GitHub Pages
MEDCLYN_LIVE=1 python3 tools/build.py   # producție: indexabil, adrese pe www.medclyn.com
```

| Pagini | Ce sunt |
|---|---|
| `industria-alimentara/` și celelalte 5 domenii | aceleași adrese ca pe medclyn.com; norma, lucrările din domeniu, întrebări, formular scurt |
| `lucrari/` + 35 de lucrări | toate studiile lor de caz, cu cifrele și fotografiile lor, pe hartă |
| `ce-este-medclyn/`, `preturi/` | fișa tehnică, montajul, garanția, lista de prețuri, costul pe 20 de ani |
| `magazin/<produs>/` × 12 | pagină pe produs; la placă, necesarul pe încăpere pus direct în coș |
| `ghid/` × 3, `intrebari/`, `contact/`, `404.html` | ghiduri pe căutări reale (DSV, panouri sandwich, faianță) |

Fiecare pagină are titlu, descriere, canonical și date structurate (Organization, Product cu
preț pe unitate și politică de retur, Article, FAQPage, BreadcrumbList, ItemList). Build-ul
scrie și `sitemap.xml` (cu imagini), `robots.txt`, `llms.txt` și redirecturile 301 de la
adresele vechi de pe medclyn.com (`redirects.txt` pentru Netlify/Cloudflare,
`nginx-redirects.conf` pentru nginx).

**Demo-ul de pe GitHub Pages rămâne `noindex`**: e o copie neoficială și n-are voie să concureze
cu medclyn.com în Google. Pentru lansare: `MEDCLYN_LIVE=1`, apoi sitemap-ul trimis în Search Console.

Fotografiile de șantier (`site/img/lucrari/`) sunt cele publicate de MedClyn în articolele lor.
Conturul României din harta lucrărilor e din Natural Earth (domeniu public).

## Plăți

Site-ul e static; tot ce încasează sau trimite trece prin `server/`, un Cloudflare Worker fără
dependențe. Prețurile stau într-un singur fișier, `site/js/catalog.js`, citit și de magazin, și
de server. Serverul primește din browser doar `{ id, qty }` și recalculează totul, deci un preț
modificat în pagină nu ajunge niciodată în Stripe.

Cât timp `apiBase` din `site/js/config.js` e gol, site-ul e în **mod demo**: coșul, comanda și
formularele merg cap-coadă, dar nu pleacă nimic și nu se încasează nimic, iar paginile spun asta.

### Ce trebuie ca să pornească

1. **Stripe** (obligatoriu pentru card): din contul MedClyn, cheia secretă (`sk_live_…`) și un
   webhook spre `https://<worker>/api/stripe/webhook` pe evenimentele
   `checkout.session.completed` și `checkout.session.async_payment_succeeded` (dă `whsec_…`).
2. **Resend** (opțional): fără el, plata cu cardul merge, iar comenzile se văd în Stripe, cu toate
   datele în metadata. Ordinul de plată și formularele au însă nevoie de email: fără Resend, coșul
   ascunde ordinul de plată, iar formularele le cer oamenilor să sune. Resend e gratuit până la 3.000 de emailuri pe lună; trebuie verificat domeniul `medclyn.com`.

```bash
cd server
npx wrangler login                                 # contul Cloudflare al MedClyn
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY             # opțional
# în wrangler.toml, la [vars]: SITE_URL, ALLOWED_ORIGIN, MAIL_FROM, MAIL_TO
npx wrangler deploy
```

Apoi, în `site/js/config.js`, `apiBase` primește adresa workerului. Coșul întreabă serverul ce
metode sunt pornite (`/api/health`) și le ascunde pe celelalte.

### Cum merge o comandă

- **Card**: serverul creează o sesiune Stripe Checkout în lei, cu numărul comenzii
  (`MC-251002-ABCD`) și datele clientului în metadata. Clientul plătește pe pagina Stripe, se
  întoarce pe `comanda.html`, iar pagina verifică la server că sesiunea e plătită. Webhook-ul
  (cu semnătura verificată) trimite comanda pe email la MedClyn.
- **Ordin de plată**: comanda ajunge pe email la MedClyn, iar clientul primește confirmarea.
  Proforma o emite MedClyn.
- **Transportul nu e în coș**, la fel ca acum pe medclyn.com: se stabilește la telefon după
  comandă și se facturează separat. Cu cardul se plătesc doar produsele.
- Peste 999.999,99 lei, Stripe nu încasează într-o singură plată; coșul trece singur pe ordin de plată.

### Teste

```bash
cd server && node --test test/     # 17 teste: prețuri, reguli de cantitate, Stripe, webhook, emailuri
```

Stripe și Resend sunt simulați în teste; nu iese nimic pe rețea.

### Ce rămâne de hotărât cu MedClyn

- **Factura fiscală.** Stripe încasează, dar factura (și e-Factura pentru firme) o emite programul
  lor de facturare. Dacă folosesc SmartBill sau Oblio, webhook-ul poate s-o emită automat.
- **Textele legale** sunt ciorne, de citit cu juristul lor. Pe medclyn.com, termenii încă spun
  „TVA 19%”; cota e 21% din 1 august 2025, iar prețurile din magazin sunt deja cu TVA inclus.
- **Ridicarea de la depozitul din Băicoi**: nu apare pe site-ul lor, așa că nu e nici în coș.
- **Paginile de domeniu** pentru farma, cosmetică, bucătării profesionale și „alte domenii” sunt
  goale pe site-ul lor; în demo apar doar alimentar și medical, unde există normă citată.

## Parametri utili

- `?l=48&w=24&h=7` — presetează hala din calculator (poți trimite link cu hala clientului; butonul „trimite hala celui care semnează” îl copiază)
- `?ceil=0` — fără tavan
- `?mask=1` — peretele complet curat
- `?only=calcul` — doar o secțiune
- `?domeniu=medical` — deschide fișa de conformitate pentru spitale
- `magazin.html#p7` — link direct spre un produs

Surse: texturi ambientCG (CC0),
panoramă HDR Poly Haven (CC0), three.js r169.
