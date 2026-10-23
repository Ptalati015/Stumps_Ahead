// Standalone harness for the play screen, using fixture teams. Not part of the
// app: open dev/play.html?bat=ai&overs=2 from a static server.
import { createMatch, startSecondInnings, oversText } from '../js/engine/match.js';
import { mount } from '../js/ui/screens/play.js';
import { fixtureConfig } from '../tests/fixtures.js';

const root = document.getElementById('app');
const q = new URLSearchParams(location.search);
let unmount = null;

function navigate(screen, props) {
  if (unmount) unmount();
  unmount = null;
  if (screen === 'play') {
    unmount = mount(root, props, navigate);
    return;
  }
  root.textContent = '';
  const card = document.createElement('div');
  card.className = 'dev-card';
  for (const inn of props.match.innings) {
    const line = document.createElement('p');
    line.textContent = `${inn.battingTeam} ${inn.runs}/${inn.wickets} (${oversText(inn)})`;
    card.append(line);
  }
  const head = document.createElement('h2');
  head.textContent = screen === 'result' ? props.match.result.text : `Target ${props.match.innings[0].runs + 1}`;
  const btn = document.createElement('button');
  btn.textContent = screen === 'result' ? 'Play again' : 'Start chase';
  btn.addEventListener('click', () =>
    navigate('play', { match: screen === 'result' ? newMatch() : startSecondInnings(props.match) }),
  );
  card.prepend(head);
  card.append(btn);
  root.append(card);
}

function newMatch() {
  return createMatch(fixtureConfig({
    overs: Number(q.get('overs')) || 2,
    battingFirst: q.get('bat') === 'ai' ? 'ai' : 'user',
    difficulty: q.get('difficulty') || 'normal',
    seed: Number(q.get('seed')) || undefined,
  }));
}

navigate('play', { match: newMatch() });
