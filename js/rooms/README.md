# Interioarele calculatorului — contract pentru module

Calculatorul (`js/calc.js`) desenează cutia: patru pereți din panou MedClyn RAL 9010 cu
rosturi la 1,22 m și plintă navy, tavanul, o pardoseală de rezervă cu caroiaj și silueta
cyan de 1,75 m. **Tot ce e înăuntru vine dintr-un modul de aici**, unul pe treaptă:

| id | treaptă | aria podelei (L×W) | dimensiunea presetată L×W×H |
|---|---|---|---|
| `baie` | grup sanitar | ≤ 10 m² | 2,4 × 1,8 × 2,6 |
| `cabinet` | cabinet medical | 10–40 m² | 4,5 × 3,6 × 2,8 |
| `macelarie` | măcelărie / magazin cu laborator | 40–240 m² | 14 × 9 × 3,5 |
| `abator` | abator de păsări | 240–450 m² | 24 × 12 × 4,2 |
| `fabrica` | fabrică alimentară (bere, lactate) | 450–1.500 m² | 32 × 18 × 5 |
| `logistic` | hală logistică / depozit frigorific | > 1.500 m² | 120 × 60 × 12 |

## API

```js
// js/rooms/<id>.js
import { THREE, pbr, flat, box, floorPlane, cyl, glb, instances, onWall } from './kit.js';

export async function build({ L, W, H, ceil }){
  const g = new THREE.Group();
  // ... tot interiorul, în metri
  return g;
}
```

- Originea e **centrul podelei**. x de la −L/2 la +L/2, z de la −W/2 la +W/2, y în sus.
  Pereții sunt planele x = ±L/2 și z = ±W/2; tavanul e la y = H.
- `build` se cheamă din nou la fiecare schimbare de dimensiuni (după 180 ms de liniște).
  Layoutul trebuie să **se adapteze parametric**: numărul de rânduri de rafturi, de tejghele
  sau de linii crește cu L și W, iar înălțimile se limitează la H. Trebuie să arate bine pe
  toată plaja treptei și să nu se strice în afara ei (L, W de la 1,2 la 120, H de la 2 la 14).
- **Pardoseala e a modulului**: pune pardoseala reală (gresie antiderapantă, rășină epoxidică,
  beton elicopterizat etc.) ca `floorPlane(L, W, mat, 0, 0.002, 0)`. Caroiajul cyan se desenează
  oricum peste ea.
- **Nu desena pereții încăperii.** Sunt ai calculatorului și sunt placare MedClyn: asta e
  produsul pe care îl vindem. Poți pune *pe* pereți uși, ferestre, uși sectionale, lavoare,
  corpuri de iluminat, aparatură. Tot ce e lipit de un perete intră într-un grup marcat cu
  `onWall(obj, 'N' | 'S' | 'E' | 'W' | 'C')` și pus **direct în grupul întors** (copil direct),
  ca să dispară odată cu peretele când camera trece prin fața lui. N = z = −W/2,
  S = z = +W/2, E = x = +L/2, W = x = −L/2, C = tavan.
- Camera se rotește pe orbită în jurul halei, privind de sus la ~25–35°. Pereții dinspre ea
  se ascund. Deci interiorul se vede din toate părțile și de sus: nu pune plafoane false sau
  structuri dense sub tavan care să acopere podeaua. Structura de acoperiș (grinzi, ferme)
  merge doar dacă e rară și marcată `onWall(..., 'C')`.
- Lumina o dă calculatorul: mediu PMREM (RoomEnvironment), o emisferă, un soare cu umbre,
  ACES. Poți adăuga corpuri de iluminat **emisive**. Nu adăuga lumini reale (fără PointLight
  sau SpotLight): costă prea mult.
- Buget: ≤ 200.000 triunghiuri la dimensiunea maximă a treptei, ≤ 250 draw call-uri. Folosește
  `instances()` sau `InstancedMesh` pentru repetiții: rafturi, cutii, stâlpi, cârlige, lămpi.

## Asseturi

- **Texturi**: doar CC0 (ambientCG, Poly Haven), la 1K JPG, în `tex/rooms/<NumeAsset>/` cu
  numele `color.jpg`, `normal.jpg` (OpenGL; la ambientCG e `_NormalGL`), `rough.jpg`, opțional
  `ao.jpg` și `metal.jpg`. `pbr('<NumeAsset>', { tile: <metri pe repetare> })`. Descarcă direct:
  `https://ambientcg.com/get?file=<Asset>_1K-JPG.zip` și Poly Haven prin API-ul lor
  (`https://api.polyhaven.com/files/<asset>`).
- **Modele**: doar CC0 (Poly Haven models, Kenney, Quaternius, Poly Pizza cu licență CC0
  verificată pe pagină), GLB, în `models/<id-modul>/`. Încarci cu `glb('<id>/<fișier>.glb', mărime, axă)`.
  Scrie sursa și licența în `models/<id-modul>/CREDITS.txt`.
- Unde nu există un model CC0 bun, **modelează-l tu** din primitive three.js (`BoxGeometry`,
  `CylinderGeometry`, `LatheGeometry`, `ExtrudeGeometry`, `TubeGeometry`, `RoundedBoxGeometry`)
  cu materiale PBR reale. Addon-uri noi se aduc cu curl de pe
  `https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/...` în aceeași cale sub `vendor/jsm/`,
  și se importă ca `three/addons/...`.
- Buget pe modul: ≤ 4 MB de fișiere noi.

## Previzualizare

Serverul rulează pe http://localhost:8080 (dacă nu: `cd ~/medclyn-demo && nohup ./serve.sh >/dev/null 2>&1 &`).

```
http://localhost:8080/?only=calcul&flat=1&room=<id>&l=<L>&w=<W>&h=<H>&angle=<radiani>
```

`room=` forțează modulul, `angle=` fixează unghiul camerei (0,85 e cel implicit; încearcă și
2,4 · 4,0 · 5,5 ca să vezi toate laturile). Captură: vezi `~/medclyn-demo/CLAUDE.md`, secțiunea
„Capturi de ecran”, cu `--window-size=1600,1100` și **un `--user-data-dir` nou la fiecare captură**.
Vederea 3D e în dreptunghiul x 425–1115, y 215–735 (`sips -c 520 690 --cropOffset 425 215`).
Erorile din consolă: adaugă `--enable-logging=stderr` și caută `CONSOLE` în ieșire.
