// Match engine: innings, overs, balls, extras, wickets, chase and result.
// Pure: no DOM. Every exported function that changes the match returns a new
// MatchState and leaves the one passed in untouched. Shapes: js/types.js.
import { createRng, forkRng } from './rng.js';
import { prepareDelivery, resolveOutcome, commentaryFor, commentaryLine, shotFlight } from './outcomes.js';

export { aiChooseBowler, aiBowl, aiBat } from './ai.js';

export const BALLS_PER_OVER = 6;
const SALT_DELIVERY = 0x5eed;
const SALT_FLIGHT = 0xf117;
const SALT_COMMENT = 0xc0de;

const clone = (state) => structuredClone(state);

/** @param {import('../types.js').MatchConfig} config */
export function createMatch(config) {
  const { userTeam, aiTeam } = config ?? {};
  if (!userTeam?.players?.length || !aiTeam?.players?.length) throw new Error('createMatch: both teams need players');
  if (userTeam.code === aiTeam.code) throw new Error('createMatch: teams must be different nations');
  const overs = [2, 5, 10].includes(config.overs) ? config.overs : 5;
  const seed = Number.isFinite(config.seed) ? config.seed : Date.now();
  const first = config.battingFirst === 'ai' ? aiTeam : userTeam;
  const second = first === userTeam ? aiTeam : userTeam;
  return {
    config: { ...config, overs, difficulty: config.difficulty ?? 'normal', battingFirst: config.battingFirst === 'ai' ? 'ai' : 'user' },
    innings: [newInnings(first, second, null)],
    current: 0,
    status: 'awaiting_bowler',
    result: null,
    // Engine bookkeeping beyond js/types.js.
    rngState: createRng(seed).state(),
    lastBowlerId: null,
  };
}

function newInnings(battingTeam, bowlingTeam, target) {
  const [striker, nonStriker] = battingTeam.players;
  return {
    battingTeam: battingTeam.code,
    bowlingTeam: bowlingTeam.code,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    strikerId: striker.id,
    nonStrikerId: nonStriker.id,
    bowlerId: null,
    batting: { [striker.id]: newBatterCard(), [nonStriker.id]: newBatterCard() },
    bowling: {},
    log: [],
    target,
    extras: { wides: 0, noballs: 0 },
    // Bookkeeping for milestones and commentary (SPEC 16.2).
    partnershipStart: 0,
    overStart: 0,
    lastLines: {},
  };
}

const newBatterCard = () => ({ runs: 0, balls: 0, fours: 0, sixes: 0, howOut: null });

// ---- Read-only helpers ----------------------------------------------------

export const currentInnings = (state) => state.innings[state.current];

export function teamByCode(state, code) {
  const { userTeam, aiTeam } = state.config;
  return userTeam.code === code ? userTeam : aiTeam;
}

export function playerById(state, id) {
  const { userTeam, aiTeam } = state.config;
  return userTeam.players.find((p) => p.id === id) ?? aiTeam.players.find((p) => p.id === id) ?? null;
}

export const isUserBatting = (state) => currentInnings(state).battingTeam === state.config.userTeam.code;

export function oversText(innings) {
  const b = innings.legalBalls;
  return `${Math.floor(b / BALLS_PER_OVER)}.${b % BALLS_PER_OVER}`;
}

export const maxOversPerBowler = (state) => Math.max(2, Math.ceil(state.config.overs / 5));
export const totalBalls = (state) => state.config.overs * BALLS_PER_OVER;
export const maxWickets = (team) => Math.min(10, team.players.length - 1);

export function runRate(innings) {
  return innings.legalBalls === 0 ? 0 : (innings.runs * BALLS_PER_OVER) / innings.legalBalls;
}

/** Runs needed, balls left and required rate in a chase, else null. */
export function chaseInfo(state) {
  const inn = currentInnings(state);
  if (inn.target == null) return null;
  const runsNeeded = Math.max(0, inn.target - inn.runs);
  const ballsLeft = Math.max(0, totalBalls(state) - inn.legalBalls);
  const requiredRate = ballsLeft === 0 ? null : (runsNeeded * BALLS_PER_OVER) / ballsLeft;
  return { runsNeeded, ballsLeft, requiredRate };
}

