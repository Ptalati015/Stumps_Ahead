// Overs, difficulty, venue and ball.
// props: { fixture, rng, userCode, aiCode, overs?, difficulty?, venueId?, ball? }

import { el, teamBadge } from '../dom.js';
import { venuesFor } from '../../data/venues.js';

const OVERS = [2, 5, 10];
const DIFFICULTY = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];
const BALLS = [['red', 'Red'], ['white', 'White'], ['pink', 'Pink']];

export function mount(root, props, navigate) {
  const { fixture, rng } = props;
  if (!fixture) {
    navigate('teamSelect');
    return () => {};
  }
  let overs = props.overs || 5;
  let difficulty = props.difficulty || 'normal';
  // The user's two grounds first, then the opponent's (SPEC 13.4).
  const venues = [...venuesFor(fixture.userTeam.code), ...venuesFor(fixture.aiTeam.code)];
  let venueId = venues.some((v) => v.id === props.venueId) ? props.venueId : venues[0].id;
  let ball = BALLS.some(([b]) => b === props.ball) ? props.ball : 'white';

  const screen = el('section', { className: 'screen screen--setup' });
  root.append(screen);

  function segmented(label, options, current, onPick, mod = '') {
    return el('fieldset', { className: `segmented${mod ? ` segmented--${mod}` : ''}` },
      el('legend', {}, label),
      el('div', { className: 'segmented__opts', role: 'radiogroup', 'aria-label': label },
        options.map(([value, text]) => el('button', {
          type: 'button',
          role: 'radio',
          'aria-checked': String(value === current),
          className: `seg${value === current ? ' seg--on' : ''}`,
          onClick: () => { onPick(value); render(); },
        }, typeof text === 'string' ? text : text()))));
  }

  function render() {
    screen.replaceChildren(
      el('div', { className: 'screen__body' },
        el('h2', { className: 'screen__title' }, 'Match setup'),
        el('div', { className: 'versus' },
          teamBadge(fixture.userTeam, 'lg'), el('span', { className: 'versus__v' }, 'v'), teamBadge(fixture.aiTeam, 'lg')),
        el('p', { className: 'versus__names' }, `${fixture.userTeam.name} v ${fixture.aiTeam.name}`),
        segmented('Overs per side', OVERS.map((o) => [o, `${o} overs`]), overs, (v) => { overs = v; }),
        segmented('Difficulty', DIFFICULTY, difficulty, (v) => { difficulty = v; }),
        segmented('Venue', venues.map((v) => [v.id, () => [
          el('span', { className: 'seg__main' }, v.name),
          el('span', { className: 'seg__sub' }, v.nation === fixture.userTeam.code ? 'Home' : 'Away'),
        ]]), venueId, (v) => { venueId = v; }, 'grid'),
        segmented('Ball', BALLS.map(([b, text]) => [b, () => [
          el('span', { className: `ball-dot ball-dot--${b}`, 'aria-hidden': 'true' }), text,
        ]]), ball, (v) => { ball = v; }),
        ball === 'pink' ? el('p', { className: 'hint' }, 'Pink ball: day-night match under the lights.') : null,
      ),
      el('footer', { className: 'actionbar' },
        el('button', {
          type: 'button',
          className: 'btn btn--ghost',
          onClick: () => navigate('teamSelect', { fixture, rng, userCode: props.userCode, aiCode: props.aiCode }),
        }, 'Back'),
        el('button', {
          type: 'button',
          className: 'btn btn--primary',
          onClick: () => navigate('toss', { fixture, rng, overs, difficulty, venueId, ball }),
        }, 'Next: toss')),
    );
  }

  render();
  return () => {};
}
