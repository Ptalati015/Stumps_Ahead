// App shell: owns the #app root and swaps screens. Every screen module exports
// mount(rootEl, props, navigate) and returns an unmount function, which must
// clear its own timers and listeners (SPEC section 8.5).

import { el } from './ui/dom.js';

const SCREENS = {
  menu: () => import('./ui/screens/menu.js'),
  teamSelect: () => import('./ui/screens/teamSelect.js'),
  setup: () => import('./ui/screens/setup.js'),
  venue: () => import('./ui/screens/venue.js'),
  toss: () => import('./ui/screens/toss.js'),
  play: () => import('./ui/screens/play.js'),
  inningsBreak: () => import('./ui/screens/inningsBreak.js'),
  result: () => import('./ui/screens/result.js'),
};

const root = document.getElementById('app');
let unmountCurrent = null;
// Bumped on every navigate so a slow import for an old screen never mounts
// over a newer one (e.g. a quick double tap on two different buttons).
let navToken = 0;

export async function navigate(screenName, props = {}) {
  const token = ++navToken;
  const loader = SCREENS[screenName];
  if (!loader) throw new Error(`Unknown screen: ${screenName}`);

  let mod;
  try {
    mod = await loader();
  } catch (err) {
    console.error(err);
    if (token === navToken) showError(`Could not load the ${screenName} screen.`);
    return;
  }
  if (token !== navToken) return;

  teardown();
  root.dataset.screen = screenName;
  window.scrollTo(0, 0);
  try {
    unmountCurrent = mod.mount(root, props, navigate) || null;
  } catch (err) {
    console.error(err);
    showError('Something went wrong.');
  }
}

function teardown() {
  if (unmountCurrent) {
    try {
      unmountCurrent();
    } catch (err) {
      console.error(err);
    }
  }
  unmountCurrent = null;
  root.replaceChildren();
}

function showError(message) {
  teardown();
  root.dataset.screen = 'error';
  root.append(
    el('section', { className: 'screen screen--center' },
      el('h1', { className: 'title' }, 'Oops'),
      el('p', {}, message),
      el('button', { className: 'btn btn--primary', type: 'button', onClick: () => navigate('menu') }, 'Back to menu'),
    ),
  );
}

navigate('menu');
