// Full batting and bowling card for one completed (or in-progress) innings.

import { el, teamBadge, teamColors } from '../dom.js';
import { oversText, economy, strikeRate, teamByCode, runRate } from '../format.js';

export function scorecard(state, innings, heading) {
  const batting = teamByCode(state, innings.battingTeam);
  const bowling = teamByCode(state, innings.bowlingTeam);
  const extras = (innings.log || []).reduce((sum, b) => sum + (b.extra ? b.extra.runs : 0), 0);

  const batRows = [];
  const didNotBat = [];
  for (const p of batting.players) {
    const card = innings.batting[p.id];
    if (!card) {
      didNotBat.push(p.name);
      continue;
    }
    batRows.push(el('tr', {},
      el('th', { scope: 'row' },
        el('span', { className: 'sc__name' }, p.name),
        el('span', { className: 'sc__how' }, card.howOut || 'not out')),
      el('td', {}, String(card.runs)),
      el('td', {}, String(card.balls)),
      el('td', {}, String(card.fours)),
      el('td', {}, String(card.sixes)),
      el('td', {}, strikeRate(card.runs, card.balls)),
    ));
  }

  const bowlRows = bowling.players
    .filter((p) => innings.bowling[p.id])
    .map((p) => {
      const card = innings.bowling[p.id];
      return el('tr', {},
        el('th', { scope: 'row' }, el('span', { className: 'sc__name' }, p.name)),
        el('td', {}, oversText(card.balls)),
        el('td', {}, String(card.runs)),
        el('td', {}, String(card.wickets)),
        el('td', {}, economy(card.runs, card.balls)),
      );
    });

  const head = (...cols) => el('thead', {}, el('tr', {}, cols.map((c, i) => el('th', { scope: 'col', className: i ? 'num' : '' }, c))));

  return el('section', { className: 'scorecard', style: teamColors(batting) },
    el('header', { className: 'sc__header' },
      teamBadge(batting, 'sm'),
      el('h3', {}, heading || `${batting.name} innings`),
      el('span', { className: 'sc__total' }, `${innings.runs}/${innings.wickets} (${oversText(innings.legalBalls)})`),
    ),
    el('div', { className: 'sc__scroll' },
      el('table', { className: 'sc__table' },
        head('Batter', 'R', 'B', '4s', '6s', 'SR'),
        el('tbody', {}, batRows),
      ),
    ),
    el('p', { className: 'sc__meta' },
      `Extras ${extras} · Run rate ${runRate(innings.runs, innings.legalBalls)}`),
    didNotBat.length ? el('p', { className: 'sc__meta' }, `Did not bat: ${didNotBat.join(', ')}`) : null,
    el('div', { className: 'sc__scroll' },
      el('table', { className: 'sc__table' },
        head(`${bowling.code} bowling`, 'O', 'R', 'W', 'Econ'),
        el('tbody', {}, bowlRows),
      ),
    ),
  );
}
