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

Folosește `python3 -m http.server`, care e deja pe macOS. Nu e nevoie de node sau de build.
Totul e local, deci demo-ul merge și fără internet.

### Cu Docker

Docker nu e instalat încă pe mașina asta, iar fișierele de mai jos nu au fost testate.

```bash
brew install --cask docker    # apoi deschizi Docker.app o dată
docker compose up --build     # http://localhost:8080
```

### GitHub Pages

Workflow-ul din `.github/workflows/pages.yml` publică folderul `site/`.

```bash
git init -b main && git add -A && git commit -m "Demo MedClyn"
git remote add origin git@github.com:<user>/<repo>.git && git push -u origin main
```

Apoi în repo: **Settings → Pages → Source: GitHub Actions**.

## Ce e în pagină

| Secțiune | Ce face |
|---|---|
| **Hero** | Perete real de faianță (hărți PBR ambientCG) cu biofilm viu, luminat de un HDRI de hală. Ștergi cu mâna și apare panoul GelCoat. |
| **01 Conformitate** | Cerințele din Regulamentul CE 852/2004, rând cu rând, lângă fișa tehnică MedClyn. |
| **02 Șantiere** | Ursus, Bona Avis, AYT, cu suprafață, durată, echipă și cât a stat producția. |
| **03 Calcul** | Hala se construiește în 3D din trei numere, cu necesar și preț pe prețurile lor publice. |

Identitatea vizuală e a lor: navy `#003a84`, cyan `#24bfcc`, Nunito Sans, simbolul refăcut
vectorial. Detalii în `research/brand.md`.

## Parametri utili

- `?l=48&w=24&h=7` — presetează hala din calculator (poți trimite link cu hala clientului)
- `?mask=1` — peretele complet curat
- `?only=calcul` — doar o secțiune

Arhitectura și capcanele tehnice sunt în `CLAUDE.md`. Surse: texturi ambientCG (CC0),
panoramă HDR Poly Haven (CC0), three.js r169.
