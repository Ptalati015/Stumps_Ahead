// Computer opponent: picks bowlers, deliveries and shots. Pure and repeatable:
// choices come from a stream forked off the match's rng state, so calling a
// helper twice on the same state gives the same answer.
import { clamp, forkRng } from './rng.js';
import { difficultyFactor } from './outcomes.js';
import {
  availableBowlers, chaseInfo, currentInnings, playerById,
  previewDelivery, teamByCode, totalBalls, BALLS_PER_OVER,
} from './match.js';

const SALT_BOWLER = 0xb0b1;
const SALT_BOWL = 0xb0b2;
const SALT_BAT = 0xba77;

/** Rotate through the five best bowlers, preferring whoever has bowled least. */
export function aiChooseBowler(state) {
  const inn = currentInnings(state);
  const legal = availableBowlers(state);
  if (legal.length === 0) throw new Error('aiChooseBowler: nobody can bowl');
  const team = teamByCode(state, inn.bowlingTeam);
  const topFive = [...team.players].filter((p) => p.role !== 'WK').sort((a, b) => b.bowling - a.bowling).slice(0, 5).map((p) => p.id);
  const pool = legal.filter((p) => topFive.includes(p.id));
  const candidates = pool.length ? pool : legal;
  const ballsOf = (p) => inn.bowling[p.id]?.balls ?? 0;
  const ranked = [...candidates].sort((a, b) => ballsOf(a) - ballsOf(b) || b.bowling - a.bowling);
  const rng = forkRng(state.rngState, SALT_BOWLER);
  return (rng.next() < 0.8 ? ranked[0] : ranked[Math.min(1, ranked.length - 1)]).id;
}

/** @returns {import('../types.js').BowlInput} */
export function aiBowl(state) {
  const inn = currentInnings(state);
  const bowler = playerById(state, inn.bowlerId);
  const rng = forkRng(state.rngState, SALT_BOWL);
  const death = inn.legalBalls >= totalBalls(state) - 2 * BALLS_PER_OVER;
  const spin = bowler?.bowlType === 'spin';
  const length = rng.weighted({
    yorker: death ? 30 : spin ? 3 : 12,
    full: spin ? 35 : 22,
    good: death ? 32 : 46,
    short: spin ? 6 : 20,
  });
  const line = rng.weighted({ off: 55, middle: 32, leg: 13 });
  // When the AI bowls, a harder game means tighter bowling.
  const diff = difficultyFactor(state.config.difficulty);
  const accuracy = clamp(0.45 + (bowler?.bowling ?? 50) / 250 + diff * 0.07 + rng.normal() * 0.12, 0.15, 1);
  return { line, length, accuracy };
}

// 0 = block everything, 1 = swing at everything.
export function aggression(state) {
  const inn = currentInnings(state);
  const chase = chaseInfo(state);
  let a;
  if (chase) {
    const rrr = chase.requiredRate ?? 36;
    a = 0.35 + (rrr - 7.5) / 10;
  } else {
    a = 0.4 + 0.45 * (inn.legalBalls / totalBalls(state));
  }
  a -= Math.max(0, inn.wickets - 4) * 0.05;
  return clamp(a, 0.1, 1);
}

/**
 * The AI batter reads the actual delivery (after drift), picks a shot and
 * a timing error that shrinks with skill.
 * @returns {import('../types.js').BatInput}
 */
export function aiBat(state, bowl) {
  const inn = currentInnings(state);
  const batter = playerById(state, inn.strikerId);
  const delivery = previewDelivery(state, bowl);
  const rng = forkRng(state.rngState, SALT_BAT);
  const agg = aggression(state);
  const { line, length } = delivery;

  const weights = { defend: 0, drive: 0, pull: 0, cut: 0, loft: 0, leave: 0 };
  if (length === 'yorker') Object.assign(weights, { defend: 60, drive: 25, loft: 10 });
  else if (length === 'full') Object.assign(weights, { defend: 20, drive: 50, loft: 30 });
  else if (length === 'good') Object.assign(weights, { defend: 45, drive: 25, cut: line === 'off' ? 15 : 3, pull: 5, loft: 15 });
  else Object.assign(weights, { defend: 15, pull: line === 'off' ? 15 : 45, cut: line === 'off' ? 40 : 5, loft: 10 });
  if (line === 'off' && length !== 'yorker') weights.leave = 6 * (1 - agg);
  weights.defend *= 1.4 - agg;
  weights.loft *= 0.4 + agg * 1.6;
  weights.pull *= 0.7 + agg * 0.6;
  const shot = rng.weighted(weights);
  if (shot === 'leave') return { shot, timingMs: null };

  // When the AI bats, a harder game means better timing.
  const diff = difficultyFactor(state.config.difficulty);
  const skill = clamp(batter?.batting ?? 50, 1, 100);
  const spread = (260 - skill * 1.3) * (1 - diff * 0.15);
  return { shot, timingMs: Math.round(rng.normal() * spread) };
}
