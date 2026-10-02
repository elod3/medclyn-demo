/* Necesarul și prețul, fără 3D.
 *
 * Stă separat de calc.js ca fișa de ofertă și comparația de cost să meargă
 * și când calculatorul 3D nu a pornit încă (sau nu pornește deloc, fără WebGL).
 * Prețurile sunt cele publice din magazinul MedClyn.
 */

export const PRICE = {
  placa:    252.88,   // lei / m²
  imbinare:  57.36,   // lei / ml
  coltar:    27.37,   // lei / ml
  plinta:   111.27,   // lei / ml
  adeziv:    53.00    // lei / buc, ~1 la 3 m²
};
export const PANEL_W = 1.22;   // lățimea utilă a plăcii, m

export function estimate({ L, W, H, ceil }){
  const perim = 2 * (L + W);
  const arie = perim * H + (ceil ? L * W : 0);
  const imbinari = (perim / PANEL_W) * H + (ceil ? (W / PANEL_W) * L : 0);
  const colturi  = 4 * H + (ceil ? perim : 0);
  const plinta   = perim;
  const adeziv   = Math.ceil(arie / 3);
  const v = {
    placa:  arie * PRICE.placa,
    imbin:  imbinari * PRICE.imbinare,
    colt:   colturi * PRICE.coltar,
    plinta: plinta * PRICE.plinta,
    adeziv: adeziv * PRICE.adeziv
  };
  const total = v.placa + v.imbin + v.colt + v.plinta + v.adeziv;
  return { arie, imbinari, colturi, plinta, adeziv, v, total };
}

/* Valorile din câmpuri, cu aceleași limite ca în calculator. */
export function clampNum(v, lo, hi, dflt){
  const n = parseFloat(v);
  return Math.min(hi, Math.max(lo, isFinite(n) ? n : dflt));
}
export function readDims(){
  const val = (id) => (document.getElementById(id) || {}).value;
  const box = document.getElementById('in-ceil');
  return {
    L: clampNum(val('in-l'), 1.2, 120, 24),
    W: clampNum(val('in-w'), 1.2, 120, 12),
    H: clampNum(val('in-h'), 2, 14, 4.2),
    ceil: box ? box.checked : true
  };
}
