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
    const r = playBall(s, aiBowl(s), { ...bat, ...extra(i) });
    s = r.state;
    i++;
    out.push(`${r.ball.runs}${r.ball.extra ? r.ball.extra.type[0] : ''}${r.ball.wicket ? 'W' : ''}`);
  }
  return `${out.join(' ')} | ${s.result.text}`;
}

test('leaving the new BatInput fields out scores exactly as before phase 3', () => {
  // Captured from the engine at 55f0fe5, before offsetX/aimDeg/aerial existed.
  const before = '1 1 2 4 6 0 1 6 1 0 0W 0 0 4 2 4 6 0 2 4 4 0 0W 0 0 2 4 2 6 0 0 2 1 0W 6 0 0 4 2 2 1 0W 0 0 1 4 6 0 0 1 0W 1 0w 0 0 1 1 2 4 0 0 | India won by 22 runs';
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
