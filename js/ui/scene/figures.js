// Simple stick-and-shape cricketers drawn in SVG. Each figure is built in
// metres with its feet at (0, 0) and y pointing up the screen (negative), then
// placed in the scene with place(screenX, screenY, pixelsPerMetre).
import { svg, set, pts, dirOf } from './svg.js';

const SKIN = '#c98d5f';
const PAD = '#f4f4ee';
const BAT_WOOD = '#e6cd8f';

function placeFn(g) {
  return (x, y, s) => set(g, { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(3)})` });
}

function limb(parent, color, width) {
  return svg('polyline', { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
}

// Knee or elbow: the midpoint pushed sideways by bend (metres).
function joint(a, b, bend) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [mx + (-dy / len) * bend, my + (dx / len) * bend];
}

/**
 * Front or back view person: bowler, keeper, fielders, umpire, non-striker.
 * opts: { shirt, trousers, cap, view: 'front'|'back', gloves, hat, bat }
 */
export function createPerson(parent, opts) {
  const g = svg('g', {}, parent);
  const shadow = svg('ellipse', { cx: 0, cy: 0, rx: 0.42, ry: 0.1, fill: 'rgba(0,0,0,0.28)' }, g);
  const legL = limb(g, opts.trousers, 0.17);
  const legR = limb(g, opts.trousers, 0.17);
  const shoeL = svg('circle', { r: 0.08, fill: '#f2f2f2' }, g);
  const shoeR = svg('circle', { r: 0.08, fill: '#f2f2f2' }, g);
  const armBack = limb(g, opts.shirt, 0.11);
  const torso = limb(g, opts.shirt, 0.36);
  const stripe = limb(g, opts.trim ?? 'rgba(255,255,255,0.0)', 0.06);
  const head = svg('circle', { r: 0.12, fill: opts.view === 'back' ? '#2b1d14' : SKIN }, g);
  let face = null;
  if (opts.view !== 'back') face = svg('circle', { r: 0.02, fill: '#2b1d14' }, g);
  const cap = opts.hat
    ? svg('ellipse', { rx: 0.2, ry: 0.06, fill: opts.cap }, g)
    : svg('path', { d: 'M-0.12 0 A0.12 0.12 0 0 1 0.12 0 Z', fill: opts.cap }, g);
  const armL = limb(g, opts.shirt, 0.11);
  const armR = limb(g, opts.shirt, 0.11);
  const handL = svg('circle', { r: opts.gloves ? 0.09 : 0.05, fill: opts.gloves ?? SKIN }, g);
  const handR = svg('circle', { r: opts.gloves ? 0.09 : 0.05, fill: opts.gloves ?? SKIN }, g);
  let bat = null;
  if (opts.bat) bat = limb(g, BAT_WOOD, 0.1);
  const heldBall = svg('circle', { r: 0.05, fill: '#c1121f' }, g);
  heldBall.setAttribute('visibility', 'hidden');

  /** p: { run, runAmt, armR, armL, crouch, bound, lean, spread } (angles in degrees, 0 = hanging down) */
  function pose(p = {}) {
    const run = p.run ?? 0;
    const amt = p.runAmt ?? 0;
    const crouch = p.crouch ?? 0;
    const bound = p.bound ?? 0;
    const lean = p.lean ?? 0;
    const spread = 0.13 + (p.spread ?? 0) + crouch * 0.12;
    const liftL = Math.max(0, Math.sin(run)) * 0.3 * amt;
    const liftR = Math.max(0, -Math.sin(run)) * 0.3 * amt;
    const footL = [-spread, -liftL - bound * 0.3];
    const footR = [spread, -liftR - bound * 0.3];
    const hip = [lean * 0.1, -0.92 + crouch * 0.38 - bound];
    const neck = [hip[0] + lean * 0.12, hip[1] - 0.55 + crouch * 0.06];
    const headC = [neck[0], neck[1] - 0.17];
    const shL = [neck[0] - 0.17, neck[1] + 0.05];
    const shR = [neck[0] + 0.17, neck[1] + 0.05];
    const swing = Math.sin(run) * 28 * amt;
    const aR = p.armR ?? 12 + swing;
    const aL = p.armL ?? -12 - swing;
    const dR = dirOf(aR);
    const dL = dirOf(aL);
    const hR = [shR[0] + dR[0] * 0.6, shR[1] + dR[1] * 0.6];
    const hL = [shL[0] + dL[0] * 0.6, shL[1] + dL[1] * 0.6];
    set(legL, { points: pts([[hip[0] - 0.08, hip[1]], joint([hip[0] - 0.08, hip[1]], footL, 0.04 + crouch * 0.15), footL]) });
    set(legR, { points: pts([[hip[0] + 0.08, hip[1]], joint([hip[0] + 0.08, hip[1]], footR, -0.04 - crouch * 0.15), footR]) });
    set(shoeL, { cx: footL[0], cy: footL[1] });
    set(shoeR, { cx: footR[0], cy: footR[1] });
    set(torso, { points: pts([hip, neck]) });
    set(stripe, { points: pts([[hip[0], hip[1] - 0.1], [neck[0], neck[1] + 0.02]]) });
    set(head, { cx: headC[0], cy: headC[1] });
    if (face) set(face, { cx: headC[0], cy: headC[1] + 0.02 });
    if (opts.hat) set(cap, { cx: headC[0], cy: headC[1] - 0.06 });
    else set(cap, { transform: `translate(${headC[0].toFixed(3)} ${(headC[1] - 0.02).toFixed(3)})` });
    set(armL, { points: pts([shL, joint(shL, hL, 0.03), hL]) });
    set(armR, { points: pts([shR, joint(shR, hR, -0.03), hR]) });
    set(armBack, { points: pts([shL, shR]) });
    set(handL, { cx: hL[0], cy: hL[1] });
    set(handR, { cx: hR[0], cy: hR[1] });
    set(heldBall, { cx: hR[0], cy: hR[1] });
    set(shadow, { cx: hip[0], rx: 0.3 + spread });
    if (bat) set(bat, { points: pts([[hR[0], hR[1]], [hR[0] + dR[0] * 0.8, hR[1] + dR[1] * 0.8]]) });
  }

  pose();
  return {
    g,
    pose,
    place: placeFn(g),
    holdBall(on) {
      heldBall.setAttribute('visibility', on ? 'visible' : 'hidden');
    },
  };
}

/**
 * The batter, drawn three-quarter on and facing the off side (screen left),
 * right-handed. Pose: { a: bat angle in degrees (0 = bat hanging down,
 * negative = raised behind), lean, stride, crouch, turn }
 */
export function createBatter(parent, { shirt, trousers, helmet }) {
  const g = svg('g', {}, parent);
  svg('ellipse', { cx: 0, cy: 0, rx: 0.55, ry: 0.12, fill: 'rgba(0,0,0,0.3)' }, g);
  const legBack = limb(g, trousers, 0.17);
  const padBack = limb(g, PAD, 0.2);
  const armBack = limb(g, shirt, 0.11);
  const torso = limb(g, shirt, 0.36);
  const legFront = limb(g, trousers, 0.17);
  const padFront = limb(g, PAD, 0.2);
  const head = svg('circle', { r: 0.13, fill: helmet }, g);
  const grille = svg('path', { fill: 'none', stroke: '#d9d9d9', 'stroke-width': 0.025 }, g);
  const handle = limb(g, '#333', 0.045);
  const blade = svg('polyline', { fill: 'none', stroke: BAT_WOOD, 'stroke-width': 0.12, 'stroke-linecap': 'butt' }, g);
  const armFront = limb(g, shirt, 0.11);
  const gloves = svg('circle', { r: 0.075, fill: PAD }, g);

  function pose(p = {}) {
    const a = p.a ?? 15;
    const lean = p.lean ?? 0;
    const stride = p.stride ?? 0;
    const crouch = p.crouch ?? 0.15;
    const footBack = [0.24, 0];
    const footFront = [-0.2 - stride * 0.32, stride * 0.05];
    const hip = [0.02 - stride * 0.12 - lean * 0.04, -0.9 + crouch * 0.18 + stride * 0.06];
    const neck = [hip[0] - 0.1 - lean * 0.2, hip[1] - 0.52 + lean * 0.08];
    const headC = [neck[0] - 0.04 - lean * 0.05, neck[1] - 0.17];
    const pivot = [neck[0] - 0.02, neck[1] + 0.08];
    const d = dirOf(a);
    const hands = [pivot[0] + d[0] * 0.52, pivot[1] + d[1] * 0.52];
    const kneeB = joint(hip, footBack, -0.05 - crouch * 0.1);
    const kneeF = joint(hip, footFront, 0.06 + crouch * 0.12);
    set(legBack, { points: pts([hip, kneeB, footBack]) });
    set(padBack, { points: pts([[kneeB[0], kneeB[1] - 0.08], footBack]) });
    set(legFront, { points: pts([hip, kneeF, footFront]) });
    set(padFront, { points: pts([[kneeF[0], kneeF[1] - 0.08], footFront]) });
    set(torso, { points: pts([hip, neck]) });
    set(head, { cx: headC[0], cy: headC[1] });
    set(grille, { d: `M${(headC[0] - 0.1).toFixed(3)} ${(headC[1] + 0.02).toFixed(3)} q0.1 0.12 0.2 0 M${(headC[0] - 0.09).toFixed(3)} ${(headC[1] + 0.07).toFixed(3)} h0.18` });
    const shF = [neck[0] - 0.08, neck[1] + 0.05];
    const shB = [neck[0] + 0.1, neck[1] + 0.06];
    set(armBack, { points: pts([shB, joint(shB, hands, -0.05), hands]) });
    set(armFront, { points: pts([shF, joint(shF, hands, 0.05), hands]) });
    set(gloves, { cx: hands[0], cy: hands[1] });
    set(handle, { points: pts([[hands[0] - d[0] * 0.06, hands[1] - d[1] * 0.06], [hands[0] + d[0] * 0.24, hands[1] + d[1] * 0.24]]) });
    set(blade, { points: pts([[hands[0] + d[0] * 0.24, hands[1] + d[1] * 0.24], [hands[0] + d[0] * 0.86, hands[1] + d[1] * 0.86]]) });
  }

  pose();
  return { g, pose, place: placeFn(g) };
}
