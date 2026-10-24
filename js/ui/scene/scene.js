// Match scene for the play screen: a broadcast-style pitch cam and a top-down
// ground view for where the ball goes (field cam). Purely visual: it never
// decides an outcome, it only acts out the BallResult the engine returns.
// Where the engine gives no direction or distance, cosmetic choices use
// Math.random, never the match rng.
import { svg, set, pts, lerp, clamp01, easeOut, easeInOut } from './svg.js';
import { createPerson, createBatter3D, yawLocal } from './figures.js';
import { getVenue } from '../../data/venues.js';

// ---- Pitch cam projection --------------------------------------------------
// World: x across the pitch (metres, + is the leg side of a right-hander),
// y up, z along the pitch from the striker's stumps (0) to the bowler's
// stumps (20.12). Two cameras:
//   bowling: behind the bowler with a long lens, like a TV broadcast.
//   batting: low behind the striker looking at the bowler, like EA Cricket
//            and Real Cricket. The view is turned round, so +x is screen left.
const VB_W = 400;
const VB_H = 300;
const CX = VB_W / 2;
const CAMS = {
  bowling: { z: 50, h: 4.2, focal: 1700, horizon: -30, dir: -1 },
  batting: { z: -11, h: 4.4, focal: 430, horizon: 50, dir: 1 },
};
let cam = CAMS.bowling;

function project(x, y, z) {
  const s = cam.focal / Math.max(0.5, cam.dir * (z - cam.z));
  return [CX - cam.dir * x * s, cam.horizon + (cam.h - y) * s, s];
}
const camDepth = (z) => cam.dir * (z - cam.z);

// ---- Venue and ball (SPEC 13.4, 13.5) ---------------------------------------
// Purely visual. setConditions picks the look; the background drawing and the
// shared gradients read it. Pink means a day-night match under floodlights.
const BALL_COLORS = {
  red: { light: '#ff8a80', mid: '#c1121f', dark: '#7a0c14', rim: '#5a0a10' },
  white: { light: '#ffffff', mid: '#f1eee6', dark: '#b8b2a3', rim: '#8a8577' },
  pink: { light: '#ffc2de', mid: '#ff4f9a', dark: '#a8205b', rim: '#6e1238' },
};
const DEFAULT_GROUND = { sky: '#9fcbe8', stands: ['#3b4a63', '#5b6b85', '#e9ecef'] };
let look = { night: false, ball: 'red', ...DEFAULT_GROUND };
let defStops = null;

const STUMP_X = [-0.114, 0, 0.114];
const STUMP_H = 0.71;
const CREASE_Z = 1.22;
// The striker's body stands this far to the leg side of middle stump.
const GUARD_X = 0.42;
const BATTER_Z = 0.95;
const MOVE_LIMIT = 0.6;
const RELEASE = { x: -0.25, y: 2.2, z: 19.4 };
const BOUNCE_Z = { yorker: 1.7, full: 3.6, good: 6.6, short: 10.2 };
const ARRIVE_H = { yorker: 0.12, full: 0.45, good: 0.85, short: 1.35 };
const LINE_AT_CREASE = { off: -0.17, middle: 0, leg: 0.15 };
// Half the pitch's width (3.05 m).
const PITCH_HALF_W = 1.52;
const UMPIRE = { x: 0.8, z: 22 };
const NON_STRIKER = { x: 1.35, z: 19.4 };
const RUN_START = { x: -0.8, z: 25.6 };
const BOUND_AT = { x: -0.55, z: 21.4 };
const DELIVERY_STRIDE = { x: -0.45, z: 19.9 };
const FOLLOW_END = { x: -1.7, z: 16.6 };

// ---- Field cam ---------------------------------------------------------
// Top-down and lined up with the pitch cam: with the bowling camera the
// striker is at the top; with the batting camera the view turns round so the
// striker is at the bottom. Field units are metres from the middle of the
// pitch, X positive on a right-hander's leg side.
const FS = 1.6;
const ROPE = 65;
let fieldFlip = 1;
const fpos = (X, Y) => [CX + X * FS * fieldFlip, VB_H / 2 + Y * FS * fieldFlip];
const STRIKER_END = -10.06;
const BOWLER_END = 10.06;
// Fielders as [angle, distance] from the striker. Angle 0 is straight back
// past the bowler, positive is the leg side, +-180 is behind the keeper.
const FIELD = [
  [-165, 13], [-95, 25], [-58, 28], [-18, 33], [18, 33], [62, 30], [100, 27], [152, 50], [-150, 50],
];
const SHOT_ANGLES = { defend: [-25, 25], drive: [-55, 15], loft: [-35, 35], pull: [60, 115], cut: [-120, -70], leave: [-10, 10] };

