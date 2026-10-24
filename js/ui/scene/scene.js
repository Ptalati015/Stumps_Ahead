// Match scene for the play screen: a broadcast-style view from behind the
// bowler (pitch cam) and a top-down ground view for where the ball goes
// (field cam). Purely visual: it never decides an outcome, it only acts out
// the BallResult the engine returns. Cosmetic choices (exact shot direction,
// which fielder chases) use Math.random, never the match rng.
import { svg, set, pts, lerp, clamp01, easeOut, easeInOut } from './svg.js';
import { createPerson, createBatter } from './figures.js';

// ---- Pitch cam projection --------------------------------------------------
// World: x across the pitch (metres, + is the leg side of a right-hander,
// screen right), y up, z along the pitch from the batter's stumps (0) to the
// bowler's stumps (20.12). The camera sits behind the bowler, looking down the
// pitch with a long lens, like a TV broadcast.
const VB_W = 400;
const VB_H = 300;
const CX = VB_W / 2;
const FOCAL = 1700;
const CAM_Z = 50;
const CAM_H = 4.2;
const HORIZON = -30;

function project(x, y, z) {
  const s = FOCAL / Math.max(0.5, CAM_Z - z);
  return [CX + x * s, HORIZON + (CAM_H - y) * s, s];
}

const STUMP_X = [-0.114, 0, 0.114];
const STUMP_H = 0.71;
const CREASE_Z = 1.22;
const BATTER = { x: 0.42, z: 0.95 };
const RELEASE = { x: -0.25, y: 2.2, z: 19.4 };
const BOUNCE_Z = { yorker: 1.7, full: 3.6, good: 6.6, short: 10.2 };
const ARRIVE_H = { yorker: 0.12, full: 0.45, good: 0.85, short: 1.35 };
const LINE_AT_CREASE = { off: -0.17, middle: 0, leg: 0.15 };
const UMPIRE = { x: 0.8, z: 22 };
const NON_STRIKER = { x: 1.35, z: 19.4 };
const RUN_START = { x: -0.8, z: 25.6 };
const BOUND_AT = { x: -0.55, z: 21.4 };
const DELIVERY_STRIDE = { x: -0.45, z: 19.9 };
const FOLLOW_END = { x: -1.7, z: 16.6 };

// ---- Field cam ---------------------------------------------------------
// Top-down, same orientation: the batter at the top, the bowler at the bottom,
// off side on the left. Field units are metres from the middle of the pitch.
const FS = 1.6;
const ROPE = 65;
const fpos = (X, Y) => [CX + X * FS, VB_H / 2 + Y * FS];
const STRIKER_END = -10.06;
const BOWLER_END = 10.06;
// Fielders as [angle, distance] from the striker. Angle 0 is straight back
// past the bowler, positive is the leg side, +-180 is behind the keeper.
const FIELD = [
  [-165, 13], [-95, 25], [-58, 28], [-18, 33], [18, 33], [62, 30], [100, 27], [152, 50], [-150, 50],
];
const SHOT_ANGLES = { defend: [-25, 25], drive: [-55, 15], loft: [-35, 35], pull: [60, 115], cut: [-120, -70], leave: [-10, 10] };

// Batting animation keyframes in ms from the tap. Contact happens at about 70 ms.
const BACKLIFT = { a: -135, lean: 0, stride: 0, crouch: 0.2 };
const STANCE = { a: 18, lean: 0, stride: 0, crouch: 0.15 };
const SWINGS = {
  defend: [{ ms: 70, a: -8, lean: 0.7, stride: 0.9, crouch: 0.3 }, { ms: 600, a: -6, lean: 0.7, stride: 0.9, crouch: 0.3 }],
  drive: [{ ms: 70, a: 0, lean: 0.6, stride: 1, crouch: 0.2 }, { ms: 380, a: 150, lean: 0.4, stride: 1, crouch: 0.2 }, { ms: 800, a: 150, lean: 0.4, stride: 1, crouch: 0.2 }],
  loft: [{ ms: 70, a: 0, lean: 0.3, stride: 0.7, crouch: 0.1 }, { ms: 420, a: 222, lean: -0.2, stride: 0.7, crouch: 0.05 }, { ms: 800, a: 222, lean: -0.2, stride: 0.7, crouch: 0.05 }],
  pull: [{ ms: 70, a: -95, lean: -0.3, stride: -0.4, crouch: 0.15 }, { ms: 400, a: -232, lean: -0.3, stride: -0.4, crouch: 0.15 }, { ms: 800, a: -232, lean: -0.3, stride: -0.4, crouch: 0.15 }],
  cut: [{ ms: 70, a: 85, lean: 0.2, stride: -0.3, crouch: 0.25 }, { ms: 380, a: 58, lean: 0.2, stride: -0.3, crouch: 0.25 }, { ms: 800, a: 58, lean: 0.2, stride: -0.3, crouch: 0.25 }],
  leave: [{ ms: 160, a: -200, lean: -0.2, stride: 0.4, crouch: 0.1 }, { ms: 700, a: -200, lean: -0.2, stride: 0.4, crouch: 0.1 }],
};

const rand = (a, b) => a + Math.random() * (b - a);

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch);
  return `rgb(${r},${g},${b})`;
}

/** x position of a delivery at the batting crease. */
function lineX(delivery) {
  if (delivery.extra === 'wide') return delivery.line === 'leg' ? 0.85 : -0.95;
  return LINE_AT_CREASE[delivery.line] ?? 0;
}

