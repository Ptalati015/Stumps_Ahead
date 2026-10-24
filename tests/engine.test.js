import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../js/engine/rng.js';
import { gradeTiming, travelTimeMs } from '../js/engine/outcomes.js';
import {
  createMatch, setBowler, playBall, startSecondInnings, availableBowlers, oversText, runRate, chaseInfo,
  aiChooseBowler, aiBowl, aiBat, currentInnings, maxOversPerBowler,
} from '../js/engine/match.js';
import { fixtureConfig, simulateMatch } from './fixtures.js';

// Play one ball with AI choices on both sides.
function aiBall(state) {
  if (state.status === 'awaiting_bowler') state = setBowler(state, aiChooseBowler(state));
  const bowl = aiBowl(state);
  return playBall(state, bowl, aiBat(state, bowl));
}

// Find a seed + inputs that give a particular kind of ball, by brute force.
function findBall(state, predicate, bat = { shot: 'drive', timingMs: 0 }) {
  for (let acc = 1; acc >= 0; acc -= 0.05) {
    for (const length of ['full', 'good', 'short', 'yorker']) {
      for (let s = 0; s < 400; s++) {
        const probe = { ...state, rngState: s };
        const res = playBall(probe, { line: 'off', length, accuracy: acc }, bat);
        if (predicate(res)) return res;
      }
    }
  }
  throw new Error('no matching ball found');
}

const started = () => setBowler(createMatch(fixtureConfig()), aiChooseBowler(createMatch(fixtureConfig())));

test('rng is repeatable for a seed', () => {
  const a = createRng(7), b = createRng(7);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
  const r = createRng(3);
  for (let i = 0; i < 200; i++) {
    const n = r.int(2, 5);
    assert.ok(n >= 2 && n <= 5 && Number.isInteger(n));
  }
});

test('timing windows match the spec', () => {
  assert.equal(gradeTiming(0), 'perfect');
  assert.equal(gradeTiming(-60), 'perfect');
  assert.equal(gradeTiming(149), 'good');
  assert.equal(gradeTiming(-200), 'early');
  assert.equal(gradeTiming(299), 'late');
  assert.equal(gradeTiming(301), 'miss');
  assert.equal(gradeTiming(null), 'miss');
  assert.equal(travelTimeMs(150), 900);
  assert.equal(travelTimeMs(76), 1400);
});

test('createMatch sets up first innings and does not need a bowler yet', () => {
  const s = createMatch(fixtureConfig({ battingFirst: 'ai' }));
  assert.equal(s.status, 'awaiting_bowler');
  assert.equal(s.innings.length, 1);
  assert.equal(s.innings[0].battingTeam, 'AUS');
  assert.equal(s.innings[0].strikerId, 'AUS-1');
  assert.equal(s.innings[0].nonStrikerId, 'AUS-2');
  assert.equal(oversText(s.innings[0]), '0.0');
  assert.equal(runRate(s.innings[0]), 0);
});

test('createMatch rejects the same nation on both sides', () => {
  assert.throws(() => createMatch(fixtureConfig({ aiTeam: fixtureConfig().userTeam })));
});

test('playBall does not mutate the state passed in', () => {
  const s = started();
  const before = JSON.stringify(s);
  const bowl = aiBowl(s);
  playBall(s, bowl, aiBat(s, bowl));
  assert.equal(JSON.stringify(s), before);
});

test('overs go 0.5 then 1.0, never 0.6, and the over needs a new bowler', () => {
  let s = started();
  const seen = [];
  while (currentInnings(s).legalBalls < 6 && s.status === 'in_play') {
    s = aiBall(s).state;
    seen.push(oversText(currentInnings(s)));
  }
  assert.ok(!seen.includes('0.6'));
  assert.equal(seen.at(-1), '1.0');
  assert.equal(s.status, 'awaiting_bowler');
  assert.equal(currentInnings(s).bowlerId, null);
});

test('wides and no-balls add a run but not a legal ball', () => {
  const s = started();
  for (const type of ['wide', 'noball']) {
    const { state, ball } = findBall(s, (r) => r.ball.extra?.type === type);
    const inn = currentInnings(state);
    assert.equal(inn.legalBalls, 0);
    assert.equal(inn.runs, 1 + ball.runs);
    assert.equal(oversText(inn), '0.0');
  }
});

