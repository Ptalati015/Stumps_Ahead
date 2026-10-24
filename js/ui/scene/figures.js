// Simple stick-and-shape cricketers drawn in SVG. Each figure is built in
// metres with its feet at (0, 0) and y pointing up the screen (negative), then
// placed in the scene with place(screenX, screenY, pixelsPerMetre).
import { svg, set, pts, dirOf } from './svg.js';

const SKIN = '#c98d5f';
const PAD = '#f4f4ee';
const BAT_WOOD = '#e6cd8f';

// mirror flips the figure left-right, for people seen from the front whose
// right arm should be on screen left.
function placeFn(g, mirror = false) {
  return (x, y, s) => set(g, { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(mirror ? -s : s).toFixed(3)} ${s.toFixed(3)})` });
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
 * opts: { shirt, trousers, cap, view: 'front'|'back', gloves, hat, bat, mirror }
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
    place: placeFn(g, opts.mirror),
    holdBall(on) {
      heldBall.setAttribute('visibility', on ? 'visible' : 'hidden');
    },
  };
}

// ---- The batter, modelled in 3D ---------------------------------------------
// Every joint and both ends of the bat are points in world space (metres),
// projected with the scene's camera, so the stance and the swing read
// correctly from any camera. Poses are given in a batter-local frame:
//   a = toward the off side (where a side-on batter's chest faces)
//   h = up
//   b = down the pitch, toward the bowler
// A left-hander is the same model with the a axis flipped (exact mirror).

const BAT_FACE = '#ecd49a';
const BAT_SPINE = '#b8975a';
const HANDLE_LEN = 0.28;
const BLADE_LEN = 0.58;
const BLADE_W = 0.108;

const norm3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const add3 = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k];
const cross3 = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot3 = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/** Rotate a local (a, h, b) vector about the vertical by deg, + toward the leg side. */
export function yawLocal(v, deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // Direction for angle t is (a, b) = (-sin t, cos t), so a rotation by +deg
  // turns straight (0, 1) toward the leg side (-a).
  return [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c];
}

/**
 * opts: { shirt, trousers, helmet }
 * Returns { g, draw(state, project, camPos) } where state is
 * { x, z, fx, pose } and pose has hands, dir, face (local vectors), front and
 * back feet ([a, b]), crouch, turn (0..1 chest opening), lean, lift (0..1 per
 * foot as [front, back]).
 */
export function createBatter3D(parent, { shirt, trousers, helmet }) {
  const g = svg('g', {}, parent);
  const shadow = svg('ellipse', { fill: 'rgba(0,0,0,0.3)' }, g);
  const parts = {
    legB: limb(g, trousers, 1),
    padB: limb(g, PAD, 1),
    legF: limb(g, trousers, 1),
    padF: limb(g, PAD, 1),
    shoeB: svg('circle', { fill: '#f2f2f2' }, g),
    shoeF: svg('circle', { fill: '#f2f2f2' }, g),
    torso: limb(g, shirt, 1),
    armB: limb(g, shirt, 1),
    armF: limb(g, shirt, 1),
    head: svg('circle', { fill: helmet }, g),
    peak: limb(g, '#d9d9d9', 1),
    spine: svg('polygon', { fill: BAT_SPINE, stroke: '#8a6d3b', 'stroke-width': 0.4, 'stroke-linejoin': 'round' }, g),
    blade: svg('polygon', { fill: BAT_FACE, stroke: '#a88a4f', 'stroke-width': 0.4, 'stroke-linejoin': 'round' }, g),
    handle: limb(g, '#2b2b2b', 1),
    gloves: svg('circle', { fill: PAD }, g),
  };
  let order = [];

  function draw({ x, z, fx, pose: p }, project, camPos) {
    const W = ([a, h, b]) => [x + a * fx, h, z + b];
    const V = ([a, h, b]) => [a * fx, h, b];
    const P = (pt) => project(pt[0], pt[1], pt[2]);
    const depth = (pt) => Math.hypot(pt[0] - camPos[0], pt[1] - camPos[1], pt[2] - camPos[2]);

    const crouch = p.crouch ?? 0.15;
    const lean = p.lean ?? 0;
    const open = (p.turn ?? 0) * 80;
    const [liftF, liftB] = p.lift ?? [0, 0];
    const footF = [p.front[0], liftF * 0.12, p.front[1]];
    const footB = [p.back[0], liftB * 0.12, p.back[1]];
    const midB = (footF[2] + footB[2]) / 2;
    const hip = [lean * 0.05 - 0.02, 0.92 - crouch * 0.2, midB + lean * 0.05];
    const axis = yawLocal([0, 0, 1], open);
    const chest = yawLocal([1, 0, 0], open);
    const neck = [hip[0] + chest[0] * lean * 0.1, hip[1] + 0.52 - Math.abs(lean) * 0.05, hip[2] + lean * 0.16];
    const shF = add3([neck[0], neck[1] - 0.04, neck[2]], axis, 0.18);
    const shB = add3([neck[0], neck[1] - 0.04, neck[2]], axis, -0.18);
    const headC = [neck[0] + 0.03, neck[1] + 0.2, neck[2] + 0.04];
    const hipF = add3(hip, yawLocal([0, 0, 1], open * 0.5), 0.1);
    const hipB = add3(hip, yawLocal([0, 0, 1], open * 0.5), -0.1);
    const kneeOf = (h, f) => [(h[0] + f[0]) / 2 + 0.06 + crouch * 0.12, (h[1] + f[1]) / 2, (h[2] + f[2]) / 2];
    const kneeF = kneeOf(hipF, footF);
    const kneeB = kneeOf(hipB, footB);

    const dir = norm3(V(p.dir));
    const face = norm3(V(p.face));
    const handsW = W(p.hands);
    const lowHand = add3(handsW, dir, 0.1);
    const elbow = (sh, hand) => [(sh[0] + hand[0]) / 2 + 0.06 * fx, (sh[1] + hand[1]) / 2 - 0.06, (sh[2] + hand[2]) / 2];

    // World points.
    const w = {
      hipF: W(hipF), hipB: W(hipB), kneeF: W(kneeF), kneeB: W(kneeB), footF: W(footF), footB: W(footB),
      hip: W(hip), neck: W(neck), shF: W(shF), shB: W(shB), head: W(headC),
    };
    const handleTop = add3(handsW, dir, -0.05);
    const shoulder = add3(handsW, dir, HANDLE_LEN);
    const toe = add3(handsW, dir, HANDLE_LEN + BLADE_LEN);
    let across = cross3(dir, face);
    if (Math.hypot(...across) < 1e-3) across = [1, 0, 0];
    across = norm3(across);
    const corners = (off) => {
      const s0 = add3(shoulder, face, off);
      const t0 = add3(toe, face, off);
      return [add3(s0, across, BLADE_W / 2), add3(s0, across, -BLADE_W / 2), add3(t0, across, -BLADE_W / 2), add3(t0, across, BLADE_W / 2)];
    };
    const faceCorners = corners(0);
    const spineCorners = corners(-0.04);
    const bladeMid = add3(shoulder, dir, BLADE_LEN / 2);
    const faceSeen = dot3(face, [camPos[0] - bladeMid[0], camPos[1] - bladeMid[1], camPos[2] - bladeMid[2]]) > 0;

    const line = (node, list, width) => {
      const pr = list.map(P);
      const sc = pr.reduce((t, q) => t + q[2], 0) / pr.length;
      set(node, { points: pts(pr), 'stroke-width': (width * sc).toFixed(2) });
    };
    const dot = (node, pt, r) => {
      const [sx, sy, sc] = P(pt);
      set(node, { cx: sx.toFixed(2), cy: sy.toFixed(2), r: (r * sc).toFixed(2) });
    };
    line(parts.legB, [w.hipB, w.kneeB, w.footB], 0.17);
    line(parts.padB, [add3(w.kneeB, [0, 1, 0], 0.08), w.footB], 0.2);
    line(parts.legF, [w.hipF, w.kneeF, w.footF], 0.17);
    line(parts.padF, [add3(w.kneeF, [0, 1, 0], 0.08), w.footF], 0.2);
    dot(parts.shoeB, w.footB, 0.08);
    dot(parts.shoeF, w.footF, 0.08);
    line(parts.torso, [w.hip, w.neck], 0.34);
    line(parts.armB, [w.shB, elbow(w.shB, lowHand), lowHand], 0.11);
    line(parts.armF, [w.shF, elbow(w.shF, handsW), handsW], 0.11);
    dot(parts.head, w.head, 0.13);
    const peakDir = norm3(V(yawLocal([0.45, 0, 0.9], open * 0.3)));
    line(parts.peak, [add3(w.head, peakDir, 0.06), add3(w.head, peakDir, 0.17)], 0.05);
    set(parts.blade, { points: pts(faceCorners.map(P)), fill: faceSeen ? BAT_FACE : BAT_SPINE });
    set(parts.spine, { points: pts(spineCorners.map(P)), fill: faceSeen ? BAT_SPINE : BAT_FACE });
    line(parts.handle, [handleTop, shoulder], 0.045);
    dot(parts.gloves, add3(handsW, dir, 0.05), 0.075);
    const [gx, gy, gs] = P([w.hip[0], 0, w.hip[2]]);
    set(shadow, { cx: gx.toFixed(2), cy: gy.toFixed(2), rx: (0.55 * gs).toFixed(2), ry: (0.16 * gs).toFixed(2) });

    // Paint far parts first. Blade face and spine swap so the visible side is on top.
    const mid = (...list) => list.reduce((t, q) => t + depth(q), 0) / list.length;
    const bladeDepth = mid(...faceCorners);
    const ranked = [
      ['legB', mid(w.hipB, w.kneeB, w.footB)], ['padB', mid(w.kneeB, w.footB) - 0.01], ['shoeB', depth(w.footB) - 0.02],
      ['legF', mid(w.hipF, w.kneeF, w.footF)], ['padF', mid(w.kneeF, w.footF) - 0.01], ['shoeF', depth(w.footF) - 0.02],
      ['torso', mid(w.hip, w.neck)], ['head', depth(w.head)], ['peak', depth(w.head) - 0.05],
      ['armB', mid(w.shB, lowHand)], ['armF', mid(w.shF, handsW)],
      ['spine', bladeDepth + (faceSeen ? 0.02 : -0.02)], ['blade', bladeDepth], ['handle', mid(handleTop, shoulder)],
      ['gloves', depth(handsW) - 0.03],
    ].sort((m, n) => n[1] - m[1]).map(([k]) => k);
    if (ranked.join() !== order.join()) {
      for (const k of ranked) g.append(parts[k]);
      order = ranked;
    }
  }

  return { g, draw };
}
