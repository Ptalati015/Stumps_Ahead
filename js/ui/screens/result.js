// Match result with both scorecards. props: { match }

import { el, teamBadge, teamColors } from '../dom.js';
import { scorecard } from '../components/scorecard.js';
import { teamByCode, oversText } from '../format.js';

export function mount(root, props, navigate) {
  const { match } = props;
  if (!match || !match.result) {
    navigate('menu');
    return () => {};
  }
  const { userTeam } = match.config;
  const { winner, text } = match.result;
  const outcome = winner == null ? 'tie' : winner === userTeam.code ? 'win' : 'loss';
  const headline = { win: 'You won!', loss: 'You lost', tie: 'Match tied' }[outcome];
  const winnerTeam = winner ? teamByCode(match, winner) : null;

  const line = (inn) => {
    const t = teamByCode(match, inn.battingTeam);
    return el('li', {}, teamBadge(t, 'sm'), el('span', {}, `${t.name} ${inn.runs}/${inn.wickets} (${oversText(inn.legalBalls)})`));
  };

  root.append(el('section', { className: `screen screen--result result--${outcome}` },
    el('div', { className: 'screen__body' },
      el('div', { className: 'result__banner', style: winnerTeam ? teamColors(winnerTeam) : {} },
        winnerTeam ? teamBadge(winnerTeam, 'lg') : null,
        el('h1', { className: 'title' }, headline),
        el('p', { className: 'lead' }, text),
      ),
      el('ul', { className: 'result__lines' }, match.innings.map(line)),
      match.innings.map((inn, i) => scorecard(match, inn, `${teamByCode(match, inn.battingTeam).name}, ${i === 0 ? '1st' : '2nd'} innings`)),
    ),
    el('footer', { className: 'actionbar' },
      el('button', { type: 'button', className: 'btn btn--ghost', onClick: () => navigate('menu') }, 'Menu'),
      el('button', { type: 'button', className: 'btn btn--primary', onClick: () => navigate('teamSelect') }, 'Play again')),
  ));
  return () => {};
}