test('odd runs swap strike, even runs do not', () => {
  const s = started();
  const inn = currentInnings(s);
  const one = findBall(s, (r) => r.ball.runs === 1 && !r.ball.extra && !r.ball.wicket);
  assert.equal(currentInnings(one.state).strikerId, inn.nonStrikerId);
  const four = findBall(s, (r) => r.ball.runs === 4 && !r.ball.extra);
  assert.equal(currentInnings(four.state).strikerId, inn.strikerId);
});

test('end of over swaps strike', () => {
  let s = started();
  while (currentInnings(s).legalBalls < 5) s = aiBall(s).state;
  // A dot ball (via a leave) on the last ball of the over.
  const last = findBall(s, (r) => r.ball.runs === 0 && !r.ball.extra && !r.ball.wicket, { shot: 'leave', timingMs: null });
  assert.equal(currentInnings(last.state).strikerId, currentInnings(s).nonStrikerId);
});

test('new batter comes in at the dismissed batter\'s end', () => {
  const s = started();
  const inn = currentInnings(s);
  const out = findBall(s, (r) => r.ball.wicket !== null && r.ball.runs === 0);
  const after = currentInnings(out.state);
  assert.equal(after.wickets, 1);
  assert.equal(after.strikerId, 'IND-3');
  assert.equal(after.nonStrikerId, inn.nonStrikerId);
  assert.ok(after.batting[inn.strikerId].howOut);
});

test('bowler cap and no consecutive overs', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = simulateMatch(fixtureConfig({ overs: 10, seed }));
    const cap = maxOversPerBowler(s) * 6;
    for (const inn of s.innings) {
      for (const card of Object.values(inn.bowling)) assert.ok(card.balls <= cap);
      const legal = inn.log.filter((b) => !b.extra);
      for (let o = 1; o * 6 < legal.length; o++) assert.notEqual(legal[o * 6].bowlerId, legal[o * 6 - 1].bowlerId);
    }
  }
});

test('availableBowlers excludes the keeper and the previous bowler', () => {
  let s = started();
  const first = currentInnings(s).bowlerId;
  while (s.status === 'in_play') s = aiBall(s).state;
  const ids = availableBowlers(s).map((p) => p.id);
  assert.ok(!ids.includes(first));
  assert.ok(!ids.includes('AUS-3'));
  assert.throws(() => setBowler(s, first));
});

test('full matches: all out at 10, chase stops at target, result text is right', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const s = simulateMatch(fixtureConfig({ overs: 5, seed }));
    assert.equal(s.status, 'complete');
    const [a, b] = s.innings;
    assert.equal(b.target, a.runs + 1);
    for (const inn of s.innings) {
      assert.ok(inn.wickets <= 10);
      assert.ok(inn.legalBalls <= 30);
      assert.equal(inn.legalBalls, inn.log.filter((x) => !x.extra || x.extra.type !== 'wide' && x.extra.type !== 'noball').length);
      const total = inn.log.reduce((t, x) => t + x.runs + (x.extra?.runs ?? 0), 0);
      assert.equal(total, inn.runs);
      const batterRuns = Object.values(inn.batting).reduce((t, c) => t + c.runs, 0);
      assert.equal(batterRuns + inn.extras.wides + inn.extras.noballs, inn.runs);
      assert.ok(Number.isFinite(runRate(inn)));
    }
    // Chase never goes past the ball that reached the target.
    if (b.runs >= b.target) {
      const lastBall = b.log.at(-1);
      assert.ok(b.runs - lastBall.runs - (lastBall.extra?.runs ?? 0) < b.target);
      const wl = 10 - b.wickets;
      assert.match(s.result.text, new RegExp(`won by ${wl} wicket${wl === 1 ? '' : 's'}$`));
      assert.equal(s.result.winner, b.battingTeam);
    } else if (b.runs === a.runs) {
      assert.deepEqual(s.result, { winner: null, text: 'Match tied' });
    } else {
      assert.equal(s.result.winner, a.battingTeam);
      assert.match(s.result.text, /won by \d+ runs?$/);
    }
    // All out means exactly 10 wickets and an innings ending there.
    for (const inn of s.innings) if (inn.wickets === 10) assert.equal(inn.log.at(-1).wicket !== null, true);
  }
});

