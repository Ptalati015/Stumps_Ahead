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
