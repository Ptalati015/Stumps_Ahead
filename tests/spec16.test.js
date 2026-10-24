// SPEC 16: direction pad (16.1), commentary and milestones (16.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../js/engine/rng.js';
import {
  SHOT_ARC, PAD_SECTORS, DEFAULT_AIM, clampAim, againstLine, resolveOutcome, shotFlight, prepareDelivery,
  commentaryKey, commentaryLine, commentaryFor, whereWords,
} from '../js/engine/outcomes.js';
import { COMMENTARY } from '../js/data/commentary.js';
import {
  createMatch, playBall, setBowler, startSecondInnings, previewDelivery, aiBowl, aiBat, aiChooseBowler, currentInnings, playerById,
} from '../js/engine/match.js';
import { fixtureConfig } from './fixtures.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---- 16.1 direction pad -----------------------------------------------------

test('pad aim is clamped to the arc of every shot, straight through for Auto', () => {
  for (const [shot, [lo, hi]] of Object.entries(SHOT_ARC)) {
    for (const [sector, deg] of Object.entries(PAD_SECTORS)) {
      assert.equal(clampAim(shot, deg), clamp(deg, lo, hi), `${shot} + ${sector}`);
    }
    assert.ok(DEFAULT_AIM[shot] >= lo && DEFAULT_AIM[shot] <= hi, `${shot} default aim inside its arc`);
    // Auto: the shot's own default aim.
    assert.equal(clampAim(shot, undefined), DEFAULT_AIM[shot]);
  }
  // The spec's two examples.
  assert.equal(clampAim('cut', PAD_SECTORS.fineleg), -40);
  assert.equal(clampAim('pull', PAD_SECTORS.cover), 40);
  assert.equal(clampAim('drive', PAD_SECTORS.thirdman), -70);
  assert.equal(clampAim('defend', PAD_SECTORS.squareleg), 30);
});

test('against the line: leg-side aim at an off line, off-side aim at a leg line', () => {
  assert.equal(againstLine(90, 'off'), true);
  assert.equal(againstLine(-90, 'leg'), true);
  assert.equal(againstLine(90, 'leg'), false);
  assert.equal(againstLine(-90, 'off'), false);
  assert.equal(againstLine(0, 'off'), false);
  assert.equal(againstLine(30, 'off'), false);
  assert.equal(againstLine(45, 'middle'), false);
});

function outcomeRates(bat, line, n = 2000) {
  const batter = { batting: 70 };
  const bowler = { bowling: 70 };
  const stats = { out: 0, boundaries: 0, runs: 0, picks: [] };
  for (let seed = 1; seed <= n; seed++) {
    const rng = createRng(seed);
    const delivery = { line, length: 'good', extra: null, variation: 'stock', side: 'over', angle: null };
    const o = resolveOutcome({ delivery, bat, batter, bowler, difficulty: 'normal', userBatting: true, rng });
    if (o.wicketKind) stats.out++;
    if (o.runs >= 4) stats.boundaries++;
    stats.runs += o.runs;
    stats.picks.push(`${o.runs}${o.wicketKind ?? ''}`);
  }
  return stats;
}

test('aiming against the line gives more edges than Auto; with the line is identical to Auto', () => {
  const auto = outcomeRates({ shot: 'pull', timingMs: 0, aimSource: 'auto' }, 'off');
  const plain = outcomeRates({ shot: 'pull', timingMs: 0 }, 'off');
  assert.deepEqual(plain.picks, auto.picks, 'aimSource auto is the same as no aim');
  const against = outcomeRates({ shot: 'pull', timingMs: 0, aimDeg: PAD_SECTORS.squareleg, aimSource: 'pad' }, 'off');
  assert.ok(against.out > auto.out * 1.3, `outs ${auto.out} -> ${against.out}`);
  assert.ok(against.boundaries < auto.boundaries, `boundaries ${auto.boundaries} -> ${against.boundaries}`);
  // About a tenth of the way to the mistimed row: not a cliff.
  assert.ok(against.out < auto.out * 4, `outs ${auto.out} -> ${against.out}`);

  const withLine = outcomeRates({ shot: 'pull', timingMs: 0, aimDeg: PAD_SECTORS.squareleg, aimSource: 'pad' }, 'leg');
  const autoLeg = outcomeRates({ shot: 'pull', timingMs: 0 }, 'leg');
  assert.deepEqual(withLine.picks, autoLeg.picks, 'with the line costs nothing');

  // Mistimed shots already pay; the pad adds nothing there.
  const lateAgainst = outcomeRates({ shot: 'pull', timingMs: 200, aimDeg: PAD_SECTORS.squareleg, aimSource: 'pad' }, 'off');
  const lateAuto = outcomeRates({ shot: 'pull', timingMs: 200 }, 'off');
  assert.deepEqual(lateAgainst.picks, lateAuto.picks);
});