// Batting poses in the batter-local frame (see figures.js): hands position,
// bat direction from the hands to the toe, the way the bat face points, feet
// as [a, b], and body shape. Shot keyframes are ms from the swing call;
// contact is at about 70 ms.
const STANCE = {
  hands: [0.24, 0.8, 0.0], dir: [0.17, -0.98, -0.07], face: [0, 0, 1],
  front: [0, 0.3], back: [0, -0.12], crouch: 0.15, turn: 0, lean: 0.1, lift: [0, 0],
};
const BACKLIFT = {
  hands: [0.1, 1.15, -0.14], dir: [0.15, 0.55, -0.82], face: [0.6, 0, -0.3],
  front: [0, 0.34], back: [0, -0.12], crouch: 0.2, turn: 0.05, lean: 0.1, lift: [0, 0],
};
const pose = (o) => ({ ...STANCE, ...o });
const SWINGS = {
  defend: [
    { ms: 70, ...pose({ hands: [0.34, 0.78, 0.4], dir: [0.08, -0.98, 0.14], face: [0, 0.1, 1], front: [0.04, 0.62], crouch: 0.3, turn: 0.15, lean: 0.6 }) },
    { ms: 650, ...pose({ hands: [0.34, 0.78, 0.4], dir: [0.08, -0.98, 0.14], face: [0, 0.1, 1], front: [0.04, 0.62], crouch: 0.3, turn: 0.15, lean: 0.6 }) },
  ],
  drive: [
    { ms: 70, ...pose({ hands: [0.32, 0.72, 0.44], dir: [0.1, -0.97, 0.22], face: [0, 0.1, 1], front: [0.05, 0.66], crouch: 0.3, turn: 0.25, lean: 0.55 }) },
    { ms: 380, ...pose({ hands: [0.06, 1.5, 0.42], dir: [-0.3, 0.72, -0.62], face: [-0.2, 0.3, 1], front: [0.05, 0.66], crouch: 0.2, turn: 0.6, lean: 0.4 }) },
    { ms: 850, ...pose({ hands: [0.06, 1.5, 0.42], dir: [-0.3, 0.72, -0.62], face: [-0.2, 0.3, 1], front: [0.05, 0.66], crouch: 0.2, turn: 0.6, lean: 0.4 }) },
  ],
  loft: [
    { ms: 70, ...pose({ hands: [0.3, 0.82, 0.38], dir: [0.05, -0.88, 0.47], face: [0, 0.45, 1], front: [0.05, 0.55], crouch: 0.2, turn: 0.35, lean: 0.2 }) },
    { ms: 420, ...pose({ hands: [-0.04, 1.95, 0.18], dir: [-0.22, 0.42, -0.88], face: [0, 1, 0.2], front: [0.05, 0.55], crouch: 0.05, turn: 0.85, lean: -0.3 }) },
    { ms: 900, ...pose({ hands: [-0.04, 1.95, 0.18], dir: [-0.22, 0.42, -0.88], face: [0, 1, 0.2], front: [0.05, 0.55], crouch: 0.05, turn: 0.85, lean: -0.3 }) },
  ],
  pull: [
    { ms: 70, ...pose({ hands: [0.28, 1.15, 0.15], dir: [0.55, 0.05, 0.84], face: [-0.7, 0, 0.7], front: [0.06, 0.05], back: [0.14, -0.38], crouch: 0.1, turn: 0.7, lean: -0.1 }) },
    { ms: 400, ...pose({ hands: [-0.1, 1.25, -0.05], dir: [-0.75, 0.3, -0.6], face: [-0.3, 0, -1], front: [0.06, 0.05], back: [0.14, -0.38], crouch: 0.1, turn: 0.9, lean: -0.15 }) },
    { ms: 850, ...pose({ hands: [-0.1, 1.25, -0.05], dir: [-0.75, 0.3, -0.6], face: [-0.3, 0, -1], front: [0.06, 0.05], back: [0.14, -0.38], crouch: 0.1, turn: 0.9, lean: -0.15 }) },
  ],
  cut: [
    { ms: 70, ...pose({ hands: [0.45, 1.02, 0.02], dir: [0.82, -0.3, 0.48], face: [0.4, 0, -0.9], front: [0.04, 0.16], back: [0.18, -0.26], crouch: 0.3, turn: 0.2, lean: 0.25 }) },
    { ms: 380, ...pose({ hands: [0.42, 1.12, -0.22], dir: [0.55, 0.2, -0.81], face: [0.2, 0, -1], front: [0.04, 0.16], back: [0.18, -0.26], crouch: 0.3, turn: 0.25, lean: 0.25 }) },
    { ms: 850, ...pose({ hands: [0.42, 1.12, -0.22], dir: [0.55, 0.2, -0.81], face: [0.2, 0, -1], front: [0.04, 0.16], back: [0.18, -0.26], crouch: 0.3, turn: 0.25, lean: 0.25 }) },
  ],
  leave: [
    { ms: 160, ...pose({ hands: [-0.05, 1.45, -0.05], dir: [-0.15, 0.7, -0.7], face: [0, 0, 1], front: [0, 0.4], turn: 0.1, lean: -0.1 }) },
    { ms: 700, ...pose({ hands: [-0.05, 1.45, -0.05], dir: [-0.15, 0.7, -0.7], face: [0, 0, 1], front: [0, 0.4], turn: 0.1, lean: -0.1 }) },
  ],
};
// The direction each swing plays toward by default (batter-relative degrees).
const SWING_AIM = { defend: 0, drive: -20, loft: 0, pull: 80, cut: -85, leave: 0 };

function lerpPose(a, b, u) {
  const v = (p, q) => p.map((x, i) => lerp(x, q[i], u));
  return {
    hands: v(a.hands, b.hands), dir: v(a.dir, b.dir), face: v(a.face, b.face), front: v(a.front, b.front),
    back: v(a.back, b.back), lift: v(a.lift, b.lift), crouch: lerp(a.crouch, b.crouch, u), turn: lerp(a.turn, b.turn, u), lean: lerp(a.lean, b.lean, u),
  };
}

// Turn a swing toward the aimed direction: the bat path rotates about the
// batter, by part of the gap between the aim and the swing's own direction.
function aimSwing(frames, shot, aimDeg) {
  if (aimDeg == null) return frames;
  const delta = Math.max(-45, Math.min(45, (aimDeg - SWING_AIM[shot]) * 0.6));
  if (!delta) return frames;
  return frames.map((f) => ({ ...f, hands: yawLocal(f.hands, delta), dir: yawLocal(f.dir, delta), face: yawLocal(f.face, delta) }));
}

const rand = (a, b) => a + Math.random() * (b - a);

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch);
  return `rgb(${r},${g},${b})`;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** x position of a delivery at the batting crease. off = -1 for a right-hander, +1 for a left-hander. */
function lineX(delivery, off) {
  if (delivery.extra === 'wide') return delivery.line === 'leg' ? -0.85 * off : 0.95 * off;
  return -(LINE_AT_CREASE[delivery.line] ?? 0) * off;
}

// Arrival height at the batter for a bounce point z, between the presets.
function arriveHeight(zb) {
  const keys = ['yorker', 'full', 'good', 'short'];
  if (zb <= BOUNCE_Z.yorker) return ARRIVE_H.yorker;
  for (let i = 1; i < keys.length; i++) {
    const [a, b] = [keys[i - 1], keys[i]];
    if (zb <= BOUNCE_Z[b]) return lerp(ARRIVE_H[a], ARRIVE_H[b], (zb - BOUNCE_Z[a]) / (BOUNCE_Z[b] - BOUNCE_Z[a]));
  }
  return ARRIVE_H.short;
}

/**
 * Ball position over time (seconds since release) for a delivery.
 * delivery.pitch {x, z} (batter-relative, + toward leg) places the bounce;
 * without it the Line/Length presets do. delivery.swingX (batter-relative
 * metres between release and arrival) moves the ball: in the air for pace
 * (swing, a late curve onto the landing spot, then straight), after the
 * bounce for spin (turn). Slower balls just have a longer travelMs.
 * delivery.releaseX and delivery.arrivalX (SPEC 15) move the release point
 * and a button delivery's arrival; without them the v1.2 positions are used.
 * The ball stays on the pitch unless the engine called a wide.
 */
