// Pick your nation, then an opponent, preview both generated XIs, reroll names.
// props (all optional, used when coming back from Setup):
//   { userCode, aiCode, fixture, rng }

import { el, teamBadge, teamColors } from '../dom.js';
import { NATIONS, NATION_CODES } from '../../data/nations.js';
import { generateFixture } from '../../data/names.js';
import { createRng } from '../../engine/rng.js';
import { ROLE_LABEL } from '../format.js';

export function mount(root, props, navigate) {
  const rng = props.rng || createRng(Date.now() % 2147483647);
  let userCode = props.userCode || null;
  let aiCode = props.aiCode || null;
  let fixture = props.fixture || null;

  const screen = el('section', { className: 'screen screen--teams' });
  root.append(screen);

  function regenerate() {
    fixture = userCode && aiCode ? generateFixture(userCode, aiCode, rng) : null;
  }

  function pick(which, code) {
    if (which === 'user') {
      if (userCode === code) return;
      userCode = code;
      if (aiCode === code) aiCode = null;
    } else {
      if (aiCode === code || code === userCode) return;
      aiCode = code;
    }
    regenerate();
    render();
  }

  function nationGrid(which, selected, disabledCode) {
    return el('div', { className: 'nation-grid', role: 'radiogroup', 'aria-label': which === 'user' ? 'Your team' : 'Opponent' },
      NATION_CODES.map((code) => {
        const n = NATIONS[code];
        const isSel = selected === code;
        return el('button', {
          type: 'button',
          className: `nation${isSel ? ' nation--selected' : ''}`,
          role: 'radio',
          'aria-checked': String(isSel),
          disabled: code === disabledCode,
          style: teamColors(n),
          onClick: () => pick(which, code),
        }, teamBadge(n), el('span', { className: 'nation__name' }, n.name));
      }));
  }

  function squadList(team, label) {
    return el('div', { className: 'squad', style: teamColors(team) },
      el('h3', { className: 'squad__title' }, teamBadge(team, 'sm'), `${label}: ${team.name}`),
      el('ol', { className: 'squad__list' },
        team.players.map((p) => el('li', {},
          el('span', { className: 'squad__name' }, p.name),
          el('span', { className: `role role--${p.role.toLowerCase()}` },
            p.role === 'WK' ? 'WK' : ROLE_LABEL[p.role], p.bowlType ? ` · ${p.bowlType}` : ''),
        ))));
  }

  function render() {
    const parts = [
      el('h2', { className: 'screen__title' }, 'Choose your team'),
      nationGrid('user', userCode, null),
    ];
    if (userCode) {
      parts.push(el('h2', { className: 'screen__title' }, 'Choose your opponent'), nationGrid('ai', aiCode, userCode));
    }
    if (fixture) {
      parts.push(
        el('div', { className: 'squads' }, squadList(fixture.userTeam, 'You'), squadList(fixture.aiTeam, 'Opponent')),
        el('button', { type: 'button', className: 'btn btn--ghost', onClick: () => { regenerate(); render(); } }, 'Reroll names'),
      );
    }
    const next = el('button', {
      type: 'button',
      className: 'btn btn--primary',
      disabled: !fixture,
      onClick: () => navigate('setup', { fixture, rng, userCode, aiCode }),
    }, fixture ? 'Next: match setup' : userCode ? 'Pick an opponent' : 'Pick your team');

    screen.replaceChildren(
      el('div', { className: 'screen__body' }, parts),
      el('footer', { className: 'actionbar' },
        el('button', { type: 'button', className: 'btn btn--ghost', onClick: () => navigate('menu') }, 'Back'),
        next),
    );
  }

  render();
  return () => {};
}