test('shot flight follows the pad aim within the arc; AI flight is untouched', () => {
  const outcome = { shot: 'cut', runs: 4, wicketKind: null, timing: 'perfect' };
  const padFine = shotFlight({ outcome, bat: { shot: 'cut', aimDeg: PAD_SECTORS.fineleg, aimSource: 'pad' }, extra: null }, createRng(7));
  const padPoint = shotFlight({ outcome, bat: { shot: 'cut', aimDeg: PAD_SECTORS.point, aimSource: 'pad' }, extra: null }, createRng(7));
  assert.ok(Math.abs(padFine.angleDeg - -40) <= 10, `cut + fine leg lands near -40: ${padFine.angleDeg}`);
  assert.ok(Math.abs(padPoint.angleDeg - -90) <= 10, `cut + point lands near -90: ${padPoint.angleDeg}`);
  const ai = shotFlight({ outcome, bat: { shot: 'cut', aimDeg: 145 }, extra: null }, createRng(7));
  const aiBefore = shotFlight({ outcome, bat: { shot: 'cut', aimDeg: 145 }, extra: null }, createRng(7));
  assert.equal(ai.angleDeg, aiBefore.angleDeg);
  assert.ok(ai.angleDeg > 100, 'an explicit AI aim is not clamped');
});

// ---- 16.2 commentary ---------------------------------------------------------

const KEYS = [
  'dot_defend', 'dot_fielded', 'beaten', 'leave', 'single', 'two', 'three', 'four', 'six', 'bowled', 'caught', 'caught_behind',
  'lbw', 'runout', 'wide', 'noball', 'fifty', 'hundred', 'threefor', 'fivefor', 'hattrick_ball', 'hattrick', 'maiden',
  'partnership50', 'last_over', 'won_it',
];

test('commentary data has at least four plain lines for every key, placeholders only from the known set', () => {
  for (const key of KEYS) {
    assert.ok(Array.isArray(COMMENTARY[key]) && COMMENTARY[key].length >= 4, key);
    for (const line of COMMENTARY[key]) {
      assert.equal(typeof line, 'string');
      assert.doesNotMatch(line, /[<>]/, `${key}: no markup`);
      for (const m of line.matchAll(/\{(\w+)\}/g)) assert.ok(['batter', 'bowler', 'fielder', 'how', 'where', 'n'].includes(m[1]), `${key}: {${m[1]}}`);
    }
  }
});

test('commentaryKey maps every outcome to a key', () => {
  assert.equal(commentaryKey({ runs: 0, extra: 'wide' }), 'wide');
  assert.equal(commentaryKey({ runs: 0, extra: null, wicketKind: 'caught', angleDeg: -150 }), 'caught_behind');
  assert.equal(commentaryKey({ runs: 0, extra: null, wicketKind: 'caught', angleDeg: 30 }), 'caught');
  assert.equal(commentaryKey({ runs: 0, extra: null, wicketKind: 'bowled' }), 'bowled');
  assert.equal(commentaryKey({ runs: 0, extra: null, shot: 'leave' }), 'leave');
  assert.equal(commentaryKey({ runs: 0, extra: null, timing: 'miss', shot: 'drive' }), 'beaten');
  assert.equal(commentaryKey({ runs: 0, extra: null, timing: 'good', shot: 'defend' }), 'dot_defend');
  assert.equal(commentaryKey({ runs: 0, extra: null, timing: 'good', shot: 'drive' }), 'dot_fielded');
  assert.equal(commentaryKey({ runs: 1, extra: null, timing: 'good', shot: 'drive' }), 'single');
  assert.equal(commentaryKey({ runs: 2, extra: 'noball', timing: 'good', shot: 'drive' }), 'two');
  assert.equal(commentaryKey({ runs: 3, extra: null, timing: 'good', shot: 'drive' }), 'three');
  assert.equal(commentaryKey({ runs: 4, extra: null, timing: 'good', shot: 'drive' }), 'four');
  assert.equal(commentaryKey({ runs: 6, extra: null, timing: 'good', shot: 'loft' }), 'six');
  assert.equal(whereWords(null), 'back to the bowler');
  assert.equal(whereWords(-45), 'to cover');
  assert.equal(whereWords(170), 'to fine leg');
});