export function deliveryPath(delivery, off = -1) {
  const T = delivery.travelMs / 1000;
  const pitch = delivery.pitch && Number.isFinite(delivery.pitch.x) && Number.isFinite(delivery.pitch.z) ? delivery.pitch : null;
  const zb = pitch ? pitch.z : BOUNCE_Z[delivery.length] ?? BOUNCE_Z.good;
  const hA = pitch ? arriveHeight(zb) : ARRIVE_H[delivery.length] ?? ARRIVE_H.good;
  const vz = (RELEASE.z - CREASE_Z) / T;
  const tb = (RELEASE.z - zb) / vz;
  const tA = T - tb;
  const vUp = (hA + 4.9 * tA * tA) / tA;
  const sw = (Number(delivery.swingX) || 0) * -off;
  // releaseX (batter-relative) comes from over/around the wicket (SPEC 15.2).
  const X0 = Number.isFinite(delivery.releaseX) ? delivery.releaseX * -off : RELEASE.x;
  const edge = delivery.extra === 'wide' ? Infinity : PITCH_HALF_W;
  const keepOn = (x) => Math.max(-edge, Math.min(edge, x));
  let xp;
  let xA;
  if (pitch) {
    // Straight on through the landing spot, then the movement on top.
    xp = pitch.x * -off;
    xA = X0 + ((xp - X0) * T) / tb + sw;
  } else {
    // The preset line (or the engine's arrival point, which includes its
    // scatter) is where the ball ends up after any movement.
    xA = Number.isFinite(delivery.arrivalX) ? delivery.arrivalX * -off : lineX(delivery, off);
    xp = lerp(X0, xA - sw, tb / T);
  }
  xA = keepOn(xA);
  // Pace swing: a constant sideways pull toward sw, so the ball starts a
  // little the other way and curves late onto the spot. k sets how hard it
  // bends; the most it strays from the straight release-to-spot line is
  // k * |sw| / 4, kept within |sw|. Where it can, the curve leaves the bounce
  // heading the way the ball goes on to the batter.
  const turn = delivery.bowlType === 'spin' || (delivery.bowlType == null && !!delivery.spinner);
  const k = turn ? 0 : Math.min(4, tb / Math.max(tA, 1e-6));
  const path = (t) => {
    const z = RELEASE.z - vz * t;
    let x;
    let y;
    if (t < tb) {
      const u = t / tb;
      x = X0 + (xp - X0) * u + k * sw * (u * u - u);
      y = RELEASE.y * (1 - u) * (1 + 0.35 * u);
    } else {
      const s = t - tb;
      x = xp + ((xA - xp) * s) / tA;
      y = Math.max(0.03, vUp * s - 4.9 * s * s);
    }
    return { x: keepOn(x), y, z };
  };
  path.vz = vz;
  path.T = T;
  path.bounce = { x: xp, z: zb };
  return path;
}

/**
 * @param {HTMLElement} host
 * @returns scene API, see the return statement.
 */
