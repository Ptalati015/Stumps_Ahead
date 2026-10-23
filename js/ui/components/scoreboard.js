// Live scoreboard used by the play screen (Ayush) and the break/result screens.
// renderScoreboard(el, state, { compact }) replaces el's contents each call.

import { el, teamBadge, teamColors } from '../dom.js';
import { oversText, runRate, teamByCode, playerById, chaseInfo } from '../format.js';

/**
 * @param {HTMLElement} target
 * @param {import('../../types.js').MatchState} state
 * @param {{compact?: boolean}} [opts]
 */
export function renderScoreboard(target, state, { compact = false } = {}) {
  const innings = state.innings[state.current];
  if (!innings) {
    target.replaceChildren();
    return;
  }
  const batting = teamByCode(state, innings.battingTeam);
  const bowling = teamByCode(state, innings.bowlingTeam);
  const chase = chaseInfo(state, innings);

  const scoreLine = el('div', { className: 'sb__main' },
    teamBadge(batting, 'sm'),
    el('span', { className: 'sb__score' }, `${batting.code} ${innings.runs}/${innings.wickets}`),
    el('span', { className: 'sb__overs' }, `${oversText(innings.legalBalls)} / ${state.config.overs} ov`),
    el('span', { className: 'sb__vs' }, `v ${bowling.code}`),
  );

  const status = chase
    ? el('div', { className: 'sb__status' },
      chase.need > 0
        ? `Need ${chase.need} from ${chase.ballsLeft} ball${chase.ballsLeft === 1 ? '' : 's'} · RRR ${chase.reqRate}`
        : `Target ${chase.target} reached`)
    : el('div', { className: 'sb__status' }, `Run rate ${runRate(innings.runs, innings.legalBalls)}`);

  const children = [scoreLine, status];

  if (!compact) {
    const striker = playerById(state, innings.strikerId);
    const nonStriker = playerById(state, innings.nonStrikerId);
    const bowler = playerById(state, innings.bowlerId);
    const batterRow = (p, onStrike) => {
      if (!p) return null;
      const card = innings.batting[p.id] || { runs: 0, balls: 0 };
      return el('div', { className: `sb__row${onStrike ? ' sb__row--strike' : ''}` },
        el('span', { className: 'sb__name' }, `${onStrike ? '▶ ' : ''}${p.name}`),
        el('span', { className: 'sb__fig' }, `${card.runs} (${card.balls})`),
      );
    };
    children.push(el('div', { className: 'sb__players' },
      batterRow(striker, true),
      batterRow(nonStriker, false),
      bowler
        ? (() => {
          const card = innings.bowling[bowler.id] || { balls: 0, runs: 0, wickets: 0 };
          return el('div', { className: 'sb__row sb__row--bowler' },
            el('span', { className: 'sb__name' }, `● ${bowler.name}`),
            el('span', { className: 'sb__fig' }, `${card.wickets}-${card.runs} (${oversText(card.balls)})`),
          );
        })()
        : null,
    ));
  }

  const board = el('div', {
    className: `scoreboard${compact ? ' scoreboard--compact' : ''}`,
    style: teamColors(batting),
    role: 'status',
  }, children);
  target.replaceChildren(board);
}
