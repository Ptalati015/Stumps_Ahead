// Call the toss, flip the coin, winner picks bat or bowl, then start the match.
// props: { fixture, rng, overs, difficulty }

import { el, teamBadge } from '../dom.js';
import { createMatch } from '../../engine/match.js';

const FLIP_MS = 1200;

export function mount(root, props, navigate) {
  const { fixture, rng, overs, difficulty } = props;
  if (!fixture || !rng) {
    navigate('teamSelect');
    return () => {};
  }
  const { userTeam, aiTeam } = fixture;
  const timers = new Set();
  let phase = 'call'; // call -> flipping -> decide (user won) | aiDecided
  let call = null;
  let outcome = null;
  let battingFirst = null;
  let started = false;

  const screen = el('section', { className: 'screen screen--toss' });
  root.append(screen);

  function later(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }

  function doCall(side) {
    if (phase !== 'call') return;
    call = side;
    outcome = rng.int(0, 1) === 0 ? 'heads' : 'tails';
    phase = 'flipping';
    render();
    later(() => {
      if (outcome === call) {
        phase = 'decide';
      } else {
        battingFirst = rng.int(0, 1) === 0 ? 'ai' : 'user';
        phase = 'aiDecided';
      }
      render();
    }, FLIP_MS);
  }

  function start(first) {
    if (started) return;
    started = true;
    const match = createMatch({
      userTeam,
      aiTeam,
      overs,
      difficulty,
      battingFirst: first,
      seed: rng.int(1, 2147483646),
    });
    navigate('play', { match, rng });
  }

  function coin() {
    const face = phase === 'call' ? '?' : phase === 'flipping' ? '' : outcome === 'heads' ? 'H' : 'T';
    return el('div', {
      className: `coin${phase === 'flipping' ? ' coin--flipping' : ''}${phase !== 'call' && phase !== 'flipping' ? ` coin--${outcome}` : ''}`,
      'aria-hidden': 'true',
    }, face);
  }

  function render() {
    const body = [
      el('h2', { className: 'screen__title' }, 'The toss'),
      el('div', { className: 'versus' }, teamBadge(userTeam, 'lg'), el('span', { className: 'versus__v' }, 'v'), teamBadge(aiTeam, 'lg')),
      coin(),
    ];
    const actions = [];

    if (phase === 'call') {
      body.push(el('p', { className: 'lead' }, `${userTeam.name} to call. Heads or tails?`));
      actions.push(
        el('button', { type: 'button', className: 'btn btn--primary', onClick: () => doCall('heads') }, 'Heads'),
        el('button', { type: 'button', className: 'btn btn--primary', onClick: () => doCall('tails') }, 'Tails'),
      );
    } else if (phase === 'flipping') {
      body.push(el('p', { className: 'lead' }, `You called ${call}…`));
    } else if (phase === 'decide') {
      body.push(el('p', { className: 'lead' }, `It's ${outcome}. ${userTeam.name} won the toss!`),
        el('p', {}, 'What will you do first?'));
      actions.push(
        el('button', { type: 'button', className: 'btn btn--primary', onClick: () => start('user') }, 'Bat first'),
        el('button', { type: 'button', className: 'btn btn--primary', onClick: () => start('ai') }, 'Bowl first'),
      );
    } else {
      const choice = battingFirst === 'ai' ? 'bat' : 'bowl';
      body.push(el('p', { className: 'lead' }, `It's ${outcome}. ${aiTeam.name} won the toss and chose to ${choice} first.`),
        el('p', {}, battingFirst === 'user' ? 'You will bat first.' : 'You will bowl first.'));
      actions.push(el('button', { type: 'button', className: 'btn btn--primary btn--wide', onClick: () => start(battingFirst) }, 'Start match'));
    }

    screen.replaceChildren(
      el('div', { className: 'screen__body screen__body--center' }, body),
      el('footer', { className: 'actionbar' }, actions),
    );
    const first = screen.querySelector('.actionbar button');
    if (first) first.focus();
  }

  render();
  return () => {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  };
}