/** Players in the bowling side who can legally bowl the next over (keeper excluded). */
export function availableBowlers(state) {
  const inn = currentInnings(state);
  const cap = maxOversPerBowler(state) * BALLS_PER_OVER;
  return teamByCode(state, inn.bowlingTeam).players.filter(
    (p) => p.role !== 'WK' && p.id !== state.lastBowlerId && (inn.bowling[p.id]?.balls ?? 0) < cap,
  );
}

/**
 * Ball speed, travel time and any drift/extra, without advancing the match.
 * Also says whether the bowler is on a hat-trick and carries a situational
 * line (the last over of a chase) for the run-up.
 */
export function previewDelivery(state, bowl) {
  const inn = currentInnings(state);
  const bowler = playerById(state, inn.bowlerId);
  const batter = playerById(state, inn.strikerId);
  const delivery = prepareDelivery(bowl, bowler, forkRng(state.rngState, SALT_DELIVERY), batter);
  delivery.hattrickBall = onHattrick(inn, inn.bowlerId);
  delivery.note = null;
  const chase = chaseInfo(state);
  if (chase && chase.runsNeeded > 0 && inn.legalBalls === totalBalls(state) - BALLS_PER_OVER) {
    delivery.note = commentaryLine('last_over', { n: chase.runsNeeded }, { pickRng: forkRng(state.rngState, SALT_COMMENT) });
  }
  return delivery;
}

/** The bowler's last two legal balls in this innings were both their wickets. */
function onHattrick(inn, bowlerId) {
  if (!bowlerId) return false;
  const mine = inn.log.filter((b) => b.bowlerId === bowlerId && !b.extra);
  return mine.length >= 2 && mine.slice(-2).every((b) => b.wicket && b.wicket.kind !== 'runout');
}

// ---- State transitions ----------------------------------------------------

export function setBowler(state, playerId) {
  if (state.status !== 'awaiting_bowler') throw new Error(`setBowler: status is ${state.status}`);
  if (!availableBowlers(state).some((p) => p.id === playerId)) throw new Error(`setBowler: ${playerId} cannot bowl this over`);
  const next = clone(state);
  const inn = currentInnings(next);
  inn.bowlerId = playerId;
  inn.bowling[playerId] ??= { balls: 0, runs: 0, wickets: 0 };
  next.status = 'in_play';
  return next;
}

/**
 * Bowl one ball. bowl: BowlInput, bat: BatInput.
 * @returns {{ state: import('../types.js').MatchState, ball: import('../types.js').BallResult }}
 */
