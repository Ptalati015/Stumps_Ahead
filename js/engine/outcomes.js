// Ball outcomes: timing grade, delivery preparation and the outcome table.
// Pure: no DOM, randomness only through an rng from rng.js.
import { clamp } from './rng.js';

export const SHOTS = ['defend', 'drive', 'pull', 'cut', 'loft'];
export const SHOT_LABELS = { defend: 'Defend', drive: 'Drive', pull: 'Pull', cut: 'Cut', loft: 'Loft', leave: 'Leave' };
export const LINES = ['off', 'middle', 'leg'];
export const LENGTHS = ['yorker', 'full', 'good', 'short'];
export const LINE_LABELS = { off: 'Off', middle: 'Middle', leg: 'Leg' };
export const LENGTH_LABELS = { yorker: 'Yorker', full: 'Full', good: 'Good', short: 'Short' };

// SPEC 4: Perfect within ±60ms, Good ±150ms, Early/Late ±300ms, else Miss.
export const TIMING_WINDOWS = { perfect: 60, good: 150, edge: 300 };

const DIFFICULTY = { easy: -1, normal: 0, hard: 1 };
export const difficultyFactor = (d) => DIFFICULTY[d] ?? 0;

/** @returns {'perfect'|'good'|'early'|'late'|'miss'} */
export function gradeTiming(timingMs) {
  if (timingMs == null || !Number.isFinite(timingMs)) return 'miss';
  const abs = Math.abs(timingMs);
  if (abs <= TIMING_WINDOWS.perfect) return 'perfect';
  if (abs <= TIMING_WINDOWS.good) return 'good';
  if (abs <= TIMING_WINDOWS.edge) return timingMs < 0 ? 'early' : 'late';
  return 'miss';
}

// Ball speed from the bowler: pace 128-150 kph, spin 76-92 kph.
export function deliverySpeedKph(bowler) {
  const skill = clamp(bowler?.bowling ?? 50, 1, 100);
  return bowler?.bowlType === 'spin' ? Math.round(76 + skill * 0.16) : Math.round(128 + skill * 0.22);
}

// Release to arrival, 900ms (150 kph) to 1400ms (76 kph). SPEC 4: 0.9 to 1.4 s.
export function travelTimeMs(kph) {
  return Math.round(clamp(900 + ((150 - kph) * 500) / 74, 900, 1400));
}

/**
 * Turn the bowler's intent into what actually happens: inaccurate balls drift
 * one step in line or length and may be wides or no-balls.
 * @returns {{line:string, length:string, kph:number, travelMs:number, extra:null|'wide'|'noball'}}
 */
export function prepareDelivery(bowl, bowler, rng) {
  const accuracy = clamp(Number.isFinite(bowl.accuracy) ? bowl.accuracy : 0.7, 0, 1);
  const skill = clamp(bowler?.bowling ?? 50, 1, 100) / 100;
  const wobble = (1 - accuracy) * (1.25 - skill * 0.5);
  let line = LINES.includes(bowl.line) ? bowl.line : 'off';
  let length = LENGTHS.includes(bowl.length) ? bowl.length : 'good';

  if (rng.next() < wobble * 0.7) {
    const i = LENGTHS.indexOf(length) + (rng.next() < 0.5 ? -1 : 1);
    length = LENGTHS[clamp(i, 0, LENGTHS.length - 1)];
  }
  if (rng.next() < wobble * 0.5) {
    const i = LINES.indexOf(line) + (rng.next() < 0.5 ? -1 : 1);
    line = LINES[clamp(i, 0, LINES.length - 1)];
  }

  let extra = null;
  const roll = rng.next();
  const wide = 0.012 + wobble * 0.08 + (line === 'leg' ? 0.015 : 0);
  const noball = 0.005 + wobble * 0.04;
  if (roll < wide) extra = 'wide';
  else if (roll < wide + noball) extra = 'noball';

  const kph = clamp(deliverySpeedKph(bowler) + rng.int(-3, 3), 70, 155);
  return { line, length, kph, travelMs: travelTimeMs(kph), extra };
}