test('innings break then second innings with the sides swapped', () => {
  let s = createMatch(fixtureConfig());
  while (s.status !== 'innings_break') s = aiBall(s).state;
  assert.equal(s.result, null);
  assert.throws(() => playBall(s, { line: 'off', length: 'good', accuracy: 1 }, { shot: 'leave', timingMs: null }));
  const s2 = startSecondInnings(s);
  assert.equal(s2.current, 1);
  assert.equal(s2.status, 'awaiting_bowler');
  assert.equal(s2.innings[1].battingTeam, 'AUS');
  assert.equal(s2.innings[1].target, s.innings[0].runs + 1);
  assert.deepEqual(chaseInfo(s2), { runsNeeded: s.innings[0].runs + 1, ballsLeft: 12, requiredRate: (s.innings[0].runs + 1) / 2 });
});

test('same seed gives the same match', () => {
  const a = simulateMatch(fixtureConfig({ seed: 99 }));
  const b = simulateMatch(fixtureConfig({ seed: 99 }));
  assert.deepEqual(a, b);
});

test('scoring feels like T20 at normal difficulty (about 7 to 12 an over)', () => {
  let runs = 0, balls = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (const inn of simulateMatch(fixtureConfig({ overs: 5, seed })).innings) {
      runs += inn.runs;
      balls += inn.legalBalls;
    }
  }
  const rpo = (runs * 6) / balls;
  assert.ok(rpo > 7 && rpo < 12, `rpo ${rpo}`);
});

// ---- Phase 3: movement, aim and flight (SPEC 12.2) ----
import { commentaryFor } from '../js/engine/outcomes.js';
import { ROPE_M, ANGLE_ERROR, DEFAULT_AIM, effectiveLine, shotFromAim, resolveOutcome } from '../js/engine/outcomes.js';

const SHOT_CYCLE = ['defend', 'drive', 'pull', 'cut', 'loft', 'leave'];

// Play a match with a fixed sequence of BatInputs; `extra(i)` adds fields.
function scriptedMatch(extra = () => ({})) {
  let s = createMatch(fixtureConfig({ overs: 5, seed: 2024 }));
  const out = [];
  let i = 0;
  while (s.status !== 'complete') {
    if (s.status === 'innings_break') { s = startSecondInnings(s); continue; }
    if (s.status === 'awaiting_bowler') { s = setBowler(s, aiChooseBowler(s)); continue; }
    const shot = SHOT_CYCLE[i % 6];
    const bat = shot === 'leave' ? { shot, timingMs: null } : { shot, timingMs: ((i * 37) % 400) - 200 };
    // Stock BowlInput (no pitch/variation), as the AI bowled before phase 4.
    const { line, length, accuracy } = aiBowl(s);
    const r = playBall(s, { line, length, accuracy }, { ...bat, ...extra(i) });
    s = r.state;
    i++;
    out.push(`${r.ball.runs}${r.ball.extra ? r.ball.extra.type[0] : ''}${r.ball.wicket ? 'W' : ''}`);
  }
  return `${out.join(' ')} | ${s.result.text}`;
}

test('leaving the new BatInput fields out scores exactly as before phase 3', () => {
  // v1.3 fingerprint. Up to v1.2 (55f0fe5 to d6eb728) it was
  // '1 1 2 4 6 0 1 6 1 0 0W 0 0 4 2 4 6 0 2 4 4 …| India won by 22 runs'; the
  // first 17 balls still match, then ball 18 scatters past the leg-wide line
  // under the SPEC 15.1 rule and the match goes its own way from there.
  const before = '1 1 2 4 6 0 1 6 1 0 0W 0 0 4 2 4 6 0w 1 4 4 0 0W 0 0 2 4 2 6 0 0 0w 0 0W 0W 0 0 2 4 1 4 0 0 0 0 1 0W 0 0 4 0n 0 1 0 0 1 0 4 6 0 2 1 4n 0W | India won by 24 runs';
  assert.equal(scriptedMatch(), before);
  // Aim and aerial only change where the ball goes, never the score.
  assert.equal(scriptedMatch((i) => ({ offsetX: 0, aimDeg: (i * 53) % 360 - 180, aerial: i % 2 === 0 })), before);
});

