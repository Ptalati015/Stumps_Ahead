// QA invariants: play many full AI-vs-AI matches across every config and check
// the scorecards add up and the rules hold on every ball.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, playBall, setBowler, startSecondInnings, aiBowl, aiBat, aiChooseBowler,
  oversText, runRate, chaseInfo, BALLS_PER_OVER } from '../js/engine/match.js';
import { fixtureConfig } from './fixtures.js';

const configs = [];
for (const overs of [2, 5, 10]) {
  for (const battingFirst of ['user', 'ai']) {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      for (let seed = 1; seed <= 15; seed++) configs.push({ overs, battingFirst, difficulty, seed });
    }
  }
}

// Plays a match, checking per-ball rules on the way, and returns the final state.
function playChecked(config) {
  let state = createMatch(fixtureConfig(config));
  const overBowlers = [[], []];
  for (let guard = 0; state.status !== 'complete'; guard++) {
    assert.ok(guard < 3000, 'match never finished');
    if (state.status === 'innings_break') {
      state = startSecondInnings(state);
    } else if (state.status === 'awaiting_bowler') {
      const id = aiChooseBowler(state);
      const list = overBowlers[state.current];
      assert.notEqual(list.at(-1), id, 'same bowler twice in a row');
      list.push(id);
      state = setBowler(state, id);
    } else {
      const before = state.innings[state.current];
      const bowl = aiBowl(state);
      const { state: next, ball } = playBall(state, bowl, aiBat(state, bowl));
      const inn = next.innings[state.current];
      assert.ok(inn.strikerId !== inn.nonStrikerId, 'striker and non-striker are the same player');
      assert.ok(inn.legalBalls - before.legalBalls === (ball.extra ? 0 : 1));
      assert.match(oversText(inn), /^\d+\.[0-5]$/);
      assert.ok(Number.isFinite(runRate(inn)));
      if (before.target != null) assert.ok(before.runs < before.target, 'ball bowled after target reached');
      state = next;
    }
  }
  return state;
}

test('scorecards add up and rules hold over 270 full matches', () => {
  for (const config of configs) {
    const state = playChecked(config);
    const label = JSON.stringify(config);
    const [first, second] = state.innings;
    assert.equal(second.target, first.runs + 1, label);
    for (const inn of state.innings) {
      const bat = Object.values(inn.batting);
      const bowl = Object.values(inn.bowling);
      const extras = inn.extras.wides + inn.extras.noballs;
      assert.equal(bat.reduce((s, c) => s + c.runs, 0) + extras, inn.runs, `batter runs + extras = total ${label}`);
      assert.equal(bowl.reduce((s, c) => s + c.runs, 0), inn.runs, `bowler runs = total ${label}`);
      assert.equal(bowl.reduce((s, c) => s + c.balls, 0), inn.legalBalls, `bowler balls = legal balls ${label}`);
      assert.equal(bat.filter((c) => c.howOut).length, inn.wickets, `dismissed batters = wickets ${label}`);
      assert.ok(inn.wickets <= 10 && inn.legalBalls <= config.overs * BALLS_PER_OVER, label);
      assert.ok(bat.length <= 11 && bat.length === Math.min(11, inn.wickets + 2), `batters used ${label}`);
      for (const c of bowl) assert.ok(c.balls <= Math.max(2, Math.ceil(config.overs / 5)) * BALLS_PER_OVER, label);
      // The innings ended for a reason.
      const ended = inn.wickets === 10 || inn.legalBalls === config.overs * BALLS_PER_OVER
        || (inn.target != null && inn.runs >= inn.target);
      assert.ok(ended, `innings ended early ${label}`);
    }
    const { result } = state;
    if (second.runs >= second.target) assert.match(result.text, / won by (1 wicket|\d+ wickets)$/, label);
    else if (second.runs === first.runs) assert.equal(result.text, 'Match tied', label);
    else assert.match(result.text, / won by (1 run|\d+ runs)$/, label);
  }
});

test('chaseInfo never returns NaN or Infinity', () => {
  const state = startSecondInnings(playToBreak(fixtureConfig()));
  const info = chaseInfo(state);
  assert.equal(info.runsNeeded, state.innings[1].target);
  assert.ok(Number.isFinite(info.requiredRate));
});

function playToBreak(config) {
  let state = createMatch(config);
  while (state.status !== 'innings_break') {
    if (state.status === 'awaiting_bowler') state = setBowler(state, aiChooseBowler(state));
    else { const b = aiBowl(state); state = playBall(state, b, aiBat(state, b)).state; }
  }
  return state;
}