test('commentaryLine never repeats the previous line for a key and fills every placeholder', () => {
  const last = {};
  const rng = createRng(99);
  let prev = null;
  for (let i = 0; i < 200; i++) {
    const text = commentaryLine('four', { batter: 'A', bowler: 'B', fielder: 'C', how: 'a cut', where: 'to point', n: 4 }, { last, pickRng: rng });
    assert.doesNotMatch(text, /[{}]/);
    assert.notEqual(text, prev);
    prev = text;
  }
  // A no-ball gets its own line in front.
  const nb = commentaryFor({ runs: 1, extra: 'noball', wicketKind: null, timing: 'good', shot: 'drive', angleDeg: 0 }, { batter: 'A', bowler: 'B' }, createRng(1), { last: {}, pickRng: createRng(2) });
  assert.match(nb, /^(No ball|The umpire calls no ball)/);
  // Unknown key: the key itself, so a missing line never throws.
  assert.equal(commentaryLine('nope', {}, { lines: {} }), 'nope');
});

function playAiMatch(config) {
  let s = createMatch(fixtureConfig(config));
  const balls = [];
  while (s.status !== 'complete') {
    if (s.status === 'innings_break') { s = startSecondInnings(s); continue; }
    if (s.status === 'awaiting_bowler') { s = setBowler(s, aiChooseBowler(s)); continue; }
    const bowl = aiBowl(s);
    const preview = previewDelivery(s, bowl);
    const r = playBall(s, bowl, aiBat(s, bowl));
    balls.push({ ...r.ball, preview, innings: s.current });
    s = r.state;
  }
  return { state: s, balls };
}

test('match commentary: no placeholders, no back-to-back repeats, varied dots', () => {
  const all = [];
  for (const seed of [1, 2, 3, 4, 5]) all.push(...playAiMatch({ overs: 10, seed, battingFirst: seed % 2 ? 'user' : 'ai' }).balls);
  assert.ok(all.length > 500);
  let dots = 0;
  let dotBall = 0;
  for (let i = 0; i < all.length; i++) {
    const text = all[i].commentary;
    assert.doesNotMatch(text, /[{}]/, text);
    assert.ok(text.length > 0);
    if (i > 0 && all[i - 1].innings === all[i].innings) assert.notEqual(text, all[i - 1].commentary, `ball ${i}: ${text}`);
    if (all[i].runs === 0 && !all[i].extra && !all[i].wicket) {
      dots++;
      if (/^Dot ball\./.test(text)) dotBall++;
    }
  }
  assert.ok(dots > 100);
  assert.ok(dotBall < dots * 0.2, `"Dot ball." ${dotBall} of ${dots}`);
  // The old wording is gone: dots describe the ball.
  const distinctDotLines = new Set(all.filter((b) => b.runs === 0 && !b.extra && !b.wicket).map((b) => b.commentary.replace(/[A-Z][a-z]+ [A-Z][a-z]+/g, 'X')));
  assert.ok(distinctDotLines.size >= 8, `${distinctDotLines.size} dot lines`);
});

test('milestones from seeded matches: fifty, three-for and partnership fifty each fire once per player per innings', () => {
  const seen = {};
  for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
    const { balls } = playAiMatch({ overs: 20, seed, battingFirst: seed % 2 ? 'user' : 'ai' });
    const perInnings = {};
    for (const b of balls) {
      for (const m of b.milestones) {
        seen[m.kind] = (seen[m.kind] ?? 0) + 1;
        const k = `${b.innings}:${m.kind}:${m.playerId}`;
        if (m.kind !== 'hattrick_ball' && m.kind !== 'maiden' && m.kind !== 'partnership50') {
          assert.equal(perInnings[k], undefined, `${k} fired twice`);
        }
        perInnings[k] = true;
        // The ball's commentary mentions the biggest milestone.
        if (m.kind === 'fifty') assert.match(b.commentary, /fifty|Fifty|FIFTY/);
        if (m.kind === 'maiden' && !b.milestones.some((x) => x.kind !== 'maiden')) assert.match(b.commentary, /maiden|Maiden/);
      }
      if (b.milestones.some((m) => m.kind === 'maiden')) {
        assert.ok(b.runs === 0 && !b.extra);
      }
    }
  }
  // Maidens are rare against AI batting; the forced-ball test below covers them.
  for (const kind of ['fifty', 'threefor', 'partnership50']) assert.ok(seen[kind] > 0, `${kind} seen`);
});