test('every six is in the air and carries the rope; every four reaches it', () => {
  let sixes = 0;
  for (let seed = 1; seed <= 60; seed++) {
    for (const inn of simulateMatch(fixtureConfig({ overs: 5, seed })).innings) {
      for (const b of inn.log) {
        if (b.runs === 6) {
          sixes++;
          assert.equal(b.aerial, true);
          assert.ok(b.carryM >= ROPE_M);
        }
        if (b.runs === 4) assert.ok(b.distanceM >= ROPE_M);
        if (b.wicket?.kind === 'caught') assert.ok(b.aerial && b.carryM > 0 && b.carryM === b.distanceM);
        if (b.extra?.type === 'wide' || b.wicket?.kind === 'bowled') assert.equal(b.angleDeg, null);
      }
    }
  }
  assert.ok(sixes > 20);
});

test('angleDeg stays within the timing error band around the aim', () => {
  const s = started();
  let checked = 0;
  for (let seed = 0; seed < 600; seed++) {
    const aimDeg = (seed * 29) % 200 - 100;
    const timingMs = (seed * 13) % 500 - 250; // perfect to early/late, no misses
    const { ball } = playBall({ ...s, rngState: seed }, { line: 'off', length: 'good', accuracy: 1 }, { shot: shotFromAim(aimDeg, false), timingMs, aimDeg });
    if (ball.angleDeg == null || ball.wicket) continue;
    const band = ANGLE_ERROR[ball.timing];
    if (!band) continue;
    let d = ball.angleDeg - aimDeg;
    d = ((d + 540) % 360) - 180;
    assert.ok(d >= band[0] - 1 && d <= band[1] + 1, `${ball.timing} aim ${aimDeg} got ${ball.angleDeg}`);
    checked++;
  }
  assert.ok(checked > 300);
});

test('shot buttons use their default directions', () => {
  const s = started();
  const { ball } = findBall(s, (r) => r.ball.timing === 'perfect' && !r.ball.wicket && !r.ball.extra, { shot: 'pull', timingMs: 0 });
  assert.ok(Math.abs(ball.angleDeg - DEFAULT_AIM.pull) <= 5);
});

test('moving across the crease shifts the line the batter sees', () => {
  assert.equal(effectiveLine('off', 0), 'off');
  assert.equal(effectiveLine('off', -0.3), 'middle');
  assert.equal(effectiveLine('middle', -0.45), 'leg');
  assert.equal(effectiveLine('middle', 0.3), 'off');
  assert.equal(effectiveLine('leg', 0.6), 'middle');
  assert.equal(effectiveLine('off', 0.6), 'off');
});

test('a batter moved to the leg side is bowled more often by a straight ball', () => {
  const bowledRate = (offsetX, bat) => {
    let n = 0;
    const rng = createRng(77);
    for (let i = 0; i < 2000; i++) {
      const r = resolveOutcome({
        delivery: { line: 'middle', length: 'good' },
        bat: { ...bat, offsetX },
        batter: { batting: 60 }, bowler: { bowling: 70 }, difficulty: 'normal', userBatting: true, rng,
      });
      if (r.wicketKind === 'bowled' || r.wicketKind === 'lbw') n++;
    }
    return n / 2000;
  };
  for (const bat of [{ shot: 'leave', timingMs: null }, { shot: 'drive', timingMs: 400 }]) {
    const guard = bowledRate(0, bat);
    const exposed = bowledRate(0.45, bat);
    assert.ok(exposed > guard * 1.5, `${bat.shot}: ${guard} -> ${exposed}`);
  }
});

test('drive commentary follows where the ball went', () => {
  // {how} and {where} fill from the shot angle; the line itself is a template.
  const lines = { four: ['{how} {where}'] };
  const words = { 0: ['straight drive', 'straight down the ground'], [-40]: ['cover drive', 'to cover'], 30: ['on drive', 'to mid-wicket'] };
  for (const [aim, [how, where]] of Object.entries(words)) {
    const text = commentaryFor({ runs: 4, extra: null, wicketKind: null, timing: 'perfect', shot: 'drive', angleDeg: Number(aim) }, { batter: 'A' }, createRng(1), { lines });
    assert.equal(text, `a ${how} ${where}`.replace('a cover', 'a glorious cover').replace('a straight', 'a crisp straight').replace('a on', 'a lovely on'));
  }
  // The in-match line uses the same fill and never leaves a placeholder behind.
  const s = started();
  const { ball } = findBall(s, (r) => r.ball.runs === 4 && !r.ball.extra, { shot: 'drive', timingMs: 0, aimDeg: 0 });
  assert.doesNotMatch(ball.commentary, /[{}]/);
  assert.ok(ball.commentary.length > 10);
});

