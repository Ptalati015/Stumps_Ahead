// Hand-written fixture teams and a finished match, so the engine and the
// result/innings-break screens can be built before the name generator lands.
// Names are invented placeholders.
import { createMatch, playBall, setBowler, startSecondInnings, aiBowl, aiBat, aiChooseBowler } from '../js/engine/match.js';

function squad(code, names) {
  const roles = ['BAT', 'BAT', 'WK', 'BAT', 'BAT', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL'];
  const batting = [88, 82, 75, 78, 70, 66, 62, 30, 25, 20, 15];
  const bowling = [10, 15, 5, 20, 25, 70, 68, 85, 82, 78, 74];
  const types = [null, null, null, null, 'spin', 'pace', 'spin', 'pace', 'pace', 'spin', 'pace'];
  return names.map((name, i) => ({
    id: `${code}-${i + 1}`, name, role: roles[i], batting: batting[i], bowling: bowling[i], bowlType: types[i],
  }));
}

export const fixtureUserTeam = {
  code: 'IND',
  name: 'India',
  colors: { primary: '#1c4fa1', secondary: '#f28c28' },
  players: squad('IND', [
    'Arjun Velkari', 'Rohan Dastiwal', 'Kiran Mehtoro', 'Vikas Palrani', 'Sunil Tadkore', 'Amit Varunesh',
    'Deepak Holvani', 'Rahul Seshampi', 'Nitin Gorvakar', 'Pranav Ilmudi', 'Sanjay Kotharvi',
  ]),
};

export const fixtureAiTeam = {
  code: 'AUS',
  name: 'Australia',
  colors: { primary: '#f2c400', secondary: '#00563f' },
  players: squad('AUS', [
    'Jack Thornbury', 'Liam Castrell', 'Noah Pellingham', 'Ethan Brackwell', 'Oliver Dunsmore', 'Lucas Wrayford',
    'Mason Tilbrook', 'Harry Quenell', 'Cooper Ashvane', 'Riley Mordaunt', 'Lachlan Fenwyck',
  ]),
};

/** Base config; override fields as needed. */
export function fixtureConfig(overrides = {}) {
  return { userTeam: fixtureUserTeam, aiTeam: fixtureAiTeam, overs: 2, difficulty: 'normal', battingFirst: 'user', seed: 42, ...overrides };
}

/** Play a whole match with the AI making every choice for both sides. */
export function simulateMatch(config) {
  let state = createMatch(config);
  let guard = 0;
  while (state.status !== 'complete' && guard++ < 2000) {
    if (state.status === 'innings_break') state = startSecondInnings(state);
    else if (state.status === 'awaiting_bowler') state = setBowler(state, aiChooseBowler(state));
    else {
      const bowl = aiBowl(state);
      state = playBall(state, bowl, aiBat(state, bowl)).state;
    }
  }
  return state;
}

/** A finished 2-over match, for building scorecard and result screens. */
export const fixtureCompletedMatch = simulateMatch(fixtureConfig());
