import { el } from '../dom.js';

export function mount(root, props, navigate) {
  const play = el('button', { className: 'btn btn--primary btn--xl', type: 'button', onClick: () => navigate('teamSelect') }, 'Play match');

  root.append(el('section', { className: 'screen screen--menu' },
    el('div', { className: 'menu__hero' },
      el('div', { className: 'menu__stumps', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
      el('h1', { className: 'title' }, 'Stumps Ahead'),
      el('p', { className: 'subtitle' }, 'Quick-fire cricket. Pick a nation, win the toss, chase it down.'),
    ),
    el('div', { className: 'menu__actions' }, play),
    el('details', { className: 'panel howto' },
      el('summary', {}, 'How to play'),
      el('ol', {},
        el('li', {}, 'Pick your nation and an opponent. Squads are made up fresh every match.'),
        el('li', {}, 'Choose 2, 5 or 10 overs and a difficulty.'),
        el('li', {}, 'Call the toss. If you win, choose to bat or bowl.'),
        el('li', {}, 'Batting: tap a shot (Defend, Drive, Pull, Cut, Loft) just as the ball arrives. Timing is everything.'),
        el('li', {}, 'Bowling: pick a bowler each over, then a line and length, and stop the meter in the green.'),
        el('li', {}, 'Score more runs than the other side to win. Refreshing the page starts over.'),
      ),
    ),
    el('p', { className: 'footnote' }, 'All players are fictional. Not affiliated with any cricket board or game publisher.'),
  ));
  play.focus();
  return () => {};
}