export function playBall(state, bowl, bat) {
  if (state.status !== 'in_play') throw new Error(`playBall: status is ${state.status}`);
  const next = clone(state);
  const inn = currentInnings(next);
  const delivery = previewDelivery(state, bowl);
  const rng = createRng(next.rngState);

  const batter = playerById(next, inn.strikerId);
  const bowler = playerById(next, inn.bowlerId);
  const bowlerCard = inn.bowling[inn.bowlerId];
  const batterCard = inn.batting[inn.strikerId];
  const before = { batRuns: batterCard.runs, wickets: bowlerCard.wickets, partnership: inn.runs - (inn.partnershipStart ?? 0) };

  let outcome = { runs: 0, wicketKind: null, timing: null, shot: bat?.shot ?? 'leave' };
  if (delivery.extra !== 'wide') {
    outcome = resolveOutcome({
      delivery, bat, batter, bowler,
      difficulty: next.config.difficulty,
      userBatting: isUserBatting(next),
      rng,
    });
  }
  // Only a run out can dismiss a batter off a no-ball.
  if (delivery.extra === 'noball' && outcome.wicketKind && outcome.wicketKind !== 'runout') outcome.wicketKind = null;

  const legal = delivery.extra === null;
  const extraRuns = delivery.extra ? 1 : 0;
  inn.runs += outcome.runs + extraRuns;
  bowlerCard.runs += outcome.runs + extraRuns;
  if (delivery.extra === 'wide') inn.extras.wides += 1;
  if (delivery.extra === 'noball') inn.extras.noballs += 1;
  if (legal) {
    inn.legalBalls += 1;
    bowlerCard.balls += 1;
  }
  if (delivery.extra !== 'wide') {
    batterCard.balls += 1;
    batterCard.runs += outcome.runs;
    if (outcome.runs === 4) batterCard.fours += 1;
    if (outcome.runs === 6) batterCard.sixes += 1;
  }

  const bowlingTeam = teamByCode(next, inn.bowlingTeam);
  const fielder = rng.pick(bowlingTeam.players.filter((p) => p.id !== bowler.id));
  let wicket = null;
  if (outcome.wicketKind) {
    wicket = { kind: outcome.wicketKind, batterId: inn.strikerId };
    batterCard.howOut = howOutText(outcome.wicketKind, bowler, fielder);
    if (outcome.wicketKind !== 'runout') bowlerCard.wickets += 1;
    inn.wickets += 1;
  }

  // Where the ball went, for the scene (SPEC 12.2). Its own rng stream, so
  // it never changes the score.
  const flight = shotFlight({ outcome, bat, extra: delivery.extra }, forkRng(state.rngState, SALT_FLIGHT));
  // A bowler changing sides gets a line of its own (SPEC 15.2).
  const prevSide = inn.log.findLast((b) => b.bowlerId === bowler.id)?.delivery?.side ?? 'over';
  const sideNote = delivery.side !== prevSide ? `${bowler.name} switches to ${delivery.side} the wicket. ` : '';
  // Lines come from their own stream (SPEC 16.2), so seeds keep their scores.
  const names = { batter: batter.name, bowler: bowler.name, fielder: fielder.name };
  const lineOpts = { pickRng: forkRng(state.rngState, SALT_COMMENT), last: (inn.lastLines ??= {}) };
  const line = commentaryFor(
    { runs: outcome.runs, extra: delivery.extra, wicketKind: outcome.wicketKind, timing: outcome.timing, shot: outcome.shot, angleDeg: flight.angleDeg },
    names,
    rng,
    lineOpts,
  );

  // Milestones, each on the ball it happens (SPEC 16.2).
  const milestones = [];
  if (delivery.hattrickBall) milestones.push({ kind: 'hattrick_ball', playerId: bowler.id });
  if (before.batRuns < 50 && batterCard.runs >= 50) milestones.push({ kind: 'fifty', playerId: batter.id });
  if (before.batRuns < 100 && batterCard.runs >= 100) milestones.push({ kind: 'hundred', playerId: batter.id });
  if (before.wickets < 3 && bowlerCard.wickets >= 3) milestones.push({ kind: 'threefor', playerId: bowler.id });
  if (before.wickets < 5 && bowlerCard.wickets >= 5) milestones.push({ kind: 'fivefor', playerId: bowler.id });
  if (delivery.hattrickBall && legal && wicket && wicket.kind !== 'runout') milestones.push({ kind: 'hattrick', playerId: bowler.id });
  const partnership = inn.runs - (inn.partnershipStart ?? 0);
  if (before.partnership < 50 && partnership >= 50) milestones.push({ kind: 'partnership50', playerId: batter.id });
  if (wicket) inn.partnershipStart = inn.runs;
  const overEnds = legal && inn.legalBalls % BALLS_PER_OVER === 0;
  const overBalls = inn.log.slice(inn.overStart ?? 0);
  if (overEnds && [...overBalls, { runs: outcome.runs, extra: delivery.extra }].every((b) => b.runs === 0 && !b.extra)) {
    milestones.push({ kind: 'maiden', playerId: bowler.id });
  }
  if (overEnds) inn.overStart = inn.log.length + 1;
  const wonIt = inn.target != null && inn.runs >= inn.target;
  const fill = { ...names, n: milestoneNumber(milestones, batterCard, bowlerCard, partnership) };
  // One extra line at most: the winning runs, else the biggest milestone.
  const said = wonIt ? 'won_it' : MILESTONE_ORDER.find((k) => milestones.some((m) => m.kind === k)) ?? null;
  const note = wonIt ? commentaryLine('won_it', fill, lineOpts) : null;
  const extraLine = said === 'won_it' ? note : said ? commentaryLine(said, fill, lineOpts) : null;

  const ball = {
    runs: outcome.runs,
    extra: delivery.extra ? { type: delivery.extra, runs: 1 } : null,
    wicket,
    timing: outcome.timing,
    commentary: sideNote + line + (extraLine ? ` ${extraLine}` : ''),
    milestones,
    note,
    ...flight,
    // Extra fields for the play screen.
    shot: outcome.shot,
    delivery,
    bowlerId: bowler.id,
    batterId: batter.id,
  };
  inn.log.push(ball);

  if (outcome.runs % 2 === 1) swapStrike(inn);

  const battingTeam = teamByCode(next, inn.battingTeam);
  const allOut = inn.wickets >= maxWickets(battingTeam);
  if (wicket && !allOut) {
    // New batter takes the dismissed batter's place (and end).
    const incoming = battingTeam.players.find((p) => !(p.id in inn.batting));
    inn.batting[incoming.id] = newBatterCard();
    if (inn.strikerId === wicket.batterId) inn.strikerId = incoming.id;
    else inn.nonStrikerId = incoming.id;
  }

  next.rngState = rng.state();

  const targetReached = inn.target != null && inn.runs >= inn.target;
  const oversDone = inn.legalBalls >= totalBalls(next);
  if (targetReached || allOut || oversDone) {
    endInnings(next);
  } else if (legal && inn.legalBalls % BALLS_PER_OVER === 0) {
    swapStrike(inn);
    next.lastBowlerId = inn.bowlerId;
    inn.bowlerId = null;
    next.status = 'awaiting_bowler';
  }
  return { state: next, ball };
}