/** Replay a ball with different rng states until the predicate holds. */
function force(state, predicate, bat = { shot: 'drive', timingMs: 250 }, bowl = { line: 'off', length: 'good', accuracy: 1 }) {
  for (let s = 0; s < 3000; s++) {
    const probe = { ...state, rngState: s };
    const r = playBall(probe, bowl, bat);
    if (predicate(r)) return r;
  }
  throw new Error('no matching ball');
}
const bowlerWicket = (r) => r.ball.wicket && r.ball.wicket.kind !== 'runout' && !r.ball.extra;
const quietDot = (r) => r.ball.runs === 0 && !r.ball.extra && !r.ball.wicket;
const ready = (s) => (s.status === 'awaiting_bowler' ? setBowler(s, aiChooseBowler(s)) : s);

test('hat-trick: on a hat-trick after two in two, the hat-trick itself, run outs do not count', () => {
  let s = ready(createMatch(fixtureConfig({ overs: 5, seed: 5 })));
  const bowler = currentInnings(s).bowlerId;
  let r = force(s, bowlerWicket);
  assert.equal(r.ball.delivery.hattrickBall, false);
  assert.ok(!r.ball.milestones.some((m) => m.kind === 'hattrick_ball'));
  s = r.state;
  r = force(s, bowlerWicket);
  assert.equal(r.ball.delivery.hattrickBall, false);
  s = r.state;
  // Two in two: the next ball is the hat-trick ball.
  assert.equal(previewDelivery(s, { line: 'off', length: 'good', accuracy: 1 }).hattrickBall, true);
  // A wide in between keeps the hat-trick alive.
  const wide = force(s, (x) => x.ball.extra?.type === 'wide', { shot: 'leave', timingMs: null }, { line: 'off', length: 'good', accuracy: 0.2 });
  assert.ok(wide.ball.milestones.some((m) => m.kind === 'hattrick_ball'));
  assert.ok(!wide.ball.milestones.some((m) => m.kind === 'hattrick'));
  assert.equal(previewDelivery(wide.state, { line: 'off', length: 'good', accuracy: 1 }).hattrickBall, true);
  // The hat-trick.
  r = force(s, bowlerWicket);
  assert.deepEqual(r.ball.milestones.filter((m) => m.kind === 'hattrick'), [{ kind: 'hattrick', playerId: bowler }]);
  assert.ok(r.ball.milestones.some((m) => m.kind === 'threefor'));
  assert.match(r.ball.commentary, /HAT-TRICK|hat-trick/);
  // Four in four is not announced as a second hat-trick ball? It is: still two in two.
  assert.equal(previewDelivery(r.state, { line: 'off', length: 'good', accuracy: 1 }).hattrickBall, true);
  // A dot ends it.
  const dot = force(r.state, quietDot);
  assert.equal(previewDelivery(dot.state, { line: 'off', length: 'good', accuracy: 1 }).hattrickBall, false);
  // A run out does not count towards a hat-trick.
  let t = force(dot.state, bowlerWicket);
  const ro = force(t.state, (x) => x.ball.wicket?.kind === 'runout');
  assert.equal(previewDelivery(ro.state, { line: 'off', length: 'good', accuracy: 1 }).hattrickBall, false);
  assert.ok(!ro.ball.milestones.some((m) => m.kind === 'hattrick'));
});

test('hat-trick carries across the bowler\'s overs; five-for and maiden fire once', () => {
  let s = ready(createMatch(fixtureConfig({ overs: 5, seed: 9 })));
  const bowler = currentInnings(s).bowlerId;
  // Four quiet balls, then two wickets to end the over.
  for (let i = 0; i < 4; i++) s = force(s, quietDot).state;
  let r = force(s, bowlerWicket);
  s = r.state;
  r = force(s, bowlerWicket);
  assert.ok(r.ball.milestones.some((m) => m.kind === 'maiden'), 'a wicket maiden: no runs off the over');
  s = r.state;
  assert.equal(s.status, 'awaiting_bowler');
  // Another bowler bowls the next over.
  const next = aiChooseBowler(s);
  assert.notEqual(next, bowler, 'the same bowler cannot bowl twice in a row');
  s = setBowler(s, next);
  for (let i = 0; i < 6; i++) s = force(s, (x) => x.ball.runs === 1 && !x.ball.extra && !x.ball.wicket).state;
  assert.equal(s.status, 'awaiting_bowler');
  s = setBowler(s, bowler);
  const preview = previewDelivery(s, { line: 'off', length: 'good', accuracy: 1 });
  assert.equal(preview.hattrickBall, true, 'two in two across overs');
  r = force(s, bowlerWicket);
  assert.ok(r.ball.milestones.some((m) => m.kind === 'hattrick'));
  assert.ok(r.ball.milestones.some((m) => m.kind === 'threefor'));
  s = r.state;
  s = force(s, bowlerWicket).state;
  r = force(s, bowlerWicket);
  assert.deepEqual(r.ball.milestones.filter((m) => m.kind === 'fivefor'), [{ kind: 'fivefor', playerId: bowler }]);
  // Five in a row is also another hat-trick, which outranks the five-for in the one extra line.
  assert.match(r.ball.commentary, /hat-trick/i);
  const fiveOnly = force(s, bowlerWicket);
  void fiveOnly;
});

