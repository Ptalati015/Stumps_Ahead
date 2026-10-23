// Display helpers shared by the scoreboard, scorecards and screens. Pure.

export function oversText(legalBalls) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

/** Runs per over, guarded so 0 balls never shows NaN or Infinity. */
export function runRate(runs, legalBalls) {
  if (!legalBalls) return '0.00';
  return ((runs * 6) / legalBalls).toFixed(2);
}

export function economy(runs, balls) {
  if (!balls) return '-';
  return ((runs * 6) / balls).toFixed(2);
}

export function strikeRate(runs, balls) {
  if (!balls) return '-';
  return ((runs * 100) / balls).toFixed(1);
}

export function teamByCode(state, code) {
  const { userTeam, aiTeam } = state.config;
  return userTeam.code === code ? userTeam : aiTeam;
}

export function playerById(state, id) {
  if (!id) return null;
  const { userTeam, aiTeam } = state.config;
  return userTeam.players.find((p) => p.id === id) || aiTeam.players.find((p) => p.id === id) || null;
}

/** Second-innings chase status, or null in the first innings. */
export function chaseInfo(state, innings) {
  if (innings.target == null) return null;
  const totalBalls = state.config.overs * 6;
  const need = Math.max(0, innings.target - innings.runs);
  const ballsLeft = Math.max(0, totalBalls - innings.legalBalls);
  const reqRate = ballsLeft ? ((need * 6) / ballsLeft).toFixed(2) : '-';
  return { target: innings.target, need, ballsLeft, reqRate };
}

export const ROLE_LABEL = { BAT: 'Batter', WK: 'Wicketkeeper', AR: 'All-rounder', BOWL: 'Bowler' };