// ---- Phase 4: landing spot and variations (SPEC 13.3) ----
import { prepareDelivery, lengthFromZ, lineFromX, swungLine } from '../js/engine/outcomes.js';

test('landing spot bucket edges', () => {
  assert.equal(lengthFromZ(2.49), 'yorker');
  assert.equal(lengthFromZ(2.5), 'full');
  assert.equal(lengthFromZ(4.99), 'full');
  assert.equal(lengthFromZ(5), 'good');
  assert.equal(lengthFromZ(7.99), 'good');
  assert.equal(lengthFromZ(8), 'short');
  assert.equal(lineFromX(-0.09), 'off');
  assert.equal(lineFromX(-0.08), 'middle');
  assert.equal(lineFromX(0.08), 'middle');
  assert.equal(lineFromX(0.09), 'leg');
  const bowler = { bowling: 90, bowlType: 'pace' };
  const d = prepareDelivery({ line: 'leg', length: 'short', accuracy: 1, pitch: { x: -0.3, z: 3 } }, bowler, createRng(1));
  assert.equal(d.line, 'off'); // pitch wins over line/length
  assert.equal(d.length, 'full');
  const wide = prepareDelivery({ line: 'off', length: 'good', accuracy: 1, pitch: { x: -0.95, z: 6 } }, bowler, createRng(1));
  assert.equal(wide.extra, 'wide');
});

test('stock deliveries without pitch/variation are unchanged', () => {
  const bowler = { bowling: 70, bowlType: 'pace' };
  for (let seed = 1; seed < 200; seed++) {
    const bowl = { line: 'off', length: 'good', accuracy: (seed % 10) / 10 };
    const plain = prepareDelivery(bowl, bowler, createRng(seed));
    const stock = prepareDelivery({ ...bowl, variation: 'stock' }, bowler, createRng(seed));
    assert.deepEqual(stock, plain);
    assert.equal(plain.pitch, null);
    assert.equal(plain.swingX, 0);
  }
});

test('landing spot scatter grows as accuracy drops', () => {
  const bowler = { bowling: 70, bowlType: 'pace' };
  const spread = (accuracy) => {
    const rng = createRng(5);
    let sx = 0, sz = 0;
    for (let i = 0; i < 2000; i++) {
      const d = prepareDelivery({ line: 'off', length: 'good', accuracy, pitch: { x: -0.2, z: 6 } }, bowler, rng);
      sx += (d.pitch.x + 0.2) ** 2;
      sz += (d.pitch.z - 6) ** 2;
    }
    return [Math.sqrt(sx / 2000), Math.sqrt(sz / 2000)];
  };
  const [x1, z1] = spread(1);
  const [x6, z6] = spread(0.6);
  const [x2, z2] = spread(0.2);
  assert.ok(x1 < 0.01 && z1 < 0.01);
  assert.ok(x6 > x1 && x2 > x6 * 1.5, `${x1} ${x6} ${x2}`);
  assert.ok(z6 > z1 && z2 > z6 * 1.5, `${z1} ${z6} ${z2}`);
});

test('swing/turn shifts the line one step and slower adds 25% to travel time', () => {
  assert.equal(swungLine('off', 'in'), 'middle');
  assert.equal(swungLine('middle', 'out'), 'off');
  assert.equal(swungLine('off', 'out'), 'off');
  for (const bowlType of ['pace', 'spin']) {
    const bowler = { bowling: 80, bowlType };
    for (let seed = 1; seed < 50; seed++) {
      const bowl = { line: 'middle', length: 'good', accuracy: 1 };
      const stock = prepareDelivery(bowl, bowler, createRng(seed));
      const slower = prepareDelivery({ ...bowl, variation: 'slower' }, bowler, createRng(seed));
      assert.equal(slower.travelMs, Math.round(stock.travelMs * 1.25));
      assert.ok(slower.kph < stock.kph);
      const inn = prepareDelivery({ ...bowl, variation: 'in' }, bowler, createRng(seed));
      const out = prepareDelivery({ ...bowl, variation: 'out' }, bowler, createRng(seed));
      assert.equal(inn.line, 'leg');
      assert.equal(out.line, 'off');
      assert.ok(inn.swingX > 0 && out.swingX < 0);
    }
  }
});