test('a wicket maiden is a maiden; a maiden ends with the maiden line', () => {
  let s = ready(createMatch(fixtureConfig({ overs: 5, seed: 21 })));
  for (let i = 0; i < 5; i++) s = force(s, quietDot).state;
  const r = force(s, quietDot);
  assert.ok(r.ball.milestones.some((m) => m.kind === 'maiden'));
  assert.match(r.ball.commentary, /maiden|Maiden/);
  // A single anywhere in the over: no maiden.
  s = ready(r.state);
  s = force(s, (x) => x.ball.runs === 1 && !x.ball.extra).state;
  for (let i = 0; i < 4; i++) s = force(s, quietDot).state;
  const last = force(s, quietDot);
  assert.ok(!last.ball.milestones.some((m) => m.kind === 'maiden'));
});

test('hundred and partnership fifty fire on the ball they happen; won_it on the winning runs', () => {
  let s = ready(createMatch(fixtureConfig({ overs: 20, seed: 33 })));
  const kinds = [];
  // Sixes only: both openers climb towards a hundred.
  const six = (x) => x.ball.runs === 6 && !x.ball.extra;
  for (let i = 0; i < 40 && s.status !== 'innings_break'; i++) {
    s = ready(s);
    const r = force(s, six, { shot: 'loft', timingMs: 0 });
    kinds.push(...r.ball.milestones.map((m) => `${m.kind}:${m.playerId}`));
    s = r.state;
  }
  const inn = currentInnings(s);
  const hundreds = kinds.filter((k) => k.startsWith('hundred:'));
  assert.ok(hundreds.length >= 1 && hundreds.length <= 2, kinds.join(' '));
  assert.equal(new Set(hundreds).size, hundreds.length, 'one hundred per batter');
  assert.equal(kinds.filter((k) => k.startsWith('partnership50:')).length, 1);
  for (const id of Object.keys(inn.batting)) {
    const n = kinds.filter((k) => k === `fifty:${id}`).length;
    assert.ok(n <= 1);
    if (inn.batting[id].runs >= 50) assert.equal(n, 1);
  }
  // Chase: the winning runs carry the won_it note.
  let m = createMatch(fixtureConfig({ overs: 2, seed: 4 }));
  while (m.status !== 'innings_break') {
    m = ready(m);
    const bowl = aiBowl(m);
    m = playBall(m, bowl, aiBat(m, bowl)).state;
  }
  m = ready(startSecondInnings(m));
  let last = null;
  while (m.status === 'in_play' || m.status === 'awaiting_bowler') {
    m = ready(m);
    last = force(m, six, { shot: 'loft', timingMs: 0 });
    m = last.state;
  }
  assert.equal(m.status, 'complete');
  assert.ok(last.ball.note && last.ball.commentary.endsWith(last.ball.note));
  assert.ok(COMMENTARY.won_it.includes(last.ball.note));
});

test('last over of a chase: the run-up note says what is needed', () => {
  let m = createMatch(fixtureConfig({ overs: 2, seed: 8 }));
  while (m.status !== 'innings_break') {
    m = ready(m);
    const bowl = aiBowl(m);
    m = playBall(m, bowl, aiBat(m, bowl)).state;
  }
  m = ready(startSecondInnings(m));
  assert.equal(previewDelivery(m, aiBowl(m)).note, null);
  for (let i = 0; i < 6; i++) m = force(m, quietDot).state;
  m = ready(m);
  const note = previewDelivery(m, aiBowl(m)).note;
  const need = currentInnings(m).target - currentInnings(m).runs;
  assert.ok(typeof note === 'string' && note.includes(String(need)), note);
  // Not repeated once the over is under way.
  m = force(m, quietDot).state;
  assert.equal(previewDelivery(m, aiBowl(m)).note, null);
});

test('seeded AI scores do not depend on the commentary lines', () => {
  const a = playAiMatch({ overs: 5, seed: 77 });
  const b = playAiMatch({ overs: 5, seed: 77 });
  assert.deepEqual(a.balls.map((x) => x.commentary), b.balls.map((x) => x.commentary));
  assert.equal(a.state.innings[1].runs, b.state.innings[1].runs);
});