/** Ball position over time (seconds since release) for a delivery. */
function deliveryPath(delivery) {
  const T = delivery.travelMs / 1000;
  const zb = BOUNCE_Z[delivery.length] ?? BOUNCE_Z.good;
  const hA = ARRIVE_H[delivery.length] ?? ARRIVE_H.good;
  const xA = lineX(delivery);
  const vz = (RELEASE.z - CREASE_Z) / T;
  const tb = (RELEASE.z - zb) / vz;
  const tA = T - tb;
  const vUp = (hA + 4.9 * tA * tA) / tA;
  const path = (t) => {
    const z = RELEASE.z - vz * t;
    let y;
    if (t < tb) {
      const u = t / tb;
      y = RELEASE.y * (1 - u) * (1 + 0.35 * u);
    } else {
      const s = t - tb;
      y = Math.max(0.03, vUp * s - 4.9 * s * s);
    }
    return { x: lerp(RELEASE.x, xA, t / T), y, z };
  };
  path.vz = vz;
  path.T = T;
  path.bounce = { x: lerp(RELEASE.x, xA, tb / T), z: zb };
  return path;
}

/**
 * @param {HTMLElement} host
 * @returns scene API, see the return statement.
 */
export function createScene(host) {
  const root = svg('svg', { class: 'sc', viewBox: '100 8 200 252', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });
  host.prepend(root);
  buildDefs(root);

  // ---- Pitch cam ----
  const pitchCam = svg('g', { class: 'sc-cam' }, root);
  drawPitchCamBackground(pitchCam);
  const markerLayer = svg('g', {}, pitchCam);
  const marker = svg('ellipse', { class: 'sc-marker', fill: 'rgba(255,210,63,0.28)', stroke: '#ffd23f', 'stroke-width': 1.4 }, markerLayer);
  const farLayer = svg('g', {}, pitchCam);
  const farStumps = makeStumps(pitchCam, 0);
  const ballBehind = svg('g', {}, pitchCam);
  const batterLayer = svg('g', {}, pitchCam);
  const ballFront = svg('g', {}, pitchCam);
  makeStumps(pitchCam, 20.12);
  const nearLayer = svg('g', {}, pitchCam);

  const ballG = svg('g', {}, ballFront);
  const ballShadow = svg('ellipse', { fill: 'rgba(0,0,0,0.35)' }, ballG);
  const ballEl = svg('circle', { fill: 'url(#sc-ball)', stroke: '#5a0a10', 'stroke-width': 0.4 }, ballG);

  // ---- Field cam ----
  const fieldCam = svg('g', { class: 'sc-cam sc-off' }, root);
  drawFieldCamBackground(fieldCam);
  const fieldStumps = [STRIKER_END, BOWLER_END].map((Y) => {
    const [x, y] = fpos(0, Y);
    return svg('rect', { x: x - 2, y: y - 1, width: 4, height: 2, fill: '#f5f0e1' }, fieldCam);
  });
  const fieldersG = svg('g', {}, fieldCam);
  const runnersG = svg('g', {}, fieldCam);
  const fTrail = svg('line', { stroke: 'rgba(255,255,255,0.5)', 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-dasharray': '2 3' }, fieldCam);
  const fBallShadow = svg('ellipse', { fill: 'rgba(0,0,0,0.35)', rx: 2.6, ry: 1.5 }, fieldCam);
  const fBall = svg('circle', { r: 3, fill: 'url(#sc-ball)', stroke: '#fff', 'stroke-width': 0.6 }, fieldCam);

  // ---- Actors (rebuilt each ball so kits follow the batting side) ----
  let batter = null;
  let bowler = null;
  let keeper = null;
  let umpire = null;
  let slips = [];
  let fielders = [];
  let runners = [];
  let keeperZ = -11;
  let batterPose = { ...STANCE };
  let bowlerPos = { ...RUN_START };

  // ---- Animation loop ----
  const tracks = new Map();
  let alive = true;
  let raf = 0;
  let eventId = 0;
  const loop = (now) => {
    if (!alive) return;
    for (const [key, fn] of tracks) if (fn(now) === false) tracks.delete(key);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const track = (key, fn) => {
    tracks.set(key, fn);
    fn(performance.now());
  };
  const at = (ms, fn) => {
    const due = performance.now() + ms;
    tracks.set(`ev${++eventId}`, (now) => {
      if (now < due) return true;
      fn(now);
      return false;
    });
  };

  // ---- Drawing helpers ----
  function placePerson(fig, x, z) {
    const [sx, sy, s] = project(x, 0, z);
    fig.place(sx, sy, s);
  }

  function drawBall(p) {
    const [sx, sy, s] = project(p.x, p.y, p.z);
    const [gx, gy] = project(p.x, 0, p.z);
    const r = Math.max(1.5, 0.036 * s * 1.7);
    set(ballEl, { cx: sx, cy: sy, r });
    set(ballShadow, { cx: gx, cy: gy, rx: r * 1.1, ry: r * 0.45, opacity: Math.max(0.15, 1 - p.y / 3) });
    const parent = p.z < BATTER.z + 0.05 ? ballBehind : ballFront;
    if (ballG.parentNode !== parent) parent.append(ballG);
    ballG.setAttribute('visibility', 'visible');
  }
  function hideBall() {
    ballG.setAttribute('visibility', 'hidden');
  }

  function setBatter(p) {
    batterPose = { ...batterPose, ...p };
    batter.pose(batterPose);
  }

  // Pose the batter through ms-based keyframes from the current pose.
  function animateBatter(frames) {
    const start = performance.now();
    const from = { ms: 0, ...batterPose };
    const all = [from, ...frames];
    track('batter', (now) => {
      const ms = now - start;
      let i = 1;
      while (i < all.length - 1 && ms > all[i].ms) i++;
      const a = all[i - 1];
      const b = all[i];
      const u = easeInOut(clamp01((ms - a.ms) / Math.max(1, b.ms - a.ms)));
      setBatter({ a: lerp(a.a, b.a, u), lean: lerp(a.lean, b.lean, u), stride: lerp(a.stride, b.stride, u), crouch: lerp(a.crouch, b.crouch, u) });
      return ms < all[all.length - 1].ms;
    });
  }

  function personTween(key, fig, from, to, ms, extra = () => ({})) {
    const start = performance.now();
    track(key, (now) => {
      const u = easeInOut(clamp01((now - start) / ms));
      const p = {};
      for (const k of Object.keys(to)) p[k] = lerp(from[k] ?? 0, to[k], u);
      fig.pose({ ...p, ...extra(u) });
      return u < 1;
    });
  }

  function setCam(which) {
    pitchCam.classList.toggle('sc-off', which !== 'pitch');
    fieldCam.classList.toggle('sc-off', which !== 'field');
  }

  // ---- Public: set up for a new ball ----
  function newBall({ batColors, bowlColors, spinner }) {
    for (const key of [...tracks.keys()]) tracks.delete(key);
    setCam('pitch');
    hideBall();
    hideFieldBall();
    marker.setAttribute('visibility', 'hidden');
    farStumps.reset();
    fieldStumps.forEach((s) => s.setAttribute('fill', '#f5f0e1'));

    const batKit = { shirt: batColors.primary, trousers: shade(batColors.primary, -0.45), cap: shade(batColors.primary, -0.25), trim: batColors.secondary };
    const bowlKit = { shirt: bowlColors.primary, trousers: shade(bowlColors.primary, -0.45), cap: bowlColors.secondary, trim: bowlColors.secondary };

    farLayer.replaceChildren();
    batterLayer.replaceChildren();
    nearLayer.replaceChildren();
    keeperZ = spinner ? -1.4 : -11;
    slips = spinner ? [] : [[-1.7, -12], [-2.8, -12.4]].map(([x, z]) => {
      const f = createPerson(farLayer, { ...bowlKit, view: 'front' });
      placePerson(f, x, z);
      f.pose({ crouch: 0.8, armL: -25, armR: 25 });
      return f;
    });
    keeper = createPerson(farLayer, { ...bowlKit, view: 'front', gloves: '#f4f4ee' });
    placePerson(keeper, spinner ? -0.15 : -0.25, keeperZ);
    keeper.pose({ crouch: 1, armL: -25, armR: 25 });

    batter = createBatter(batterLayer, { shirt: batKit.shirt, trousers: batKit.trousers, helmet: batKit.cap });
    placePerson(batter, BATTER.x, BATTER.z);
    batterPose = { ...STANCE };
    batter.pose(batterPose);
    const idleStart = performance.now();
    track('batter', (now) => {
      const t = (now - idleStart) / 1000;
      setBatter({ a: STANCE.a + Math.max(0, Math.sin(t * 5)) * 8 });
      return true;
    });

    const nonStriker = createPerson(nearLayer, { ...batKit, view: 'back', bat: true });
    placePerson(nonStriker, NON_STRIKER.x, NON_STRIKER.z);
    nonStriker.pose({ armR: 8, armL: -10 });
    umpire = createPerson(nearLayer, { shirt: '#f4f4ee', trousers: '#262626', cap: '#f4f4ee', view: 'back', hat: true });
    placePerson(umpire, UMPIRE.x, UMPIRE.z);
    umpire.pose({});
    bowler = createPerson(nearLayer, { ...bowlKit, view: 'back' });
    bowlerPos = { ...RUN_START };
    placeBowler();
    bowler.pose({});
    bowler.holdBall(true);

    // Field cam tokens.
    fieldersG.replaceChildren();
    runnersG.replaceChildren();
    fielders = FIELD.map(([ang, r]) => token(fieldersG, bowlKit.shirt, fromStriker(ang, r)));
    fielders.push(token(fieldersG, bowlKit.shirt, [0, STRIKER_END - (spinner ? 2 : 12)]));
    fielders.push(token(fieldersG, bowlKit.shirt, [-2, BOWLER_END + 6]));
    runners = [token(runnersG, batKit.shirt, [1.2, STRIKER_END + 1.6], true), token(runnersG, batKit.shirt, [-1.2, BOWLER_END - 1.6], true)];
  }

  function placeBowler() {
    placePerson(bowler, bowlerPos.x, bowlerPos.z);
    // The bowler passes the umpire: draw whichever is nearer the camera on top.
    const want = bowlerPos.z > UMPIRE.z ? null : umpire.g;
    if (want) {
      if (bowler.g.nextSibling !== want) nearLayer.insertBefore(bowler.g, want);
    } else if (nearLayer.lastChild !== bowler.g) nearLayer.append(bowler.g);
  }

  function setMarker(delivery) {
    const path = deliveryPath(delivery);
    const [sx, sy, s] = project(path.bounce.x, 0, path.bounce.z);
    set(marker, { cx: sx, cy: sy, rx: 0.24 * s, ry: 0.09 * s, visibility: 'visible' });
  }
  function hideMarker() {
    marker.setAttribute('visibility', 'hidden');
  }

  // Run-up over ms; the ball leaves the hand at the end.
  function runUp(ms) {
    const start = performance.now();
    track('bowler', (now) => {
      const u = clamp01((now - start) / ms);
      let pos;
      let pose;
      if (u < 0.72) {
        const v = u / 0.72;
        pos = { x: lerp(RUN_START.x, BOUND_AT.x, v), z: lerp(RUN_START.z, BOUND_AT.z, v) };
        pose = { run: (now - start) / 1000 * Math.PI * 2 * 2.6, runAmt: Math.min(1, v * 4), lean: 0.3 };
      } else if (u < 0.86) {
        const v = (u - 0.72) / 0.14;
        pos = { x: lerp(BOUND_AT.x, DELIVERY_STRIDE.x, v * 0.5), z: lerp(BOUND_AT.z, DELIVERY_STRIDE.z, v * 0.5) };
        pose = { bound: Math.sin(Math.PI * v) * 0.35, armL: lerp(-12, 165, v), armR: lerp(12, 35, v), lean: 0.1 };
      } else {
        const v = (u - 0.86) / 0.14;
        pos = { x: lerp(BOUND_AT.x, DELIVERY_STRIDE.x, 0.5 + v * 0.5), z: lerp(BOUND_AT.z, DELIVERY_STRIDE.z, 0.5 + v * 0.5) };
        pose = { armL: lerp(165, 60, v), armR: lerp(35, -195, easeInOut(v)), spread: 0.12 * v, lean: 0.2 * v };
      }
      bowlerPos = pos;
      placeBowler();
      bowler.pose(pose);
      return u < 1;
    });
  }

  function followThrough() {
    bowler.holdBall(false);
    const start = performance.now();
    const ms = 750;
    track('bowler', (now) => {
      const u = clamp01((now - start) / ms);
      const e = easeOut(u);
      bowlerPos = { x: lerp(DELIVERY_STRIDE.x, FOLLOW_END.x, e), z: lerp(DELIVERY_STRIDE.z, FOLLOW_END.z, e) };
      placeBowler();
      bowler.pose({
        armR: lerp(-195, -330, easeOut(clamp01(u * 2.5))),
        armL: lerp(60, -20, clamp01(u * 2)),
        run: (now - start) / 1000 * Math.PI * 2 * 2,
        runAmt: 0.8 * (1 - u),
        lean: 0.35 * (1 - u),
      });
      return u < 1;
    });
  }

  // ---- Ball in flight ----
  let flight = null;

  /**
   * Bowl the ball. opts.pre: a BallResult known in advance (the AI's ball, or
   * what a leave would do) so the ball heads for the stumps or pad when it
   * should. opts.swing: {shot, atMs} plays the batter's shot at that time.
   */
  function release(delivery, { pre = null, swing = null } = {}) {
    hideMarker();
    followThrough();
    const path = deliveryPath(delivery);
    const start = performance.now();
    const arriveAt = start + delivery.travelMs;
    let target = null;
    if (pre?.wicket?.kind === 'bowled') target = 'stumps';
    else if (pre?.wicket?.kind === 'lbw') target = 'pad';
    flight = { path, start, arriveAt, delivery, swung: false };
    animateBatter([{ ms: 300, ...BACKLIFT }]);
    if (swing) at(Math.max(0, swing.atMs - 70), () => swingBat(swing.shot));
    // Without a shot by now, the batter shoulders arms.
    at(delivery.travelMs - 90, () => {
      if (!flight.swung) {
        flight.swung = true;
        animateBatter(SWINGS.leave);
      }
    });
    track('ball', (now) => {
      const t = (now - start) / 1000;
      let p = path(t);
      if (target && t > path.T) {
        p = towards(path(path.T), target, (t - path.T) * path.vz);
        if (p.arrived) {
          impact(target);
          drawBall(p);
          return false;
        }
      }
      if (p.z <= keeperZ + 0.4) {
        keeperTake();
        return false;
      }
      drawBall(p);
      return true;
    });
  }

  // Move from p toward the stumps or pad by dist metres.
  function towards(p, target, dist) {
    const goal = target === 'stumps' ? { x: 0, y: 0.35, z: 0 } : { x: BATTER.x - 0.22, y: 0.42, z: BATTER.z + 0.1 };
    const dx = goal.x - p.x;
    const dy = goal.y - p.y;
    const dz = goal.z - p.z;
    const len = Math.hypot(dx, dy, dz);
    if (len <= dist || len < 0.01) return { ...goal, arrived: true };
    const k = dist / len;
    return { x: p.x + dx * k, y: p.y + dy * k, z: p.z + dz * k, arrived: false };
  }

  function impact(target) {
    if (target === 'stumps') breakStumps();
  }

  function keeperTake() {
    hideBall();
    personTween('keeper', keeper, { crouch: 1, armL: -25, armR: 25 }, { crouch: 0.45, armL: -150, armR: 150 }, 220);
  }

  function breakStumps() {
    if (farStumps.broken) return;
    farStumps.break(track);
  }

  function currentBallPos() {
    if (!flight) return { x: 0, y: 0.5, z: CREASE_Z };
    return flight.path((performance.now() - flight.start) / 1000);
  }

  function swingBat(shot) {
    if (!batter) return;
    if (flight) flight.swung = true;
    animateBatter(SWINGS[shot] ?? SWINGS.defend);
  }

  // ---- Outcome ----
  /**
   * Act out a ball. Returns {flashAt, total} in ms from now: when to show the
   * result banner and when the animation has finished.
   */
  function outcome(ball) {
    const now = performance.now();
    const wait = flight ? Math.max(0, flight.arriveAt - now - 20) : 0;
    const kind = ball.wicket?.kind ?? null;
    const shot = ball.shot ?? 'leave';
    const played = shot !== 'leave' && ball.extra?.type !== 'wide';
    const clean = ball.timing === 'perfect' || ball.timing === 'good';
    let plan;

    if (ball.extra?.type === 'wide') plan = { flashAt: 350, total: 900, signal: 'wide' };
    else if (kind === 'bowled') plan = toTarget('stumps', 0);
    else if (kind === 'lbw') plan = toTarget('pad', 450);
    else if (kind === 'caught' && (!played || !clean || shot === 'defend')) plan = edgeToKeeper();
    else if (kind === 'caught' || kind === 'runout' || ball.runs > 0) plan = fieldPlay(ball, shot, kind, wait);
    else if (played && ball.timing !== 'miss') plan = dotHit(shot);
    else plan = { flashAt: 300, total: 700 };

    if (plan.signal) at(wait + plan.flashAt - 100, () => signal(plan.signal));
    if (ball.extra?.type === 'noball') at(wait + 150, () => signal('noball'));
    if (kind && kind !== 'bowled' && kind !== 'runout') at(wait + plan.flashAt + 150, () => signal('out'));
    return { flashAt: wait + plan.flashAt, total: wait + plan.total + (kind && kind !== 'bowled' ? 500 : 0) };

    // Ball runs on to the stumps or pad from wherever it is.
    function toTarget(target, signalDelay) {
      const goal = target === 'stumps' ? { x: 0, z: 0 } : { x: BATTER.x, z: BATTER.z };
      const vz = flight?.path.vz ?? 25;
      const gap = (p) => Math.hypot(p.z - goal.z, p.x - goal.x);
      const startPos = wait > 0 && flight ? flight.path(flight.path.T) : currentBallPos();
      const ms = Math.max(30, (gap(startPos) / vz) * 1000);
      const start = performance.now() + wait;
      let anchor = null;
      track('ball', (t) => {
        if (t < start) {
          drawBall(currentBallPos());
          return true;
        }
        anchor ??= currentBallPos();
        const p = towards(anchor, target, ((t - start) / ms) * gap(anchor) + 0.01);
        drawBall(p);
        if (p.arrived) {
          if (target === 'stumps') breakStumps();
          else dropFromPad(p);
          return false;
        }
        return true;
      });
      return { flashAt: ms + signalDelay, total: ms + 700 };
    }

    function edgeToKeeper() {
      const start = performance.now() + wait;
      const from = () => currentBallPos();
      let anchor = null;
      const goal = { x: -0.25, y: 0.7, z: keeperZ + 0.4 };
      const ms = 260;
      track('ball', (t) => {
        if (t < start) {
          drawBall(from());
          return true;
        }
        anchor ??= from();
        const u = clamp01((t - start) / ms);
        drawBall({ x: lerp(anchor.x, goal.x, u), y: lerp(anchor.y, goal.y, u) + Math.sin(Math.PI * u) * 0.3, z: lerp(anchor.z, goal.z, u) });
        if (u >= 1) {
          keeperTake();
          return false;
        }
        return true;
      });
      return { flashAt: 320, total: 900 };
    }

    // A shot that doesn't score: the ball dribbles back down the pitch.
    function dotHit(s) {
      const start = performance.now() + wait;
      let anchor = null;
      const reach = s === 'defend' ? rand(3, 7) : rand(8, 14);
      const goal = { x: rand(-2.5, 2.5) + (s === 'cut' ? -4 : s === 'pull' ? 4 : 0), y: 0, z: CREASE_Z + reach };
      const ms = 650;
      track('ball', (t) => {
        if (t < start) {
          drawBall(currentBallPos());
          return true;
        }
        anchor ??= { ...currentBallPos(), z: Math.max(CREASE_Z, currentBallPos().z) };
        const u = easeOut(clamp01((t - start) / ms));
        drawBall({ x: lerp(anchor.x, goal.x, u), y: Math.max(0.03, lerp(anchor.y, 0, Math.min(1, u * 3)) + Math.abs(Math.sin(u * Math.PI * 2)) * 0.15 * (1 - u)), z: lerp(anchor.z, goal.z, u) });
        return t - start < ms;
      });
      return { flashAt: 300, total: 900 };
    }

    function dropFromPad(p) {
      const start = performance.now();
      track('ball', (t) => {
        const u = clamp01((t - start) / 350);
        drawBall({ x: p.x - 0.1 * u, y: Math.max(0.03, p.y * (1 - u * u)), z: p.z + 0.6 * u });
        return u < 1;
      });
    }
  }

  // The ball goes into the field: switch to the top-down view.
  function fieldPlay(ball, shot, kind, wait) {
    const runs = ball.runs;
    const [lo, hi] = SHOT_ANGLES[shot] ?? SHOT_ANGLES.drive;
    let ang = rand(lo, hi);
    if (!kind && runs > 0 && runs < 4 && ball.timing === 'late' && Math.random() < 0.5) ang = rand(-160, -125);
    if (!kind && runs > 0 && runs < 4 && ball.timing === 'early' && Math.random() < 0.5) ang = rand(125, 160);

    let dist;
    let air = 0;
    let ms;
    if (kind === 'caught') {
      dist = { loft: rand(45, 58), pull: rand(30, 45), drive: rand(22, 35), cut: rand(18, 28) }[shot] ?? 30;
      air = dist * 0.45;
      ms = 1250;
    } else if (kind === 'runout') {
      dist = rand(14, 22);
      ms = 550;
    } else if (runs === 6) {
      dist = toRope(ang) + rand(10, 22);
      air = 24;
      ms = 1400;
    } else if (runs === 4) {
      dist = toRope(ang) - 0.5;
      ms = 1150;
    } else {
      dist = [0, rand(16, 26), rand(30, 42), rand(46, 54)][runs] ?? 20;
      ms = 650 + runs * 120;
    }
    const startPt = [0.6, STRIKER_END + 1.4];
    const endPt = fromStriker(ang, dist);
    const [tx, ty] = fpos(...startPt);
    set(fTrail, { x1: tx, y1: ty, x2: tx, y2: ty });
    const t0 = performance.now() + wait;

    // Pitch cam for a moment as the ball leaves the bat, then cut to the field.
    const hitStart = currentBallPos();
    const dirX = Math.sin((ang * Math.PI) / 180);
    let anchor = null;
    track('ball', (t) => {
      if (t < t0) {
        drawBall(currentBallPos());
        return true;
      }
      anchor ??= { ...hitStart, z: Math.max(CREASE_Z, currentBallPos().z) };
      const u = clamp01((t - t0) / 220);
      drawBall({ x: anchor.x + dirX * 6 * u, y: anchor.y + (air ? 3.5 : 0.4) * u, z: anchor.z + Math.cos((ang * Math.PI) / 180) * 10 * u });
      return u < 1;
    });

    // Nearest fielder (not the keeper on a boundary) chases or takes the catch.
    let chaser = null;
    let best = Infinity;
    for (const f of fielders) {
      const d = Math.hypot(f.pos[0] - endPt[0], f.pos[1] - endPt[1]);
      if (d < best) [best, chaser] = [d, f];
    }
    const fielderGoal = kind === 'caught' ? endPt : runs >= 4 ? lerpPt(chaser.pos, endPt, 0.6) : endPt;

    at(wait + 200, () => setCam('field'));
    const flightStart = t0 + 220;
    tracks.set('fball', (t) => {
      if (t < flightStart) return true;
      const u = clamp01((t - flightStart) / ms);
      const e = air ? u : easeOut(u);
      const X = lerp(startPt[0], endPt[0], e);
      const Y = lerp(startPt[1], endPt[1], e);
      drawFieldBall(X, Y, air * Math.sin(Math.PI * u));
      return u < 1;
    });
    moveToken('chaser', chaser, fielderGoal, flightStart, ms * (kind === 'caught' ? 0.95 : 0.9));

    const done = flightStart - performance.now() + ms;
    let total = done + 300;
    let flashAt = done;
    if (runs >= 1 && runs <= 3) {
      // Batters run; the fielder returns the ball to the keeper.
      runBetween(runs, flightStart);
      const throwAt = flightStart + ms + 150;
      const keeperPt = [0, STRIKER_END - 1.5];
      tracks.set('throw', (t) => {
        if (t < throwAt) return true;
        const u = clamp01((t - throwAt) / 500);
        drawFieldBall(lerp(endPt[0], keeperPt[0], u), lerp(endPt[1], keeperPt[1], u), Math.sin(Math.PI * u) * 4);
        return u < 1;
      });
      total = Math.max(done + 650, flightStart - performance.now() + runs * 620 + 200);
      flashAt = total - 200;
    } else if (kind === 'runout') {
      runBetween(1, flightStart, 0.75);
      const throwAt = flightStart + ms + 120;
      const stumpsPt = [0, BOWLER_END];
      tracks.set('throw', (t) => {
        if (t < throwAt) return true;
        const u = clamp01((t - throwAt) / 380);
        drawFieldBall(lerp(endPt[0], stumpsPt[0], u), lerp(endPt[1], stumpsPt[1], u), Math.sin(Math.PI * u) * 2);
        if (u >= 1) fieldStumps[1].setAttribute('fill', '#ff5a4f');
        return u < 1;
      });
      flashAt = throwAt - performance.now() + 400;
      total = flashAt + 300;
    }
    return { flashAt, total };
  }

  function runBetween(runs, startAt, stopShort = 1) {
    const legMs = 620;
    const [a, b] = runners;
    const aFrom = [...a.pos];
    const bFrom = [...b.pos];
    tracks.set('runners', (t) => {
      if (t < startAt) return true;
      const legs = (t - startAt) / legMs;
      const done = Math.min(legs, runs * stopShort);
      const leg = Math.floor(Math.min(done, runs - 0.0001));
      const u = easeInOut(done - leg);
      const there = (from, other, n) => (n % 2 === 0 ? [from, other] : [other, from]);
      const [aS, aE] = there(aFrom, bFrom, leg);
      const [bS, bE] = there(bFrom, aFrom, leg);
      setToken(a, [lerp(aS[0], aE[0], u) + 1.5 * Math.sign(aFrom[0]), lerp(aS[1], aE[1], u)]);
      setToken(b, [lerp(bS[0], bE[0], u) + 1.5 * Math.sign(bFrom[0]), lerp(bS[1], bE[1], u)]);
      return legs < runs * stopShort;
    });
  }

  function moveToken(key, tok, goal, startAt, ms) {
    const from = [...tok.pos];
    tracks.set(key, (t) => {
      if (t < startAt) return true;
      const u = easeOut(clamp01((t - startAt) / ms));
      setToken(tok, [lerp(from[0], goal[0], u), lerp(from[1], goal[1], u)]);
      return u < 1;
    });
  }

  function drawFieldBall(X, Y, h) {
    const [x, y] = fpos(X, Y);
    const k = 1 + h / 10;
    set(fBall, { cx: x, cy: y - h * 0.9, r: 3 * k, visibility: 'visible' });
    set(fBallShadow, { cx: x, cy: y, visibility: 'visible' });
    set(fTrail, { x2: x, y2: y, visibility: 'visible' });
  }

  function signal(kind) {
    if (!umpire) return;
    const poses = {
      out: { armR: -178, armL: -10 },
      wide: { armR: -90, armL: 90 },
      noball: { armR: -90, armL: -10 },
    };
    const to = poses[kind];
    if (!to) return;
    personTween('umpire', umpire, { armR: 12, armL: -12 }, to, 250);
  }

  function destroy() {
    alive = false;
    cancelAnimationFrame(raf);
    tracks.clear();
    root.remove();
  }

  function hideFieldBall() {
    for (const node of [fBall, fBallShadow, fTrail]) node.setAttribute('visibility', 'hidden');
  }
  hideBall();
  hideFieldBall();

  // ---- Phase 3 API (SPEC 12.4). Stubs for now: they accept the new
  // arguments so play.js can be wired against them. ----
  let camMode = 'bowling';
  let batSide = 'R';
  let batOffset = 0;
  function setCamera(mode) {
    camMode = mode === 'batting' ? 'batting' : 'bowling';
  }
  function setBatterStance({ bats = 'R', offsetX = 0 } = {}) {
    batSide = bats === 'L' ? 'L' : 'R';
    batOffset = Math.max(-0.6, Math.min(0.6, offsetX));
  }
  function showAim(aim) {
    void aim;
  }
  function swing(shot, opts = {}) {
    void opts;
    swingBat(shot);
  }

  return { newBall, setMarker, hideMarker, runUp, release, swing, outcome, destroy, setCamera, setBatter: setBatterStance, showAim };

  // ---- Static drawing ----
  function makeStumps(parent, z) {
    const g = svg('g', {}, parent);
    const stumps = STUMP_X.map((x) => {
      const [x0, y0, s] = project(x, 0, z);
      const [, y1] = project(x, STUMP_H, z);
      return { el: svg('line', { x1: x0, y1: y0, x2: x0, y2: y1, stroke: '#f5f0e1', 'stroke-width': Math.max(1, 0.05 * s), 'stroke-linecap': 'round' }, g), base: [x0, y0] };
    });
    const bails = [[STUMP_X[0], STUMP_X[1]], [STUMP_X[1], STUMP_X[2]]].map(([a, b]) => {
      const [xa, y, s] = project(a, STUMP_H + 0.02, z);
      const [xb] = project(b, STUMP_H + 0.02, z);
      return svg('line', { x1: xa, y1: y, x2: xb, y2: y, stroke: '#e8d29a', 'stroke-width': Math.max(0.8, 0.035 * s), 'stroke-linecap': 'round' }, g);
    });
    const api = {
      broken: false,
      reset() {
        api.broken = false;
        stumps.forEach((s) => s.el.removeAttribute('transform'));
        bails.forEach((b) => b.removeAttribute('transform'));
      },
      break(trackFn) {
        api.broken = true;
        const start = performance.now();
        const tilt = [-28, 12, 30];
        const fly = [[-14, -26], [16, -22]];
        trackFn('stumps', (t) => {
          const u = clamp01((t - start) / 650);
          const e = easeOut(u);
          stumps.forEach((s, i) => s.el.setAttribute('transform', `rotate(${(tilt[i] * e).toFixed(1)} ${s.base[0].toFixed(1)} ${s.base[1].toFixed(1)})`));
          bails.forEach((b, i) => {
            const dx = fly[i][0] * u;
            const dy = fly[i][1] * u + 40 * u * u;
            b.setAttribute('transform', `translate(${dx.toFixed(1)} ${dy.toFixed(1)}) rotate(${(u * 400 * (i ? 1 : -1)).toFixed(0)} ${(project(0, STUMP_H, z)[0]).toFixed(1)} ${(project(0, STUMP_H, z)[1]).toFixed(1)})`);
          });
          return u < 1;
        });
      },
    };
    return api;
  }

  function token(parent, color, pos, batterToken = false) {
    const g = svg('g', {}, parent);
    svg('circle', { r: batterToken ? 4 : 4.4, fill: color, stroke: batterToken ? '#ffd23f' : '#fff', 'stroke-width': 1.2 }, g);
    const tok = { g, pos: [...pos] };
    setToken(tok, pos);
    return tok;
  }
  function setToken(tok, pos) {
    tok.pos = [...pos];
    const [x, y] = fpos(...pos);
    tok.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  }
}

function fromStriker(angDeg, r) {
  const a = (angDeg * Math.PI) / 180;
  return [Math.sin(a) * r, STRIKER_END + Math.cos(a) * r];
}

// Distance from the striker to the rope along an angle.
function toRope(angDeg) {
  const a = (angDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = Math.cos(a);
  // Solve |S + t d| = ROPE for t > 0, with S = (0, STRIKER_END).
  const b = STRIKER_END * dy;
  const c = STRIKER_END * STRIKER_END - ROPE * ROPE;
  return -b + Math.sqrt(b * b - c);
}

const lerpPt = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

function buildDefs(root) {
  const defs = svg('defs', {}, root);
  const grad = (id, stops, attrs = {}) => {
    const g = svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1, ...attrs }, defs);
    for (const [offset, color] of stops) svg('stop', { offset, 'stop-color': color }, g);
  };
  grad('sc-sky', [[0, '#0b1d33'], [1, '#2a4d6e']]);
  grad('sc-pitch', [[0, '#c9b483'], [1, '#d8c597']]);
  grad('sc-stand', [[0, 'rgba(5,10,20,0.9)'], [1, 'rgba(5,10,20,0.45)']]);
  const rg = svg('radialGradient', { id: 'sc-ball', cx: 0.35, cy: 0.35, r: 0.7 }, defs);
  svg('stop', { offset: 0, 'stop-color': '#ff8a80' }, rg);
  svg('stop', { offset: 0.6, 'stop-color': '#c1121f' }, rg);
  svg('stop', { offset: 1, 'stop-color': '#7a0c14' }, rg);
  const fg = svg('radialGradient', { id: 'sc-field', cx: 0.5, cy: 0.5, r: 0.5 }, defs);
  svg('stop', { offset: 0, 'stop-color': '#3a8a47' }, fg);
  svg('stop', { offset: 1, 'stop-color': '#256b33' }, fg);
  // Crowd: a tile of coloured dots.
  const crowd = svg('pattern', { id: 'sc-crowd', width: 7, height: 6, patternUnits: 'userSpaceOnUse' }, defs);
  svg('rect', { width: 7, height: 6, fill: '#1b2635' }, crowd);
  const dots = [[1.5, 1.5, '#e05a5a'], [5, 1.2, '#f2c14e'], [3.2, 4.2, '#7fb7e6'], [6.2, 4.8, '#f4f4ee'], [0.4, 4.6, '#9be07f']];
  for (const [cx, cy, fill] of dots) svg('circle', { cx, cy, r: 1.05, fill }, crowd);
  const clip = svg('clipPath', { id: 'sc-field-clip' }, defs);
  const [cx, cy] = fpos(0, 0);
  svg('circle', { cx, cy, r: ROPE * FS + 3 }, clip);
}

function drawPitchCamBackground(g) {
  svg('rect', { x: -2000, y: -2000, width: 4400, height: 2100, fill: 'url(#sc-sky)' }, g);
  const [, ropeY] = project(0, 0, -66);
  const [, boardTop] = project(0, 0.9, -67);
  // Stands, with floodlight glow on top.
  svg('rect', { x: -2000, y: -400, width: 4400, height: boardTop + 400, fill: 'url(#sc-crowd)' }, g);
  svg('rect', { x: -2000, y: -400, width: 4400, height: boardTop + 400, fill: 'url(#sc-stand)' }, g);
  // Advertising boards and the sightscreen behind the batter.
  const boardColors = ['#1f5fbf', '#d4213d', '#0f6b3a', '#f2b705'];
  for (let i = -14; i < 14; i++) {
    const [x0] = project(i * 8, 0, -67);
    const [x1] = project(i * 8 + 8, 0, -67);
    svg('rect', { x: x0, y: boardTop, width: x1 - x0, height: ropeY - boardTop, fill: boardColors[(i + 40) % 4] }, g);
  }
  const [sx0, sy0] = project(-3.5, 0, -68);
  const [sx1, sy1] = project(3.5, 3.6, -68);
  svg('rect', { x: sx0, y: sy1, width: sx1 - sx0, height: sy0 - sy1, fill: '#dfe6e3' }, g);

  // Outfield with mowing stripes.
  svg('rect', { x: -2000, y: ropeY, width: 4400, height: 2000, fill: '#2f7d3c' }, g);
  for (let z = -66, i = 0; z < 34; z += 5, i++) {
    if (i % 2) continue;
    const a = project(-120, 0, z);
    const b = project(120, 0, z);
    const c = project(120, 0, Math.min(34, z + 5));
    const d = project(-120, 0, Math.min(34, z + 5));
    svg('polygon', { points: pts([a, b, c, d]), fill: '#36883f' }, g);
  }
  svg('line', { x1: -2000, y1: ropeY, x2: 2400, y2: ropeY, stroke: '#f4f4ee', 'stroke-width': 1 }, g);

  // Thirty-yard circle.
  const ring = [];
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    ring.push(project(Math.sin(a) * 27.4, 0, 10.06 + Math.cos(a) * 27.4));
  }
  svg('polyline', { points: pts(ring), fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 0.8, 'stroke-dasharray': '3 3' }, g);

  // The pitch, creases and footmarks.
  const corners = [project(-1.52, 0, -1.2), project(1.52, 0, -1.2), project(1.52, 0, 21.3), project(-1.52, 0, 21.3)];
  svg('polygon', { points: pts(corners), fill: 'url(#sc-pitch)' }, g);
  for (const zc of [3.5, 16.6]) {
    const [x, y, s] = project(0, 0, zc);
    svg('ellipse', { cx: x, cy: y, rx: 0.9 * s, ry: 0.35 * s, fill: 'rgba(120,90,50,0.18)' }, g);
  }
  const line = (x0, z0, x1, z1) => {
    const [a, b] = [project(x0, 0, z0), project(x1, 0, z1)];
    svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'rgba(255,255,255,0.9)', 'stroke-width': Math.max(0.6, 0.05 * a[2]) }, g);
  };
  for (const [bz, pz, dir] of [[0, CREASE_Z, 1], [20.12, 20.12 - CREASE_Z, -1]]) {
    line(-1.83, pz, 1.83, pz);
    line(-1.32, bz, 1.32, bz);
    line(-1.32, bz - dir * 1.2, -1.32, pz);
    line(1.32, bz - dir * 1.2, 1.32, pz);
  }
}