test('outswing raises edges and inswing raises bowled/LBW over 2,000 balls', () => {
  const rate = (delivery, bat, kinds) => {
    const rng = createRng(11);
    let n = 0;
    for (let i = 0; i < 2000; i++) {
      const r = resolveOutcome({ delivery, bat, batter: { batting: 65 }, bowler: { bowling: 75 }, difficulty: 'normal', userBatting: true, rng });
      if (kinds.includes(r.wicketKind)) n++;
    }
    return n;
  };
  const edgyDrive = { shot: 'drive', timingMs: 200 };
  const stockEdges = rate({ line: 'off', length: 'good', variation: 'stock' }, edgyDrive, ['caught']);
  const outEdges = rate({ line: 'off', length: 'good', variation: 'out' }, edgyDrive, ['caught']);
  assert.ok(outEdges > stockEdges * 1.3, `${stockEdges} -> ${outEdges}`);

  const defend = { shot: 'defend', timingMs: 400 };
  const stockStumps = rate({ line: 'middle', length: 'good', variation: 'stock' }, defend, ['bowled', 'lbw']);
  const inStumps = rate({ line: 'middle', length: 'good', variation: 'in' }, defend, ['bowled', 'lbw']);
  assert.ok(inStumps > stockStumps * 1.3, `${stockStumps} -> ${inStumps}`);
});

test('the AI bowler uses fine spots and variations about 30% of the time', () => {
  let fancy = 0, total = 0;
  for (let seed = 1; total < 600; seed++) {
    let s = createMatch(fixtureConfig({ overs: 10, seed }));
    while (s.status !== 'complete') {
      if (s.status === 'innings_break') { s = startSecondInnings(s); continue; }
      if (s.status === 'awaiting_bowler') { s = setBowler(s, aiChooseBowler(s)); continue; }
      const bowl = aiBowl(s);
      if (bowl.pitch) {
        fancy++;
        assert.ok(['stock', 'in', 'out', 'slower'].includes(bowl.variation));
      }
      total++;
      s = playBall(s, bowl, aiBat(s, bowl)).state;
    }
  }
  const share = fancy / total;
  assert.ok(share > 0.2 && share < 0.4, `share ${share}`);
});

// ---- SPEC 15: wides from the arrival point, over/around the wicket ----
import { WIDE_X, LEG_WIDE_X, releaseXFor, arrivalFromPitch, VARIATIONS, expectedArrival, EXPECTED_SWING_M } from '../js/engine/outcomes.js';
import { aiSide } from '../js/engine/ai.js';

const PACE = { bowling: 80, bowlType: 'pace' };
const SPOT_Z = { yorker: 1.5, full: 3.8, good: 6.4, short: 9.5 };
const SPOT_X = { off: -0.2, middle: 0, leg: 0.2 };

test('a ball is a wide exactly when it arrives past a wide line', () => {
  let wides = 0;
  for (const line of ['off', 'middle', 'leg']) for (const length of Object.keys(SPOT_Z)) for (const variation of VARIATIONS)
    for (const side of ['over', 'around']) for (const bats of ['R', 'L']) for (const placed of [false, true]) {
      for (let i = 0; i < 120; i++) {
        const bowl = { line, length, variation, side, accuracy: (i % 10) / 10 };
        if (placed) bowl.pitch = { x: SPOT_X[line], z: SPOT_Z[length] };
        const d = prepareDelivery(bowl, PACE, createRng(i * 104729 + 7), { bats });
        const past = d.arrivalX < WIDE_X || d.arrivalX > LEG_WIDE_X;
        if (d.extra === 'noball') continue; // a no-ball is called first
        assert.equal(d.extra === 'wide', past, `${line} ${length} ${variation} ${side} ${bats} arrivalX ${d.arrivalX}`);
        if (Math.abs(d.arrivalX) <= 0.2 || (d.arrivalX < 0 && d.arrivalX >= -0.45)) assert.notEqual(d.extra, 'wide');
        if (d.extra === 'wide') wides++;
      }
    }
  assert.ok(wides > 0, 'wides still happen through scatter');
});