// Base outcome weights per shot and timing. Keys are runs, or 'out'.
const TABLE = {
  defend: {
    perfect: { 0: 55, 1: 38, 2: 6, out: 0.4 },
    good: { 0: 66, 1: 29, 2: 3, out: 1.5 },
    edge: { 0: 75, 1: 17, out: 6 },
    miss: { 0: 75, out: 20 },
  },
  drive: {
    perfect: { 1: 14, 2: 14, 3: 4, 4: 56, 6: 8, out: 2 },
    good: { 0: 14, 1: 30, 2: 20, 4: 30, 6: 2, out: 4 },
    edge: { 0: 35, 1: 30, 2: 6, 4: 8, out: 18 },
    miss: { 0: 65, out: 30 },
  },
  pull: {
    perfect: { 1: 10, 2: 10, 4: 45, 6: 30, out: 4 },
    good: { 0: 15, 1: 25, 2: 15, 4: 30, 6: 8, out: 8 },
    edge: { 0: 30, 1: 25, 4: 10, 6: 5, out: 25 },
    miss: { 0: 65, out: 30 },
  },
  cut: {
    perfect: { 1: 14, 2: 16, 3: 4, 4: 60, 6: 2, out: 2 },
    good: { 0: 15, 1: 30, 2: 20, 4: 30, out: 5 },
    edge: { 0: 35, 1: 28, 2: 5, 4: 8, out: 22 },
    miss: { 0: 65, out: 30 },
  },
  loft: {
    perfect: { 1: 5, 2: 8, 4: 25, 6: 58, out: 5 },
    good: { 0: 10, 1: 15, 2: 10, 4: 25, 6: 22, out: 16 },
    edge: { 0: 20, 1: 15, 4: 10, 6: 10, out: 40 },
    miss: { 0: 55, out: 40 },
  },
};

// How each shot suits each length and line: [scoring multiplier, out multiplier].
const LENGTH_FIT = {
  yorker: { defend: [1, 1.2], drive: [0.6, 1.3], pull: [0.3, 2], cut: [0.4, 1.8], loft: [0.7, 1.4] },
  full: { defend: [1, 1], drive: [1.3, 0.8], pull: [0.5, 1.6], cut: [0.6, 1.4], loft: [1.25, 0.9] },
  good: { defend: [1, 0.8], drive: [0.9, 1], pull: [0.8, 1.2], cut: [0.9, 1.1], loft: [0.8, 1.3] },
  short: { defend: [1, 1.1], drive: [0.6, 1.4], pull: [1.4, 0.8], cut: [1.3, 0.85], loft: [1, 1] },
};
const LINE_FIT = {
  off: { cut: [1.25, 0.85], pull: [0.8, 1.2], drive: [1.1, 1] },
  middle: { cut: [0.8, 1.2] },
  leg: { cut: [0.5, 1.5], pull: [1.2, 0.9], drive: [0.85, 1.1] },
};

const WICKET_KINDS = {
  defend: { bowled: 45, lbw: 40, caught: 15 },
  drive: { caught: 55, bowled: 30, lbw: 15 },
  pull: { caught: 75, bowled: 10, lbw: 15 },
  cut: { caught: 80, bowled: 20 },
  loft: { caught: 95, bowled: 5 },
  leave: { bowled: 55, lbw: 45 },
};
// Chance of losing the stumps when leaving, by line (short balls rarely hit).
const LEAVE_OUT = { off: 0.03, middle: 0.2, leg: 0.1 };

// ---- Batter movement (SPEC 12.2) ----
// offsetX is in metres, + toward the batter's leg side. Batter-relative, so
// the same for right- and left-handers.
export const MAX_OFFSET_M = 0.6;
export const OFFSET_STEP_M = 0.15;
const LINE_SHIFT_M = 0.3;

const offsetOf = (bat) => clamp(Number.isFinite(bat?.offsetX) ? bat.offsetX : 0, -MAX_OFFSET_M, MAX_OFFSET_M);

/** The line as the batter meets it after moving: stepping across to the off side turns off into middle, middle into leg. */
export function effectiveLine(line, offsetX = 0) {
  const steps = offsetX <= -LINE_SHIFT_M ? 1 : offsetX >= LINE_SHIFT_M ? -1 : 0;
  const i = LINES.indexOf(line);
  return i < 0 ? line : LINES[clamp(i + steps, 0, LINES.length - 1)];
}

// How much more of the stumps a leg-side shuffle exposes (1 = normal guard).
const stumpExposure = (offsetX) => 1 + Math.max(0, offsetX) * 2.5;
// A straight ball with the batter well outside leg is heading for the stumps.
const aimedAtStumps = (line, offsetX) => offsetX >= 0.45 && (line === 'off' || line === 'middle');

/**
 * Resolve a (non-wide) delivery against the batter's shot.
 * @param {Object} p
 * @param {{line:string, length:string}} p.delivery
 * @param {{shot:string, timingMs:number|null, offsetX?:number}} p.bat
 * @param {Object} p.batter  Player
 * @param {Object} p.bowler  Player
 * @param {'easy'|'normal'|'hard'} p.difficulty
 * @param {boolean} p.userBatting
 * @returns {{runs:number, wicketKind:null|'bowled'|'caught'|'lbw'|'runout', timing:string|null, shot:string}}
 */