function drawFieldCamBackground(g) {
  const [cx, cy] = fpos(0, 0);
  svg('rect', { x: -2000, y: -2000, width: 4400, height: 4400, fill: 'url(#sc-crowd)' }, g);
  svg('rect', { x: -2000, y: -2000, width: 4400, height: 4400, fill: 'rgba(5,10,20,0.7)' }, g);
  svg('circle', { cx, cy, r: (ROPE + 3) * FS, fill: '#1d2a3a' }, g);
  svg('circle', { cx, cy, r: (ROPE + 2) * FS, fill: 'url(#sc-field)' }, g);
  const stripes = svg('g', { 'clip-path': 'url(#sc-field-clip)' }, g);
  for (let i = -8; i < 8; i += 2) {
    const [x, y] = fpos(-80, i * 9);
    svg('rect', { x, y, width: 160 * FS, height: 9 * FS, fill: 'rgba(255,255,255,0.04)' }, stripes);
  }
  svg('circle', { cx, cy, r: ROPE * FS, fill: 'none', stroke: '#f4f4ee', 'stroke-width': 1.4 }, g);
  svg('circle', { cx, cy, r: 27.4 * FS, fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 0.8, 'stroke-dasharray': '3 3' }, g);
  const [px, py] = fpos(-1.52, -11.3);
  svg('rect', { x: px, y: py, width: 3.04 * FS, height: 22.6 * FS, fill: '#d2bf90', rx: 1 }, g);
}