export function startSecondInnings(state) {
  if (state.status !== 'innings_break') throw new Error(`startSecondInnings: status is ${state.status}`);
  const next = clone(state);
  const first = next.innings[0];
  next.innings.push(newInnings(teamByCode(next, first.bowlingTeam), teamByCode(next, first.battingTeam), first.runs + 1));
  next.current = 1;
  next.lastBowlerId = null;
  next.status = 'awaiting_bowler';
  return next;
}

// Milestone lines in the order they are worth saying; hattrick_ball is said
// during the run-up (delivery.hattrickBall), not after the ball.
const MILESTONE_ORDER = ['hattrick', 'hundred', 'fifty', 'fivefor', 'threefor', 'partnership50', 'maiden'];

function milestoneNumber(milestones, batterCard, bowlerCard, partnership) {
  const kind = MILESTONE_ORDER.find((k) => milestones.some((m) => m.kind === k));
  if (kind === 'fifty' || kind === 'hundred') return batterCard.runs;
  if (kind === 'threefor' || kind === 'fivefor') return bowlerCard.wickets;
  if (kind === 'partnership50') return partnership;
  return null;
}

function swapStrike(inn) {
  [inn.strikerId, inn.nonStrikerId] = [inn.nonStrikerId, inn.strikerId];
}

function howOutText(kind, bowler, fielder) {
  if (kind === 'bowled') return `b ${bowler.name}`;
  if (kind === 'lbw') return `lbw b ${bowler.name}`;
  if (kind === 'caught') return `c ${fielder.name} b ${bowler.name}`;
  return `run out (${fielder.name})`;
}

function endInnings(state) {
  const inn = currentInnings(state);
  inn.bowlerId = null;
  state.lastBowlerId = null;
  if (state.current === 0) {
    state.status = 'innings_break';
    return;
  }
  state.status = 'complete';
  state.result = computeResult(state);
}

function computeResult(state) {
  const [first, second] = state.innings;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (second.runs >= second.target) {
    const team = teamByCode(state, second.battingTeam);
    const left = maxWickets(team) - second.wickets;
    return { winner: team.code, text: `${team.name} won by ${plural(left, 'wicket')}` };
  }
  if (second.runs === first.runs) return { winner: null, text: 'Match tied' };
  const team = teamByCode(state, first.battingTeam);
  return { winner: team.code, text: `${team.name} won by ${plural(first.runs - second.runs, 'run')}` };
}