test('a yorker on middle at full accuracy is never a wide', () => {
  for (const side of ['over', 'around']) for (const bats of ['R', 'L']) for (const variation of VARIATIONS) {
    for (let i = 0; i < 300; i++) {
      const rng = () => createRng(i * 7919 + 3);
      for (const pitch of [undefined, { x: 0, z: 1.5 }]) {
        const d = prepareDelivery({ line: 'middle', length: 'yorker', accuracy: 1, variation, side, pitch }, PACE, rng(), { bats });
        assert.notEqual(d.extra, 'wide', `${side} ${bats} ${variation} ${pitch ? 'placed' : 'button'} arrivalX ${d.arrivalX}`);
      }
    }
  }
});

test('over and around set the release point, mirrored for a left-hander', () => {
  const d = (bowl, bats) => prepareDelivery({ line: 'off', length: 'good', ...bowl }, PACE, createRng(1), { bats });
  assert.equal(d({}, 'R').side, 'over');
  assert.equal(d({}, 'R').releaseX, -0.25);
  assert.equal(d({}, 'L').releaseX, 0.25);
  assert.equal(d({ side: 'around' }, 'R').releaseX, 0.85);
  assert.equal(d({ side: 'around' }, 'L').releaseX, -0.85);
  assert.equal(d({}, 'R').angle, null, 'no side given: plays as v1.2');
  // Released from the off side the ball angles in; from the leg side, across.
  assert.equal(d({ side: 'over' }, 'R').angle, 'in');
  assert.equal(d({ side: 'around' }, 'L').angle, 'in');
  assert.equal(d({ side: 'around' }, 'R').angle, 'across');
  assert.equal(d({ side: 'over' }, 'L').angle, 'across');
  // A placed ball carries on along its line from the release point.
  const placed = d({ side: 'around', pitch: { x: 0, z: 6.4 }, accuracy: 1 }, 'R');
  assert.ok(Math.abs(placed.arrivalX - Math.round(arrivalFromPitch(0.85, 0, 6.4) * 100) / 100) < 1e-9);
  assert.ok(placed.arrivalX < 0, 'from around, a ball pitched on middle goes on across the right-hander');
  assert.equal(releaseXFor('nonsense', 'R'), -0.25);
});

test('angling in finds more bowled and lbw on a straight line', () => {
  const count = (angle) => {
    let outs = 0;
    for (let i = 0; i < 6000; i++) {
      const r = resolveOutcome({
        delivery: { line: 'middle', length: 'good', kph: 135, travelMs: 600, extra: null, variation: 'stock', angle },
        bat: { shot: 'drive', timingMs: (i % 9) * 40 - 160 },
        batter: { batting: 60 }, bowler: { bowling: 70 }, difficulty: 'normal', userBatting: false, rng: createRng(i + 11),
      });
      if (r.wicketKind === 'bowled' || r.wicketKind === 'lbw') outs++;
    }
    return outs;
  };
  const plain = count(null);
  const angled = count('in');
  assert.ok(angled > plain, `${angled} vs ${plain}`);
  assert.ok(angled < plain * 1.4, 'only a little');
});

test('the AI goes around for about 15% of overs to right-handers and 30% to left-handers', () => {
  for (const [bats, want] of [['R', 0.15], ['L', 0.3]]) {
    const team = (t) => ({ ...t, players: t.players.map((p) => ({ ...p, bats })) });
    let around = 0, overs = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const s = createMatch(fixtureConfig({ seed, overs: 10, userTeam: team(fixtureConfig().userTeam), aiTeam: team(fixtureConfig().aiTeam) }));
      for (let over = 0; over < 10; over++) {
        const st = { ...s, innings: [{ ...s.innings[0], legalBalls: over * 6 }] };
        if (aiSide(st) === 'around') around++;
        overs++;
      }
    }
    assert.ok(Math.abs(around / overs - want) < 0.05, `${bats}: ${around / overs}`);
  }
});

