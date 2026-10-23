// Overs and difficulty. props: { fixture, rng, userCode, aiCode, overs?, difficulty? }

import { el, teamBadge } from '../dom.js';

const OVERS = [2, 5, 10];
const DIFFICULTY = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];

export function mount(root, props, navigate) {
  const { fixture, rng } = props;
  if (!fixture) {
    navigate('teamSelect');
    return () => {};
  }
  let overs = props.overs || 5;
  let difficulty = props.difficulty || 'normal';

  const screen = el('section', { className: 'screen screen--setup' });
  root.append(screen);

  function segmented(label, options, current, onPick) {
    return el('fieldset', { className: 'segmented' },
      el('legend', {}, label),
      el('div', { className: 'segmented__opts', role: 'radiogroup', 'aria-label': label },
        options.map(([value, text]) => el('button', {
          type: 'button',
          role: 'radio',
          'aria-checked': String(value === current),
          className: `seg${value === current ? ' seg--on' : ''}`,
          onClick: () => { onPick(value); render(); },
        }, text))));
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
          onClick: () => navigate('toss', { fixture, rng, overs, difficulty }),
        }, 'Next: toss')),
    );
  }

  render();
  return () => {};
}