export function resolveOutcome({ delivery, bat, batter, bowler, difficulty, userBatting, rng }) {
  const diff = difficultyFactor(difficulty);
  // Positive when the game should favour the user: easy helps, hard hurts.
  const userEdge = userBatting ? -diff : diff;
  const shot = SHOTS.includes(bat?.shot) ? bat.shot : 'leave';
  const offsetX = offsetOf(bat);
  const exposure = stumpExposure(offsetX);

  if (shot === 'leave') {
    let chance = LEAVE_OUT[delivery.line] * (delivery.length === 'short' ? 0.2 : 1) * exposure;
    if (aimedAtStumps(delivery.line, offsetX) && delivery.length !== 'short') chance = Math.max(chance, 0.3);
    const out = rng.next() < chance;
    return { runs: 0, wicketKind: out ? rng.weighted(WICKET_KINDS.leave) : null, timing: null, shot };
  }

  const timing = gradeTiming(bat.timingMs);
  const line = effectiveLine(delivery.line, offsetX);
  const row = TABLE[shot][timing === 'early' || timing === 'late' ? 'edge' : timing];
  const [lenScore, lenOut] = LENGTH_FIT[delivery.length]?.[shot] ?? [1, 1];
  const [lineScore, lineOut] = LINE_FIT[line]?.[shot] ?? [1, 1];
  const skill = (clamp(batter?.batting ?? 50, 1, 100) - clamp(bowler?.bowling ?? 50, 1, 100)) / 100;
  const scoreMul = lenScore * lineScore * (1 + 0.5 * skill) * (1 + 0.12 * userEdge);
  let outMul = lenOut * lineOut * (1 - 0.6 * skill) * (1 - 0.2 * userEdge);
  if (timing === 'miss') outMul *= exposure;

  const weights = {};
  for (const [key, w] of Object.entries(row)) {
    if (key === 'out') weights.out = w * outMul;
    else if (key === '0') weights[key] = w;
    else weights[key] = w * scoreMul;
  }
  const pick = rng.weighted(weights);
  if (pick === 'out') {
    let kinds = WICKET_KINDS[shot];
    // Missing with the stumps exposed: more likely to be bowled.
    if (timing === 'miss' && exposure > 1) kinds = { ...kinds, bowled: (kinds.bowled ?? 0) + 60 * (exposure - 1) };
    return { runs: 0, wicketKind: rng.weighted(kinds), timing, shot };
  }

  const runs = Number(pick);
  // Rare run out going for a quick single.
  if (runs === 1 && rng.next() < 0.015) return { runs: 0, wicketKind: 'runout', timing, shot };
  return { runs, wicketKind: null, timing, shot };
}

// ---- Shot direction and flight (SPEC 12.1, 12.2) ----
// Angles are batter-relative degrees: 0 = straight back past the bowler,
// + = leg side, - = off side, ±180 = straight behind.

// Default direction for each shot button.
export const DEFAULT_AIM = { defend: 0, drive: -20, cut: -85, pull: 80, loft: 0, leave: 0 };

/** Shot type from an aim angle and aerial flag (SPEC 12.1 table). */
export function shotFromAim(aimDeg, aerial) {
  if (aerial) return 'loft';
  const a = normAngle(aimDeg);
  if (a >= -30 && a <= 30) return 'drive';
  if (a < -30 && a >= -110) return a < -70 ? 'cut' : 'drive';
  if (a > 30 && a <= 110) return 'pull';
  return a < 0 ? 'cut' : 'pull';
}