test('commentary notes a bowler switching sides', () => {
  let s = setBowler(createMatch(fixtureConfig({ seed: 5 })), aiChooseBowler(createMatch(fixtureConfig({ seed: 5 }))));
  const bat = { shot: 'defend', timingMs: 0 };
  const play = (side) => {
    const r = playBall(s, { line: 'off', length: 'good', accuracy: 1, side }, bat);
    s = r.state;
    return r.ball.commentary;
  };
  assert.doesNotMatch(play('over'), /switches/);
  assert.match(play('around'), /switches to around the wicket\./);
  assert.doesNotMatch(play('around'), /switches/);
  assert.match(play('over'), /switches to over the wicket\./);
});

test('AI vs AI wides per over stay close to v1.2 (0.196 on Normal)', () => {
  const team = (t) => ({ ...t, players: t.players.map((p, i) => ({ ...p, bats: i % 3 === 1 ? 'L' : 'R' })) });
  let wides = 0, legal = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const s = simulateMatch(fixtureConfig({ seed, overs: 5, userTeam: team(fixtureConfig().userTeam), aiTeam: team(fixtureConfig().aiTeam) }));
    for (const inn of s.innings) { wides += inn.extras.wides; legal += inn.legalBalls; }
  }
  const perOver = wides / (legal / 6);
  assert.ok(perOver > 0.137 && perOver < 0.255, `wides per over ${perOver}`);
});

test('a scattered ball always pitches in front of the crease', () => {
  for (let i = 0; i < 3000; i++) {
    const d = prepareDelivery({ line: 'middle', length: 'yorker', accuracy: 0, pitch: { x: 0, z: 0.5 } }, { bowling: 20 }, createRng(i + 1));
    assert.ok(d.pitch.z >= 1.5, `pitched at ${d.pitch.z}`);
  }
});

test('expectedArrival matches the engine at 100% accuracy for every ball', () => {
  const TOP = { bowling: 100, bowlType: 'pace' };
  let wides = 0;
  for (const line of ['off', 'middle', 'leg']) for (const length of Object.keys(SPOT_Z)) for (const variation of VARIATIONS)
    for (const side of ['over', 'around']) for (const bats of ['R', 'L']) for (const pitch of [undefined, { x: SPOT_X[line], z: SPOT_Z[length] }, { x: -0.9, z: 12 }, { x: 0.6, z: 1.5 }]) {
      const bowl = { line, length, variation, side, accuracy: 1, pitch };
      const want = expectedArrival(bowl, bats);
      for (let i = 0; i < 20; i++) {
        const d = prepareDelivery(bowl, TOP, createRng(i * 31 + 5), { bats });
        assert.ok(Math.abs(d.arrivalX - want.x) <= 0.011, `${line} ${length} ${variation} ${side} ${bats} ${JSON.stringify(pitch)}: ${d.arrivalX} vs ${want.x}`);
        assert.equal(want.releaseX, d.releaseX);
        if (want.wide) wides++;
      }
    }
  assert.ok(wides > 0, 'some far-corner spots arrive wide');
  assert.equal(expectedArrival({ line: 'middle', length: 'yorker' }, 'R').wide, false);
  assert.equal(expectedArrival({ pitch: { x: -0.9, z: 12 }, side: 'around' }, 'R').wide, true);
  assert.ok(Math.abs(expectedArrival({ pitch: { x: 0, z: 6.4 }, variation: 'in' }, 'R').x - expectedArrival({ pitch: { x: 0, z: 6.4 } }, 'R').x - EXPECTED_SWING_M) < 0.011);
});

test('swing is exactly the average at full accuracy and spreads to 0.25..0.40 as the meter is missed', () => {
  const amounts = (accuracy) => Array.from({ length: 400 }, (_, i) => Math.abs(prepareDelivery({ line: 'off', length: 'good', variation: 'in', accuracy }, { bowling: 100 }, createRng(i + 1)).swingX));
  for (const a of amounts(1)) assert.ok(Math.abs(a - 0.325) <= 0.006, `${a}`);
  const loose = amounts(0);
  assert.ok(Math.min(...loose) < 0.27 && Math.max(...loose) > 0.38);
  for (const a of loose) assert.ok(a >= 0.25 && a <= 0.4);
});
