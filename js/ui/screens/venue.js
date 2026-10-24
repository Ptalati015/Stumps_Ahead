// Choose the ground (SPEC 14.1): four illustrated cards, the user's two home
// grounds then the opponent's two. Cards are radio buttons: click (which a
// scroll never fires) or the arrow keys select one.
// props: { fixture, rng, userCode, aiCode, overs, difficulty, ball, venueId? }

import { el, teamBadge, teamColors } from '../dom.js';
import { venuesFor } from '../../data/venues.js';
import { venueArt } from '../components/venueArt.js';

export function mount(root, props, navigate) {
  const { fixture } = props;
  if (!fixture) {
    navigate('teamSelect');
    return () => {};
  }
  const { userTeam, aiTeam } = fixture;
  const night = props.ball === 'pink';
  const venues = [...venuesFor(userTeam.code), ...venuesFor(aiTeam.code)];
  let venueId = venues.some((v) => v.id === props.venueId) ? props.venueId : venues[0].id;

  const cards = venues.map((v) => {
    const home = v.nation === userTeam.code;
    const card = el('button', {
      type: 'button',
      role: 'radio',
      className: 'vcard',
      dataset: { id: v.id },
      'aria-label': `${v.name}, ${v.city}, ${home ? 'home' : 'away'}. ${v.tagline}`,
      onClick: () => select(v.id, false),
    },
    venueArt(v, { night }),
    el('span', { className: `vcard__tag ${home ? 'vcard__tag--home' : 'vcard__tag--away'}`, style: home ? teamColors(userTeam) : {} }, home ? 'Home' : 'Away'),
    el('span', { className: 'vcard__name' }, v.name),
    el('span', { className: 'vcard__city' }, v.city),
    el('span', { className: 'vcard__tagline' }, v.tagline));
    return card;
  });

  const group = el('div', { className: 'venue-grid', role: 'radiogroup', 'aria-label': 'Ground' }, cards);
  const play = el('button', { type: 'button', className: 'btn btn--primary', onClick: () => go('toss') });

  function go(screen) {
    const next = { ...props, venueId };
    navigate(screen, next);
  }

  function select(id, focus) {
    venueId = id;
    cards.forEach((c) => {
      const on = c.dataset.id === id;
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
      c.classList.toggle('vcard--on', on);
      if (on && focus) c.focus();
    });
    play.textContent = `Play at ${venues.find((v) => v.id === id).name}`;
  }

  // Arrow keys move the choice, as in a native radio group.
  group.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const i = venues.findIndex((v) => v.id === venueId);
    let j = null;
    if (step) j = (i + step + venues.length) % venues.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = venues.length - 1;
    if (j === null) return;
    e.preventDefault();
    select(venues[j].id, true);
  });

  root.append(el('section', { className: 'screen screen--venue' },
    el('div', { className: 'screen__body' },
      el('h2', { className: 'screen__title' }, 'Choose your ground'),
      el('div', { className: 'versus' }, teamBadge(userTeam, 'lg'), el('span', { className: 'versus__v' }, 'v'), teamBadge(aiTeam, 'lg')),
      el('p', { className: 'versus__names' }, `${userTeam.name} v ${aiTeam.name}${night ? ' · day-night' : ''}`),
      group),
    el('footer', { className: 'actionbar' },
      el('button', { type: 'button', className: 'btn btn--ghost', onClick: () => go('setup') }, 'Back'),
      play)));
  select(venueId, false);
  return () => {};
}
