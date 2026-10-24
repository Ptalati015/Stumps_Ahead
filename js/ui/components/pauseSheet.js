// In-match pause sheet (SPEC 16.3): the full scorecard so far, a short
// how-to-play, Resume, and Quit behind a confirm. Built with el() only, so
// nothing is ever parsed as HTML. The sheet closes itself before calling
// onResume or onQuit, and the returned close() is safe to call again
// (for example from unmount).

import { el } from '../dom.js';
import { teamByCode } from '../format.js';
import { currentInnings } from '../../engine/match.js';
import { scorecard } from './scorecard.js';

const HOW_TO = [
  ['Batting', [
    'Move across the crease with the arrows, or drag the batter, before the ball arrives.',
    'The direction pad aims your shot. Auto plays each shot to its natural area.',
    'Play a shot with the buttons, or the keys D F P C L. Loft goes aerial: higher risk, higher reward.',
  ]],
  ['Bowling', [
    'Pick Side, Line, Length and Variation, or drag the ring to pitch the ball anywhere.',
    'Tap Bowl to start the meter, and tap again as close to the green as you can.',
    'A ball that reaches the batter well outside off or down the leg side is a wide. Bowling around the wicket can angle it there.',
  ]],
];

/**
 * Opens the sheet over `root`. Returns close(), which removes the sheet, its
 * listeners and the focus change, and can be called more than once.
 */
export function openPauseSheet(root, state, { onResume, onQuit } = {}) {
  const cards = [scorecard(state, currentInnings(state))];
  if (state.current > 0) {
    const first = state.innings[0];
    cards.push(scorecard(state, first, `${teamByCode(state, first.battingTeam).name}, 1st innings`));
  }

  const resumeBtn = el('button', { type: 'button', className: 'btn btn--primary', onClick: () => { close(); onResume?.(); } }, 'Resume');
  const quitBtn = el('button', { type: 'button', className: 'btn btn--ghost', onClick: () => askQuit(true) }, 'Quit to menu');
  const actions = el('div', { className: 'ps-actions' }, resumeBtn, quitBtn);

  const confirmQuit = el('button', { type: 'button', className: 'btn btn--primary ps-confirm-quit', onClick: () => { close(); onQuit?.(); } }, 'Quit');
  const confirm = el('div', { className: 'ps-confirm', hidden: true },
    el('p', {}, "Quit this match? It won't be saved."),
    el('div', { className: 'ps-actions' },
      el('button', { type: 'button', className: 'btn btn--ghost', onClick: () => askQuit(false) }, 'Cancel'),
      confirmQuit,
    ),
  );
  function askQuit(on) {
    confirm.hidden = !on;
    actions.hidden = on;
    (on ? confirmQuit : resumeBtn).focus();
  }

  const sheet = el('div', { className: 'ps-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
    el('h2', { className: 'ps-title' }, 'Paused'),
    el('div', { className: 'ps-scroll' },
      cards,
      el('section', { className: 'ps-howto' },
        el('h3', {}, 'How to play'),
        HOW_TO.map(([head, lines]) => [
          el('h4', {}, head),
          el('ul', {}, lines.map((line) => el('li', {}, line))),
        ]),
      ),
    ),
    confirm,
    actions,
  );
  const overlay = el('div', { className: 'ps' }, sheet);

  // The sheet is modal: every key stops here (capture, before the play
  // screen's handlers), so shortcuts like the shot keys cannot reach the
  // game while it is open. stopPropagation leaves the buttons' own
  // Enter/Space activation alone. Escape resumes, and Tab stays inside.
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      onResume?.();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  };

  const before = document.activeElement;
  let open = true;
  function close() {
    if (!open) return;
    open = false;
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    if (before instanceof HTMLElement && before.isConnected) before.focus();
  }

  document.addEventListener('keydown', onKey, true);
  root.append(overlay);
  resumeBtn.focus();
  return close;
}
