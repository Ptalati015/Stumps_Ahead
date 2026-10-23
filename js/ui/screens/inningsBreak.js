// Between innings: first-innings card and the target. props: { match, rng }

import { el, teamBadge } from '../dom.js';
import { scorecard } from '../components/scorecard.js';
import { teamByCode, oversText } from '../format.js';
import { startSecondInnings } from '../../engine/match.js';

export function mount(root, props, navigate) {
  const { match, rng } = props;
  if (!match || !match.innings[0]) {
    navigate('menu');
    return () => {};
  }
  const first = match.innings[0];
  const batted = teamByCode(match, first.battingTeam);
  const chasing = teamByCode(match, first.bowlingTeam);
  const target = first.runs + 1;
  const userChasing = chasing.code === match.config.userTeam.code;
  let started = false;

  const begin = () => {
    if (started) return;
    started = true;
    navigate('play', { match: startSecondInnings(match), rng });
  };

  root.append(el('section', { className: 'screen screen--break' },
    el('div', { className: 'screen__body' },
      el('h2', { className: 'screen__title' }, 'Innings break'),
      el('div', { className: 'summary' },
        teamBadge(batted, 'lg'),
        el('p', { className: 'summary__score' }, `${batted.name} ${first.runs}/${first.wickets}`),
        el('p', { className: 'summary__overs' }, `${oversText(first.legalBalls)} overs`),
      ),
      el('p', { className: 'lead target' },
        `${chasing.name} need ${target} to win from ${match.config.overs * 6} balls.`),
      el('p', {}, userChasing ? 'Time to chase it down.' : 'Time to defend it.'),
      scorecard(match, first),
    ),
    el('footer', { className: 'actionbar' },
      el('button', { type: 'button', className: 'btn btn--primary btn--wide', onClick: begin },
        userChasing ? 'Start the chase' : 'Start bowling')),
  ));
  return () => {};
}
