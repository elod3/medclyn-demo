/* Catalogul magazinului.
 *
 * Sursa unică pentru prețuri: o folosesc magazinul, coșul, calculatorul și
 * serverul de plată (server/src/worker.js), care recalculează totul de aici și
 * nu crede niciun preț venit din browser.
 *
 * Prețurile, unitățile și regulile de cantitate sunt cele din magazinul
 * medclyn.com (verificate 2 oct. 2026), cu TVA inclus. `id` e numărul
 * produsului din adresa lor (…-p1-cat, …-p2-cat).
 *
 *   min   cantitatea minimă pe comandă
 *   step  cantitatea crește din step în step („multiplu de 3” la profile)
 */

export const CATALOG = [
  {
    id: 'p1', group: 'placa',
    name: 'Placă antibacteriană MedClyn, 2 mm',
    note: 'Fibră de sticlă și rășină, cu strat GelCoat RAL 9010. Se livrează la sul, lățime 2,5 m.',
    unit: 'm²', price: 252.88, min: 10, step: 1,
    img: 'img/produse/p1.webp',
    src: 'https://www.medclyn.com/placa-antibacteriana-medclyn-2-mm-grosime-p1-cat?idv=6'
  },
  {
    id: 'p3', group: 'imbinare',
    name: 'Baghetă de îmbinare tată-mamă',
    note: 'Unește două plăci cap la cap, fără rost deschis.',
    unit: 'ml', price: 57.36, min: 3, step: 3,
    img: 'img/produse/p3.webp',
    src: 'https://www.medclyn.com/bagheta-de-imbinare-mos-baba-p3-cat?idv=7'
  },
  {
    id: 'p4', group: 'imbinare',
    name: 'Baghetă de îmbinare tată-mamă, cu garnitură de cauciuc',
    note: 'Aceeași îmbinare, cu garnitură de etanșare, pentru zonele spălate cu jet.',
    unit: 'ml', price: 67.36, min: 3, step: 3,
    img: 'img/produse/p4.webp',
    src: 'https://www.medclyn.com/bagheta-de-imbinare-cu-garnitura-de-cauciuc-mos-baba-p4-cat?idv=8'
  },
  {
    id: 'p6', group: 'imbinare',
    name: 'Baghetă de finisaj tip U',
    note: 'Închide marginea liberă a plăcii, la uși, ferestre și capete de perete.',
    unit: 'ml', price: 22.91, min: 3, step: 3,
    img: 'img/produse/p6.webp',
    src: 'https://www.medclyn.com/bagheta-de-finisaj-tip-u-pentru-placile-medclyn-p6-cat?idv=10'
  },
  {
    id: 'p7', group: 'coltar',
    name: 'Colțar pentru unghi interior, din 2 piese',
    note: 'Pentru colțurile dintre pereți și dintre perete și tavan.',
    unit: 'ml', price: 74.73, min: 3, step: 3,
    img: 'img/produse/p7.webp',
    src: 'https://www.medclyn.com/coltar-pentru-unghi-interior-format-din-2-piese-p7-cat?idv=11'
  },
  {
    id: 'p8', group: 'coltar',
    name: 'Colțar pentru unghi exterior de 90°, PVC alimentar',
    note: 'Protejează muchiile ieșite, pe unde trec transpaletele.',
    unit: 'ml', price: 27.37, min: 3, step: 3,
    img: 'img/produse/p8.webp',
    src: 'https://www.medclyn.com/coltar-pentru-unghi-exterior-de-90-grade-din-pvc-alimentar-p8-cat?idv=12'
  },
  {
    id: 'p9', group: 'coltar',
    name: 'Colțar cu unghi reglabil, PVC alimentar',
    note: 'Pentru muchiile care nu sunt la 90°.',
    unit: 'ml', price: 44.33, min: 3, step: 3,
    img: 'img/produse/p9.webp',
    src: 'https://www.medclyn.com/coltar-unghi-reglabil-din-pvc-alimentar-p9-cat?idv=13'
  },
  {
    id: 'p11', group: 'protectie',
    name: 'Plintă de protecție, PVC alimentar',
    note: 'La baza peretelui, între placă și pardoseală.',
    unit: 'ml', price: 111.27, min: 3, step: 3,
    img: 'img/produse/p11.webp',
    src: 'https://www.medclyn.com/plinta-de-protectie-din-pvc-alimentar-p11-cat?idv=15'
  },
  {
    id: 'p10', group: 'protectie',
    name: 'Plintă foarte rezistentă, din polietilenă',
    note: 'Pentru halele cu trafic greu de transpalete și cărucioare.',
    unit: 'ml', price: 169.58, min: 3, step: 3,
    img: 'img/produse/p10.webp',
    src: 'https://www.medclyn.com/plinta-foarte-rezistenta-din-polietilena-p10-cat?idv=14'
  },
  {
    id: 'p5', group: 'protectie',
    name: 'Element de protecție pentru pereți',
    note: 'Bară montată la înălțimea cărucioarelor, ca loviturile să nu ajungă la placă.',
    unit: 'ml', price: 131.44, min: 3, step: 3,
    img: 'img/produse/p5.webp',
    src: 'https://www.medclyn.com/element-de-protectie-pentru-pereti-p5-cat?idv=9'
  },
  {
    id: 'p12', group: 'protectie',
    name: 'Terminație pentru elementul de protecție',
    note: 'Capătul barei de protecție. Două la fiecare tronson.',
    unit: 'buc', price: 40.46, min: 1, step: 1,
    img: 'img/produse/p12.webp',
    src: 'https://www.medclyn.com/terminatie-pentru-elementul-de-protectie-pereti-p12-cat?idv=16'
  },
  {
    id: 'p2', group: 'montaj',
    name: 'Adeziv de mare aderență, tip mastic',
    note: 'Lipește placa pe perete și pe tavan. Un tub la aproximativ 3 m².',
    unit: 'buc', price: 53.00, min: 1, step: 1,
    img: 'img/produse/p2.webp',
    src: 'https://www.medclyn.com/adeziv-super-puternic-pentru-placi-antibacteriene-medclyn-p2-cat?idv=5'
  }
];

export const GROUPS = [
  { id: 'placa',     name: 'Placa' },
  { id: 'imbinare',  name: 'Îmbinări și finisaj' },
  { id: 'coltar',    name: 'Colțare' },
  { id: 'protectie', name: 'Plinte și protecție' },
  { id: 'montaj',    name: 'Montaj' }
];

export const byId = (id) => CATALOG.find((p) => p.id === id) || null;