export function normAngle(deg) {
  let a = ((Number(deg) || 0) % 360 + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

// Boundary distance in metres. Joel's scene scales this to its field.
export const ROPE_M = 65;

/** Angle error band for a timing grade: [min, max] added to the aim. */
export const ANGLE_ERROR = {
  perfect: [-5, 5],
  good: [-12, 12],
  early: [25, 40],
  late: [-40, -25],
};

/**
 * Where the ball goes, so the scene can draw what the engine decided.
 * Uses its own rng stream: leaving it out of a match never changes scores.
 * @returns {{angleDeg:number|null, aerial:boolean, carryM:number|null, distanceM:number|null}}
 */
export function shotFlight({ outcome, bat, extra }, rng) {
  const none = { angleDeg: null, aerial: false, carryM: null, distanceM: null };
  const { shot, runs, wicketKind, timing } = outcome;
  if (extra === 'wide' || shot === 'leave' || wicketKind === 'bowled' || wicketKind === 'lbw') return none;
  // A clean miss that didn't get out: no contact.
  if (timing === 'miss' && !wicketKind) return none;

  const aim = Number.isFinite(bat?.aimDeg) ? normAngle(bat.aimDeg) : DEFAULT_AIM[shot] ?? 0;
  let angle;
  if (timing === 'miss') {
    // A thin edge behind: keeper or slips (off side behind square).
    angle = -150 - rng.next() * 25;
  } else {
    const [lo, hi] = ANGLE_ERROR[timing] ?? [0, 0];
    angle = aim + lo + rng.next() * (hi - lo);
    // Late edges carry to the keeper and slips.
    if (timing === 'late' && wicketKind === 'caught' && rng.next() < 0.5) angle = -140 - rng.next() * 30;
  }
  angle = Math.round(normAngle(angle));

  const caught = wicketKind === 'caught';
  const aerial = Boolean(bat?.aerial) || shot === 'loft' || runs === 6 || caught;
  const between = (a, b) => Math.round(a + rng.next() * (b - a));
  let carryM;
  let distanceM;
  if (runs === 6) {
    carryM = between(ROPE_M + 3, ROPE_M + 25);
    distanceM = carryM;
  } else if (caught) {
    carryM = timing === 'miss' || angle < -130 ? between(12, 22) : between(15, ROPE_M - 4);
    distanceM = carryM;
  } else if (runs === 4) {
    carryM = aerial ? between(25, ROPE_M - 8) : 0;
    distanceM = between(ROPE_M + 1, ROPE_M + 6);
  } else if (shot === 'defend') {
    carryM = 0;
    distanceM = between(2, 9);
  } else {
    // Fielded: singles and twos go further than dots; aerial ones drop short.
    const far = runs === 0 ? [12, 30] : runs === 1 ? [18, 40] : [35, 58];
    distanceM = between(far[0], far[1]);
    carryM = aerial ? Math.min(distanceM, between(15, 40)) : 0;
  }
  return { angleDeg: angle, aerial, carryM, distanceM };
}

const SHOT_WORDS = {
  defend: ['solid defence', 'a firm push'],
  drive: ['a glorious cover drive', 'a crisp straight drive', 'a lovely on drive'],
  pull: ['a fierce pull', 'a powerful pull shot'],
  cut: ['a sharp cut', 'a late cut'],
  loft: ['a lofted hit', 'a big swing'],
};

/** Commentary line for a ball. Names are plain strings; UI must render with textContent. */
// Drive wording follows where the ball actually went (batter-relative angle).
function driveWords(angleDeg) {
  if (angleDeg == null) return null;
  if (angleDeg >= -15 && angleDeg <= 15) return 'a crisp straight drive';
  if (angleDeg < -15 && angleDeg >= -60) return 'a glorious cover drive';
  if (angleDeg < -60) return 'a punchy square drive';
  if (angleDeg <= 45) return 'a lovely on drive';
  return 'a flick off the pads';
}

export function commentaryFor({ runs, extra, wicketKind, timing, shot, angleDeg = null }, names, rng) {
  const { batter = 'The batter', bowler = 'the bowler', fielder = 'the fielder' } = names ?? {};
  if (extra === 'wide') return `Wide from ${bowler}.`;
  const prefix = extra === 'noball' ? 'No ball! ' : '';
  if (wicketKind) {
    const lines = {
      bowled: `BOWLED! ${bowler} knocks over ${batter}.`,
      caught: `OUT! ${batter} is caught by ${fielder}.`,
      lbw: `OUT! ${batter} trapped LBW by ${bowler}.`,
      runout: `RUN OUT! ${batter} is short of the crease.`,
    };
    return lines[wicketKind];
  }
  if (shot === 'leave') return `${prefix}${batter} leaves it alone.`;
  // Always draw, so the match rng stream is the same whatever the wording.
  const picked = rng.pick(SHOT_WORDS[shot] ?? ['a shot']);
  const how = (shot === 'drive' && driveWords(angleDeg)) || picked;
  const timingNote = timing === 'early' ? ' Through early.' : timing === 'late' ? ' A touch late.' : timing === 'miss' ? ' Beaten!' : '';
  if (runs === 6) return `${prefix}SIX! ${batter} with ${how}, into the stands!`;
  if (runs === 4) return `${prefix}FOUR! ${how[0].toUpperCase() + how.slice(1)} from ${batter}.`;
  if (runs === 0) return `${prefix}${timing === 'miss' ? 'Beaten!' : 'Dot ball.'}${timing === 'miss' ? '' : timingNote}`;
  const word = runs === 1 ? 'a single' : runs === 2 ? 'two runs' : `${runs} runs`;
  return `${prefix}${batter} plays ${how} for ${word}.${timingNote}`;
}