export function createScene(host) {
  cam = CAMS.bowling;
  fieldFlip = 1;
  look = { night: false, ball: 'red', ...DEFAULT_GROUND };
  const root = svg('svg', { class: 'sc', viewBox: '100 8 200 252', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });
  host.prepend(root);
  buildDefs(root);

  // ---- Pitch cam ----
  // bg: rebuilt when the camera changes. actorLayer: people, stumps and the
  // ball, re-sorted every frame so nearer things paint over farther ones.
  const pitchCam = svg('g', { class: 'sc-cam' }, root);
  const bgLayer = svg('g', {}, pitchCam);
  const markerLayer = svg('g', {}, pitchCam);
  const marker = svg('ellipse', { class: 'sc-marker', fill: 'rgba(255,210,63,0.28)', stroke: '#ffd23f', 'stroke-width': 1.4 }, markerLayer);
  const guardMark = svg('line', { stroke: '#ffd23f', 'stroke-linecap': 'round' }, markerLayer);
  const actorLayer = svg('g', {}, pitchCam);
  const aimLayer = svg('g', { class: 'sc-aim' }, pitchCam);
  const aimPath = svg('polyline', { fill: 'none', stroke: '#ffd23f', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, aimLayer);
  const aimHead = svg('polygon', { fill: '#ffd23f' }, aimLayer);
  aimLayer.setAttribute('visibility', 'hidden');
  // Night: the edges of the frame fall away into the dark.
  const nightShade = svg('rect', { x: -2000, y: -2000, width: 4400, height: 4400, fill: 'url(#sc-vignette)', 'pointer-events': 'none', visibility: 'hidden' }, pitchCam);

  const ballG = svg('g', {}, actorLayer);
  const ballShadow = svg('ellipse', { fill: 'rgba(0,0,0,0.35)' }, ballG);
  const ballEl = svg('circle', { fill: 'url(#sc-ball)', stroke: '#5a0a10', 'stroke-width': 0.4 }, ballG);
  const ballActor = { g: ballG, z: 10 };

  // ---- Field cam ----
  const fieldCam = svg('g', { class: 'sc-cam sc-off' }, root);
  const fieldBg = svg('g', {}, fieldCam);
  drawFieldCamBackground(fieldBg);
  const fieldStumps = [STRIKER_END, BOWLER_END].map(() => svg('rect', { width: 4, height: 2, fill: '#f5f0e1' }, fieldCam));
  const placeFieldStumps = () => [STRIKER_END, BOWLER_END].forEach((Y, i) => {
    const [x, y] = fpos(0, Y);
    set(fieldStumps[i], { x: x - 2, y: y - 1 });
  });
  placeFieldStumps();
  const fieldersG = svg('g', {}, fieldCam);
  const runnersG = svg('g', {}, fieldCam);
  // The hit line: the ball's path along the ground, or for an aerial shot its
  // flight (arc) with the shadow's track on the grass.
  const hitShadow = svg('polyline', { fill: 'none', stroke: 'rgba(0,0,0,0.35)', 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-dasharray': '2 3' }, fieldCam);
  const hitLine = svg('polyline', { fill: 'none', stroke: 'rgba(255,255,255,0.75)', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, fieldCam);
  const fBallShadow = svg('ellipse', { fill: 'rgba(0,0,0,0.35)', rx: 2.6, ry: 1.5 }, fieldCam);
  const fBall = svg('circle', { r: 3, fill: 'url(#sc-ball)', stroke: '#fff', 'stroke-width': 0.6 }, fieldCam);

  // ---- Actors (rebuilt each ball so kits follow the batting side) ----
  let batter = null;
  let bowler = null;
  let keeper = null;
  let umpire = null;
  let fielders = [];
  let runners = [];
  let keeperZ = -11;
  let bowlerPos = { ...RUN_START };
  let lastBallOpts = null;
  let actors = [];
  let strikerStumps = null;

  // Striker: handedness, guard offset (+ toward the leg side) and pose.
  let camMode = 'bowling';
  let batSide = 'R';
  let off = -1; // world x sign of the off side: -1 right-handed, +1 left-handed
  let batX = GUARD_X;
  let batOffset = 0;
  let batPose = { ...STANCE };

  // ---- Animation loop ----
  const tracks = new Map();
  let alive = true;
  let raf = 0;
  let eventId = 0;
  const loop = (now) => {
    if (!alive) return;
    for (const [key, fn] of tracks) if (fn(now) === false) tracks.delete(key);
    sortActors();
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

  // Paint actors far to near for the current camera.
  let paintOrder = [];
  function sortActors() {
    const list = actors.filter((a) => a.g.parentNode === actorLayer).sort((p, q) => camDepth(q.z) - camDepth(p.z));
    if (list.length === paintOrder.length && list.every((a, i) => a === paintOrder[i])) return;
    for (const a of list) actorLayer.append(a.g);
    paintOrder = list;
  }
  function addActor(g, z) {
    const a = { g, z };
    actors.push(a);
    return a;
  }

  // ---- Drawing helpers ----
  function placePerson(fig, x, z) {
    const [sx, sy, s] = project(x, 0, z);
    fig.place(sx, sy, s);
    if (fig.actor) fig.actor.z = z;
  }

  function drawBall(p) {
    const [sx, sy, s] = project(p.x, p.y, p.z);
    const [gx, gy] = project(p.x, 0, p.z);
    const r = Math.max(1.5, 0.036 * s * 1.7);
    set(ballEl, { cx: sx, cy: sy, r });
    set(ballShadow, { cx: gx, cy: gy, rx: r * 1.1, ry: r * 0.45, opacity: Math.max(0.15, 1 - p.y / 3) });
    ballActor.z = p.z;
    // In the batting camera the ball passes the lens behind the striker.
    const gone = camMode === 'batting' && p.z < cam.z + 2.5;
    ballG.setAttribute('visibility', gone ? 'hidden' : 'visible');
  }
  function hideBall() {
    ballG.setAttribute('visibility', 'hidden');
  }

  const camPos = () => [0, cam.h, cam.z];
  function drawBatter() {
    if (!batter) return;
    batter.draw({ x: batX, z: BATTER_Z, fx: off, pose: batPose }, project, camPos());
    batter.actor.z = BATTER_Z;
  }
  function setPose(p) {
    batPose = p;
    drawBatter();
  }
  // Where the bat is grounded at guard, on the popping crease.
  function drawGuardMark() {
    const gx = batX + off * 0.38;
    const [x0, y0, s] = project(gx, 0, CREASE_Z - 0.12);
    const [x1, y1] = project(gx, 0, CREASE_Z + 0.12);
    set(guardMark, { x1: x0, y1: y0, x2: x1, y2: y1, 'stroke-width': Math.max(1.2, 0.05 * s) });
  }

  // Pose the batter through ms-based keyframes from the current pose.
  function animateBatter(frames) {
    const start = performance.now();
    const all = [{ ms: 0, ...batPose }, ...frames];
    track('batter', (now) => {
      const ms = now - start;
      let i = 1;
      while (i < all.length - 1 && ms > all[i].ms) i++;
      const a = all[i - 1];
      const b = all[i];
      const u = easeInOut(clamp01((ms - a.ms) / Math.max(1, b.ms - a.ms)));
      setPose(lerpPose(a, b, u));
      return ms < all[all.length - 1].ms;
    });
  }

  function personTween(key, fig, from, to, ms, extra = () => ({})) {
    if (!fig) return;
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
  function newBall(opts) {
    lastBallOpts = opts;
    const { batColors, bowlColors, spinner } = opts;
    for (const key of [...tracks.keys()]) tracks.delete(key);
    setCam('pitch');
    hideBall();
    hideFieldBall();
    showAim(null);
    marker.setAttribute('visibility', 'hidden');
    fieldStumps.forEach((st) => st.setAttribute('fill', '#f5f0e1'));
    flight = null;

    const batKit = { shirt: batColors.primary, trousers: shade(batColors.primary, -0.45), cap: shade(batColors.primary, -0.25), trim: batColors.secondary };
    const bowlKit = { shirt: bowlColors.primary, trousers: shade(bowlColors.primary, -0.45), cap: bowlColors.secondary, trim: bowlColors.secondary };
    const batting = camMode === 'batting';
    // People who face the camera: front view, mirrored so their right arm is on screen left.
    const facing = (towardCamera) => (towardCamera ? { view: 'front', mirror: true } : { view: 'back' });

    actors = [];
    paintOrder = [];
    actorLayer.replaceChildren(ballG);
    actors.push(ballActor);
    strikerStumps = makeStumps(actorLayer, 0);
    addActor(strikerStumps.g, 0);
    addActor(makeStumps(actorLayer, 20.12).g, 20.12);

    const person = (kit, x, z, extra, poseArgs) => {
      const f = createPerson(actorLayer, { ...kit, ...extra });
      f.actor = addActor(f.g, z);
      placePerson(f, x, z);
      f.pose(poseArgs);
      return f;
    };

    // Keeper and slips sit right in front of the lens in the batting camera, so they are left out there.
    keeperZ = spinner ? -1.4 : -11;
    keeper = null;
    if (!batting) {
      if (!spinner) for (const [x, z] of [[-1.7, -12], [-2.8, -12.4]]) person(bowlKit, x * -off, z, { view: 'front' }, { crouch: 0.8, armL: -25, armR: 25 });
      keeper = person(bowlKit, (spinner ? 0.15 : 0.25) * off, keeperZ, { view: 'front', gloves: '#f4f4ee' }, { crouch: 1, armL: -25, armR: 25 });
    }

    batter = createBatter3D(actorLayer, { shirt: batKit.shirt, trousers: batKit.trousers, helmet: batKit.cap });
    batter.actor = addActor(batter.g, BATTER_Z);
    batX = -off * (GUARD_X + batOffset);
    batPose = { ...STANCE };
    drawBatter();
    drawGuardMark();
    const idleStart = performance.now();
    track('batter', (now) => {
      // A small tap of the bat while waiting.
      const t = (now - idleStart) / 1000;
      const tap = Math.max(0, Math.sin(t * 5)) * 0.06;
      setPose({ ...batPose, hands: [STANCE.hands[0], STANCE.hands[1] + tap, STANCE.hands[2]], dir: [STANCE.dir[0], STANCE.dir[1], STANCE.dir[2] - tap * 2] });
      return true;
    });

    person(batKit, NON_STRIKER.x * -off, NON_STRIKER.z, { ...facing(batting), bat: true }, { armR: 8, armL: -10 });
    umpire = person({ shirt: '#f4f4ee', trousers: '#262626', cap: '#f4f4ee' }, UMPIRE.x, UMPIRE.z, { ...facing(batting), hat: true }, {});
    bowler = person(bowlKit, RUN_START.x, RUN_START.z, facing(batting), {});
    bowlerPos = { ...RUN_START };
    placeBowler();
    bowler.holdBall(true);
    sortActors();

    // Field cam tokens.
    fieldersG.replaceChildren();
    runnersG.replaceChildren();
    fielders = FIELD.map(([ang, r]) => token(fieldersG, bowlKit.shirt, fromStriker(ang * -off, r)));
    fielders.push(token(fieldersG, bowlKit.shirt, [0, STRIKER_END - (spinner ? 2 : 12)]));
    fielders.push(token(fieldersG, bowlKit.shirt, [-2, BOWLER_END + 6]));
    runners = [token(runnersG, batKit.shirt, [1.2, STRIKER_END + 1.6], true), token(runnersG, batKit.shirt, [-1.2, BOWLER_END - 1.6], true)];
  }

  function placeBowler() {
    placePerson(bowler, bowlerPos.x, bowlerPos.z);
  }

  // The bowler's type decides swing (pace) or turn (spin) when the delivery doesn't say.
  const pathFor = (delivery) => deliveryPath({ spinner: !!lastBallOpts?.spinner, ...delivery }, off);

  function setMarker(delivery) {
    const path = pathFor(delivery);
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
   * should. opts.swing: {shot, atMs, aimDeg?, aerial?} plays the batter's
   * shot at that time.
   */
  function release(delivery, { pre = null, swing = null } = {}) {
    enableMarkerDrag(null);
    hideMarker();
    followThrough();
    const path = pathFor(delivery);
    const start = performance.now();
    const arriveAt = start + delivery.travelMs;
    let target = null;
    if (pre?.wicket?.kind === 'bowled') target = 'stumps';
    else if (pre?.wicket?.kind === 'lbw') target = 'pad';
    flight = { path, start, arriveAt, delivery, swung: false };
    animateBatter([{ ms: 300, ...BACKLIFT }]);
    if (swing) at(Math.max(0, swing.atMs - 70), () => swingBat(swing.shot, swing));
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
      if (p.z <= keeperZ + 0.4 || (camMode === 'batting' && p.z < cam.z + 2.5)) {
        keeperTake();
        return false;
      }
      drawBall(p);
      return true;
    });
  }

  // Move from p toward the stumps or pad by dist metres.
  function towards(p, target, dist) {
    const goal = target === 'stumps' ? { x: 0, y: 0.35, z: 0 } : padPoint();
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

  // Front pad of the striker, where an LBW ball strikes.
  function padPoint() {
    return { x: batX + off * 0.22, y: 0.42, z: BATTER_Z + 0.25 };
  }

  function keeperTake() {
    hideBall();
    personTween('keeper', keeper, { crouch: 1, armL: -25, armR: 25 }, { crouch: 0.45, armL: -150, armR: 150 }, 220);
  }

  function breakStumps() {
    if (!strikerStumps || strikerStumps.broken) return;
    strikerStumps.break(track);
  }

  function currentBallPos() {
    if (!flight) return { x: 0, y: 0.5, z: CREASE_Z };
    return flight.path((performance.now() - flight.start) / 1000);
  }

  // opts: { aimDeg, aerial }. An aerial shot always uses the lofted swing.
  function swingBat(shot, opts = {}) {
    if (!batter) return;
    if (flight) flight.swung = true;
    showAim(null);
    const kind = opts.aerial && shot !== 'defend' && shot !== 'leave' ? 'loft' : SWINGS[shot] ? shot : 'defend';
    animateBatter(aimSwing(SWINGS[kind], kind, opts.aimDeg));
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
      const goal = target === 'stumps' ? { x: 0, z: 0 } : padPoint();
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
      const goal = { x: off * 0.25, y: 0.7, z: keeperZ + 0.4 };
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

    // A shot that doesn't score: the ball dribbles away. Defended balls die
    // near the batter. Direction comes from the engine when it gives one.
    function dotHit(s) {
      const start = performance.now() + wait;
      let anchor = null;
      const reach = s === 'defend' ? rand(1.2, 3.2) : rand(8, 14);
      let ang = worldAngle(ball);
      if (ang == null) ang = (s === 'cut' ? rand(-80, -60) : s === 'pull' ? rand(60, 80) : rand(-12, 12)) * -off;
      const r = (ang * Math.PI) / 180;
      const ms = s === 'defend' ? 500 : 650;
      track('ball', (t) => {
        if (t < start) {
          drawBall(currentBallPos());
          return true;
        }
        anchor ??= { ...currentBallPos(), z: Math.max(CREASE_Z, currentBallPos().z) };
        const u = easeOut(clamp01((t - start) / ms));
        drawBall({
          x: anchor.x + Math.sin(r) * reach * u,
          y: Math.max(0.03, lerp(anchor.y, 0, Math.min(1, u * 3)) + Math.abs(Math.sin(u * Math.PI * 2)) * 0.15 * (1 - u)),
          z: anchor.z + Math.cos(r) * reach * u,
        });
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

  // Field angle in degrees (+ toward world +X) for the engine's
  // batter-relative angle, or null when the engine didn't give one.
  function worldAngle(ball) {
    return ball.angleDeg == null ? null : ball.angleDeg * -off;
  }

  // The ball goes into the field: switch to the top-down view. The engine's
  // angleDeg, aerial, carryM and distanceM drive the path, so a six clears the
  // rope in the air, a four reaches it, and a catch is taken where it lands.
  function fieldPlay(ball, shot, kind, wait) {
    const runs = ball.runs;
    let ang = worldAngle(ball);
    if (ang == null) {
      const [lo, hi] = SHOT_ANGLES[shot] ?? SHOT_ANGLES.drive;
      ang = rand(lo, hi);
      if (!kind && runs > 0 && runs < 4 && ball.timing === 'late' && Math.random() < 0.5) ang = rand(-160, -125);
      if (!kind && runs > 0 && runs < 4 && ball.timing === 'early' && Math.random() < 0.5) ang = rand(125, 160);
      ang *= -off;
    }
    const rope = toRope(ang);
    const hasEngine = ball.distanceM != null;
    let aerial = ball.aerial ?? (runs === 6 || (kind === 'caught' && shot !== 'defend'));
    let carry;
    let total;
    if (runs === 6) {
      aerial = true;
      carry = Math.max(ball.carryM ?? 0, rope + rand(6, 16));
      total = carry;
    } else if (kind === 'caught') {
      aerial = true;
      carry = Math.min(rope - 3, hasEngine ? ball.carryM || ball.distanceM : { loft: rand(45, 58), pull: rand(30, 45), drive: rand(22, 35), cut: rand(18, 28) }[shot] ?? 30);
      total = carry;
    } else if (runs === 4) {
      carry = aerial ? Math.min(rope - 4, Math.max(8, ball.carryM ?? rope * 0.6)) : 0;
      total = rope - 0.5;
    } else if (kind === 'runout') {
      total = Math.min(rope - 4, hasEngine ? ball.distanceM : rand(14, 22));
      carry = aerial ? Math.min(total, ball.carryM ?? 0) : 0;
    } else {
      total = Math.min(rope - 4, hasEngine ? ball.distanceM : [0, rand(16, 26), rand(30, 42), rand(46, 54)][runs] ?? 20);
      carry = aerial ? Math.min(total, ball.carryM ?? total * 0.6) : 0;
    }
    carry = Math.max(0, carry || 0);
    const airMs = carry ? 500 + carry * 13 : 0;
    const rollMs = total > carry ? 350 + (total - carry) * 14 : 0;
    const ms = airMs + rollMs;
    const peak = Math.min(30, carry * 0.4);

    const startPt = [0.6 * -off, STRIKER_END + 1.4];
    const landPt = fromStriker(ang, carry);
    const endPt = fromStriker(ang, total);
    const t0 = performance.now() + wait;

    // Pitch cam for a moment as the ball leaves the bat, then cut to the field.
    const hitStart = currentBallPos();
    const r = (ang * Math.PI) / 180;
    let anchor = null;
    track('ball', (t) => {
      if (t < t0) {
        drawBall(currentBallPos());
        return true;
      }
      anchor ??= { ...hitStart, z: Math.max(CREASE_Z, currentBallPos().z) };
      const u = clamp01((t - t0) / 260);
      drawBall({ x: anchor.x + Math.sin(r) * 7 * u, y: anchor.y + (aerial ? 4 : 0.2) * u, z: anchor.z + Math.cos(r) * 11 * u });
      return u < 1;
    });

    // Nearest fielder chases, or gets under a catch at the landing point.
    const target = kind === 'caught' ? landPt : endPt;
    let chaser = null;
    let best = Infinity;
    for (const f of fielders) {
      const d = Math.hypot(f.pos[0] - target[0], f.pos[1] - target[1]);
      if (d < best) [best, chaser] = [d, f];
    }
    const fielderGoal = kind === 'caught' ? landPt : runs >= 4 ? lerpPt(chaser.pos, endPt, 0.6) : endPt;

    at(wait + 240, () => setCam('field'));
    const flightStart = t0 + 260;
    const line = [];
    const shadowLine = [];
    tracks.set('fball', (t) => {
      if (t < flightStart) return true;
      const ms0 = t - flightStart;
      let X;
      let Y;
      let h = 0;
      if (ms0 < airMs) {
        const u = ms0 / airMs;
        [X, Y] = lerpPt(startPt, landPt, u);
        h = peak * Math.sin(Math.PI * u);
      } else {
        const u = rollMs ? easeOut(clamp01((ms0 - airMs) / rollMs)) : 1;
        [X, Y] = lerpPt(carry ? landPt : startPt, endPt, u);
      }
      drawFieldBall(X, Y, h);
      const [x, y] = fpos(X, Y);
      line.push([x, y - h * 0.9]);
      shadowLine.push([x, y]);
      set(hitLine, { points: pts(line), visibility: 'visible' });
      if (carry) set(hitShadow, { points: pts(shadowLine), visibility: 'visible' });
      return ms0 < ms;
    });
    moveToken('chaser', chaser, fielderGoal, flightStart, (kind === 'caught' ? airMs : ms) * 0.92);

    const done = flightStart - performance.now() + ms;
    let flashAt = kind === 'caught' ? flightStart - performance.now() + airMs : done;
    let totalMs = done + 300;
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
      totalMs = Math.max(done + 650, flightStart - performance.now() + runs * 620 + 200);
      flashAt = totalMs - 200;
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
      totalMs = flashAt + 300;
    }
    return { flashAt, total: totalMs };
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
    enableMarkerDrag(null);
    alive = false;
    cancelAnimationFrame(raf);
    tracks.clear();
    root.remove();
  }

  function hideFieldBall() {
    for (const node of [fBall, fBallShadow, hitLine, hitShadow]) node.setAttribute('visibility', 'hidden');
    hitLine.setAttribute('points', '');
    hitShadow.setAttribute('points', '');
  }
  hideBall();
  hideFieldBall();

  // ---- Camera, striker position and aim (SPEC 12.4) ----

  /** 'batting' puts the pitch cam behind the striker; 'bowling' behind the bowler. */
  function setCamera(mode) {
    const next = mode === 'batting' ? 'batting' : 'bowling';
    if (next === camMode) return;
    camMode = next;
    cam = CAMS[camMode];
    fieldFlip = camMode === 'batting' ? -1 : 1;
    rebuildBackground();
    placeFieldStumps();
    if (lastBallOpts) newBall(lastBallOpts);
  }

  /**
   * Striker's hand and guard. offsetX is metres from normal guard, + toward
   * the batter's leg side, clamped to +-0.6. Moves animate as a shuffle.
   */
  function setBatter({ bats = 'R', offsetX = 0 } = {}) {
    const side = bats === 'L' ? 'L' : 'R';
    const offset = Math.max(-MOVE_LIMIT, Math.min(MOVE_LIMIT, Number(offsetX) || 0));
    if (side !== batSide) {
      batSide = side;
      off = side === 'L' ? 1 : -1;
      batOffset = offset;
      if (lastBallOpts) newBall(lastBallOpts);
      return;
    }
    if (offset === batOffset) return;
    const fromX = batX;
    batOffset = offset;
    const toX = -off * (GUARD_X + offset);
    if (!batter) {
      batX = toX;
      return;
    }
    const start = performance.now();
    const ms = 160 + Math.abs(toX - fromX) * 300;
    track('shuffle', (now) => {
      const u = clamp01((now - start) / ms);
      batX = lerp(fromX, toX, easeInOut(u));
      // Lead foot steps first, then the back foot follows.
      batPose = { ...batPose, lift: [Math.sin(Math.PI * clamp01(u * 1.8)), Math.sin(Math.PI * clamp01(u * 1.8 - 0.8))] };
      drawBatter();
      drawGuardMark();
      return u < 1;
    });
  }

  /**
   * Live aim arrow from the bat while the player swipes: dashed along the
   * ground for a ground shot, arched for an aerial one. null hides it.
   */
  function showAim(aim) {
    if (!aim || aim.aimDeg == null || !batter) {
      aimLayer.setAttribute('visibility', 'hidden');
      return;
    }
    const ang = (aim.aimDeg * -off * Math.PI) / 180;
    const from = { x: batX + off * 0.38, z: CREASE_Z };
    const len = aim.aerial ? 8 : 6;
    const points = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const y = aim.aerial ? 0.25 + Math.sin(Math.PI * u * 0.85) * 2.4 : 0.06;
      points.push(project(from.x + Math.sin(ang) * len * u, y, from.z + Math.cos(ang) * len * u));
    }
    const near = points[0][2];
    set(aimPath, {
      points: pts(points),
      'stroke-width': Math.max(1.4, 0.07 * near).toFixed(2),
      'stroke-dasharray': aim.aerial ? 'none' : `${(0.25 * near).toFixed(1)} ${(0.18 * near).toFixed(1)}`,
    });
    // Arrowhead in screen space along the last segment.
    const [ex, ey] = points[points.length - 1];
    const [px, py] = points[points.length - 3];
    const d = Math.hypot(ex - px, ey - py) || 1;
    const ux = (ex - px) / d;
    const uy = (ey - py) / d;
    const size = 6;
    set(aimHead, { points: pts([[ex + ux * size, ey + uy * size], [ex - uy * size * 0.6, ey + ux * size * 0.6], [ex + uy * size * 0.6, ey - ux * size * 0.6]]) });
    aimLayer.setAttribute('visibility', 'visible');
  }

  function rebuildBackground() {
    bgLayer.replaceChildren();
    drawPitchCamBackground(bgLayer);
  }
  rebuildBackground();

  // ---- Venue, ball and the draggable landing spot (SPEC 13.2, 13.7) ----

  /** venue: a VENUES entry, or venueId: its id. ball: 'red' | 'white' | 'pink' (pink = night). */
  function setConditions({ venue = null, venueId = null, ball = 'white' } = {}) {
    const v = venue && typeof venue === 'object' ? venue : getVenue(venueId ?? venue);
    const kind = BALL_COLORS[ball] ? ball : 'white';
    look = { night: kind === 'pink', ball: kind, sky: v?.sky ?? DEFAULT_GROUND.sky, stands: v?.stands ?? DEFAULT_GROUND.stands };
    paintLook();
    ballEl.setAttribute('stroke', BALL_COLORS[kind].rim);
    root.classList.toggle('sc--night', look.night);
    nightShade.setAttribute('visibility', look.night ? 'visible' : 'hidden');
    rebuildBackground();
    fieldBg.replaceChildren();
    drawFieldCamBackground(fieldBg);
  }

  // Drag limits, batter-relative metres: across from 1.0 m outside off to
  // 0.6 m outside leg (0 = middle stump), along 0.5 m to 12 m from the stumps.
  const DRAG_X = [-1.0, 0.6];
  const DRAG_Z = [0.5, 12];
  let markerDrag = null;
  let dragId = null;
  let dragSpot = null;

  // Screen point -> spot on the ground, through the pitch cam.
  function groundAt(clientX, clientY) {
    const m = root.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    const sc = (p.y - cam.horizon) / cam.h;
    if (!(sc > 0)) return null;
    const wx = (CX - p.x) / (cam.dir * sc);
    const wz = cam.z + (cam.dir * cam.focal) / sc;
    const r2 = (v) => Math.round(v * 100) / 100;
    return {
      x: r2(Math.max(DRAG_X[0], Math.min(DRAG_X[1], wx * -off))),
      z: r2(Math.max(DRAG_Z[0], Math.min(DRAG_Z[1], wz))),
    };
  }
  function dragTo(e) {
    const spot = groundAt(e.clientX, e.clientY);
    if (!spot || (dragSpot && spot.x === dragSpot.x && spot.z === dragSpot.z)) return;
    dragSpot = spot;
    const [sx, sy, sc] = project(spot.x * -off, 0, spot.z);
    set(marker, { cx: sx, cy: sy, rx: 0.24 * sc, ry: 0.09 * sc, visibility: 'visible' });
    if (markerDrag) markerDrag({ ...spot });
  }
  const onDown = (e) => {
    if (!markerDrag || dragId !== null || pitchCam.classList.contains('sc-off')) return;
    if (e.button !== undefined && e.button > 0) return;
    e.preventDefault();
    dragId = e.pointerId;
    try { root.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    marker.classList.add('sc-marker--held');
    dragTo(e);
  };
  const onMove = (e) => {
    if (e.pointerId !== dragId) return;
    e.preventDefault();
    dragTo(e);
  };
  const onUp = (e) => {
    if (e.pointerId !== dragId) return;
    dragId = null;
    marker.classList.remove('sc-marker--held');
  };
  const DRAG_EVENTS = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp]];

  /** onMove({x, z}) gets each new spot, already clamped; null turns dragging off. */
  function enableMarkerDrag(onMoveFn) {
    const next = typeof onMoveFn === 'function' ? onMoveFn : null;
    if (next && !markerDrag) {
      for (const [type, fn] of DRAG_EVENTS) root.addEventListener(type, fn);
      root.style.touchAction = 'none';
      root.classList.add('sc--drag');
    } else if (!next && markerDrag) {
      for (const [type, fn] of DRAG_EVENTS) root.removeEventListener(type, fn);
      root.style.touchAction = '';
      root.classList.remove('sc--drag');
      marker.classList.remove('sc-marker--held');
      dragId = null;
    }
    markerDrag = next;
    dragSpot = null;
  }

  return {
    newBall, setMarker, hideMarker, runUp, release, swing: swingBat, outcome, destroy,
    setCamera, setBatter, showAim, setConditions, enableMarkerDrag,
  };

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
      g,
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
  const grad = (id, n, attrs = {}) => {
    const g = svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1, ...attrs }, defs);
    return Array.from({ length: n }, (_, i) => svg('stop', { offset: i / (n - 1) }, g));
  };
  const radial = (id, offsets, attrs = {}) => {
    const g = svg('radialGradient', { id, cx: 0.5, cy: 0.5, r: 0.5, ...attrs }, defs);
    return offsets.map((offset) => svg('stop', { offset }, g));
  };
  const sky = grad('sc-sky', 2);
  grad('sc-pitch', 2).forEach((st, i) => st.setAttribute('stop-color', ['#c9b483', '#d8c597'][i]));
  const stand = grad('sc-stand', 2);
  const ball = radial('sc-ball', [0, 0.6, 1], { cx: 0.35, cy: 0.35, r: 0.7 });
  const field = radial('sc-field', [0, 1]);
  // Floodlight glow, only drawn at night.
  radial('sc-glow', [0, 0.25, 1]).forEach((st, i) => {
    set(st, { 'stop-color': '#fff6d8', 'stop-opacity': [1, 0.5, 0][i] });
  });
  radial('sc-vignette', [0.45, 1], { gradientUnits: 'userSpaceOnUse', cx: CX, cy: 134, r: 190 }).forEach((st, i) => {
    set(st, { 'stop-color': '#020814', 'stop-opacity': [0, 0.5][i] });
  });
  // Crowd: a tile of coloured dots.
  const crowd = svg('pattern', { id: 'sc-crowd', width: 7, height: 6, patternUnits: 'userSpaceOnUse' }, defs);
  const crowdBg = svg('rect', { width: 7, height: 6 }, crowd);
  const dots = [[1.5, 1.5, '#e05a5a'], [5, 1.2, '#f2c14e'], [3.2, 4.2, '#7fb7e6'], [6.2, 4.8, '#f4f4ee'], [0.4, 4.6, '#9be07f']];
  for (const [cx, cy, fill] of dots) svg('circle', { cx, cy, r: 1.05, fill }, crowd);
  const clip = svg('clipPath', { id: 'sc-field-clip' }, defs);
  const [cx, cy] = fpos(0, 0);
  svg('circle', { cx, cy, r: ROPE * FS + 3 }, clip);
  defStops = { sky, stand, ball, field, crowdBg };
  paintLook();
}

// Colours of the shared gradients for the current look.
function paintLook() {
  if (!defStops) return;
  const { sky, stand, ball, field, crowdBg } = defStops;
  const paint = (stops, colors, opacities = []) => stops.forEach((st, i) => {
    st.setAttribute('stop-color', colors[i]);
    if (opacities[i] != null) st.setAttribute('stop-opacity', opacities[i]);
  });
  const b = BALL_COLORS[look.ball] ?? BALL_COLORS.red;
  paint(ball, [b.light, b.mid, b.dark]);
  if (look.night) {
    paint(sky, ['#02060d', '#0d1a2e']);
    // Dark at the top of the stands, lit lower down near the field.
    paint(stand, ['#03070f', '#03070f'], [0.85, 0.12]);
    paint(field, ['#47a35a', '#2c7a3b']);
    crowdBg.setAttribute('fill', '#141c28');
  } else {
    paint(sky, [shade(look.sky, -0.25), shade(look.sky, 0.3)]);
    paint(stand, [look.stands[1], look.stands[0]], [0.62, 0.5]);
    paint(field, ['#3a8a47', '#256b33']);
    crowdBg.setAttribute('fill', shade(look.stands[0], -0.55));
  }
}

// Draws for the current camera: the far rope, boards, sightscreen and stands
// are beyond whichever end the camera looks toward.
function drawPitchCamBackground(g) {
  const far = cam.dir < 0 ? -66 : 20.12 + 66;
  const beyond = (m) => far + cam.dir * m;
  svg('rect', { x: -2000, y: -2000, width: 4400, height: 2100 + Math.max(0, cam.horizon), fill: 'url(#sc-sky)' }, g);
  const [, ropeY] = project(0, 0, far);
  const [, boardTop] = project(0, 0.9, beyond(1));
  // Stands, with floodlight glow on top.
  // The far camera sees a shallow tier of stands under the night sky.
  const standTop = cam.dir > 0 ? boardTop - 55 : -400;
  svg('rect', { x: -2000, y: standTop, width: 4400, height: boardTop - standTop, fill: 'url(#sc-crowd)' }, g);
  svg('rect', { x: -2000, y: standTop, width: 4400, height: boardTop - standTop, fill: 'url(#sc-stand)' }, g);
  if (cam.dir > 0) svg('rect', { x: -2000, y: standTop - 3, width: 4400, height: 4, fill: look.night ? '#1a2230' : look.stands[2] }, g);
  if (look.night) drawFloodlights(g, boardTop);
  // Advertising boards and the sightscreen behind the batter.
  const boardColors = ['#1f5fbf', look.stands[1], '#0f6b3a', '#f2b705'];
  for (let i = -14; i < 14; i++) {
    const [x0] = project(i * 8, 0, beyond(1));
    const [x1] = project(i * 8 + 8, 0, beyond(1));
    svg('rect', { x: Math.min(x0, x1), y: boardTop, width: Math.abs(x1 - x0), height: ropeY - boardTop, fill: boardColors[(i + 40) % 4] }, g);
  }
  const [sx0, sy0] = project(-3.5, 0, beyond(2));
  const [sx1, sy1] = project(3.5, 3.6, beyond(2));
  // Black sightscreens for the white and pink balls, as in real cricket.
  const screenFill = look.ball === 'red' ? '#dfe6e3' : '#1d232b';
  svg('rect', { x: Math.min(sx0, sx1), y: sy1, width: Math.abs(sx1 - sx0), height: sy0 - sy1, fill: screenFill }, g);

  // Outfield with mowing stripes.
  const grass = look.night ? ['#379046', '#3f9b4e'] : ['#2f7d3c', '#36883f'];
  svg('rect', { x: -2000, y: ropeY, width: 4400, height: 2000, fill: grass[0] }, g);
  const zNear = cam.z + cam.dir * 1.5;
  const [zLo, zHi] = [Math.min(far, zNear), Math.max(far, zNear)];
  for (let z = zLo, i = 0; z < zHi; z += 5, i++) {
    if (i % 2) continue;
    const a = project(-120, 0, z);
    const b = project(120, 0, z);
    const c = project(120, 0, Math.min(zHi, z + 5));
    const d = project(-120, 0, Math.min(zHi, z + 5));
    svg('polygon', { points: pts([a, b, c, d]), fill: grass[1] }, g);
  }
  svg('line', { x1: -2000, y1: ropeY, x2: 2400, y2: ropeY, stroke: '#f4f4ee', 'stroke-width': 1 }, g);

  // Thirty-yard circle.
  // Only the part in front of the camera.
  const ring = [];
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const z = 10.06 + Math.cos(a) * 27.4;
    if (camDepth(z) > 2) ring.push(project(Math.sin(a) * 27.4, 0, z));
    else if (ring.length) break;
  }
  if (ring.length > 1) svg('polyline', { points: pts(ring), fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 0.8, 'stroke-dasharray': '3 3' }, g);

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

  // Night: a pool of floodlight over the square, the rest of the frame darker.
  if (look.night) {
    const [px, py] = project(0, 0, 10.06);
    const pool = svg('radialGradient', { id: 'sc-pool', gradientUnits: 'userSpaceOnUse', cx: px, cy: py, r: cam.dir < 0 ? 175 : 150, gradientTransform: `translate(${px} ${py}) scale(1 0.8) translate(${-px} ${-py})` }, g);
    for (const [offset, a] of [[0.35, 0], [0.75, 0.32], [1, 0.55]]) svg('stop', { offset, 'stop-color': '#020a1c', 'stop-opacity': a }, pool);
    svg('rect', { x: -2000, y: -2000, width: 4400, height: 4400, fill: 'url(#sc-pool)', 'pointer-events': 'none' }, g);
  }
}

// Four floodlight towers above the stands, the outer pair nearer and taller.
// Drawn in screen space so the lamps stay in view in both cameras.
function drawFloodlights(g, boardTop) {
  for (const [x, top, w] of [[106, 11, 15], [152, 19, 10], [248, 19, 10], [294, 11, 15]]) {
    svg('rect', { x: x - 0.7, y: top, width: 1.4, height: Math.max(0, boardTop - top), fill: '#2a3240' }, g);
    svg('circle', { cx: x, cy: top + 2, r: w * 2.6, fill: 'url(#sc-glow)' }, g);
    svg('rect', { x: x - w / 2, y: top - 1, width: w, height: w * 0.45, rx: 1, fill: '#fff8de', stroke: '#2a3240', 'stroke-width': 0.6 }, g);
  }
}

function drawFieldCamBackground(g) {
  const [cx, cy] = fpos(0, 0);
  svg('rect', { x: -2000, y: -2000, width: 4400, height: 4400, fill: 'url(#sc-crowd)' }, g);
  svg('rect', { x: -2000, y: -2000, width: 4400, height: 4400, fill: look.night ? 'rgba(3,7,15,0.55)' : rgba(look.stands[0], 0.7) }, g);
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
  if (look.night) {
    const d = (ROPE + 12) * FS * Math.SQRT1_2;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      svg('circle', { cx: cx + sx * d, cy: cy + sy * d, r: 30, fill: 'url(#sc-glow)' }, g);
      svg('circle', { cx: cx + sx * d, cy: cy + sy * d, r: 3.5, fill: '#fff8de', stroke: '#2a3240', 'stroke-width': 0.8 }, g);
    }
  }
}
