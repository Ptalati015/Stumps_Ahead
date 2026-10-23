# Stumps Ahead: Product Spec (v1)

Owner: Karen (PM) · Devs: Ayush (engine), Joel (data + UI) · QA: Violet · Security: Mark
Target: a playable build by 9am tomorrow. If something turns out much harder than this spec assumes, cut scope (see "Cut list") rather than slip.

## 1. What we are building

A short-format cricket game that runs in a mobile browser, inspired by EA Sports Cricket and Real Cricket 20, but much simpler. One player against the computer, one match per session.

- **No backend, no database, no accounts.** All state lives in memory. Refreshing the page starts over. Do not use `localStorage`, cookies or IndexedDB.
- **Mobile first.** Portrait layout, touch controls, works on a 360px wide screen. Desktop is a bonus (mouse clicks and keyboard should still work).
- **Seven nations:** IND, ENG, AUS, NZ, WI, SA, SL.
- **Fictional players.** Every squad is randomly generated each session (see section 5).

## 2. Tech stack

- Plain HTML, CSS and JavaScript using native ES modules. **No framework, no build step, no npm runtime dependencies.**
- Rendering: DOM for menus and scoreboard; a single `<canvas>` (or simple CSS animation) for the delivery view during play.
- Run locally with any static server: `python3 -m http.server 8000` and open `http://localhost:8000`. (ES modules do not load from `file://`.)
- Tests: Node's built-in runner, `node --test` (Node 22 does not accept a directory argument; it finds `tests/*.test.js` itself). Engine and name generator must be pure modules with no DOM access so they can be tested in Node.
- Deploy target: GitHub Pages from `main` (static files only).

## 3. Screen flow

```
Menu ─▶ Team Select ─▶ Match Setup ─▶ Toss ─▶ Play (1st inns) ─▶ Innings Break ─▶ Play (2nd inns) ─▶ Result ─▶ Menu
```

| Screen | Contents | Owner |
|---|---|---|
| Menu | Title "Stumps Ahead", Play button, How to Play panel | Joel |
| Team Select | Pick your nation, then the opponent (cannot pick the same one). Shows the generated XI with roles. "Reroll names" button. | Joel |
| Match Setup | Overs: 2, 5 (default) or 10. Difficulty: Easy / Normal / Hard. | Joel |
| Toss | Call heads or tails, coin result, winner chooses bat or bowl (AI chooses at random if it wins). | Joel |
| Play | Delivery view, batting or bowling controls, live mini scoreboard, last 6 balls, commentary line | Ayush (controls, delivery view, game loop) using Joel's scoreboard component |
| Innings Break | Full batting and bowling cards for innings 1, target | Joel |
| Result | Winner and margin ("India won by 4 wickets", "Match tied"), both scorecards, Play Again | Joel |

## 4. Gameplay rules and mechanics (Ayush)

### Match rules
- Limited overs, 6 legal balls per over, 11 players, innings ends at 10 wickets or overs complete.
- Second innings ends immediately when the target is passed.
- **Max overs per bowler = max(2, ceil(overs / 5))**, and no bowler bowls two overs in a row. The AI rotates through its 5 best bowling ratings. The user picks the bowler at the start of each over from a list that greys out bowlers who are capped or bowled the previous over.
- Batting order is the generated XI order. Striker rotates on odd runs and at the end of each over.
- Extras: wides and no-balls only (1 run, ball re-bowled). No free hits, no DRS, no LBW reviews, no super over (tie is a valid result).
- Dismissal types: bowled, caught, LBW, run out (rare, on attempted runs only from AI logic). Stumped is not needed.

### Batting (user bats, AI bowls)
1. The AI picks a delivery (line, length, pace) using the bowler's rating and difficulty.
2. The ball animates toward the batter. Travel time is 0.9 to 1.4 seconds depending on pace.
3. The user taps one of the shot buttons: **Defend, Drive, Pull, Cut, Loft**. "Leave" happens automatically if nothing is tapped.
4. Timing = tap time minus the ball's arrival time. Windows: Perfect within ±60ms, Good within ±150ms, Early/Late within ±300ms, otherwise Miss.
5. Outcome is drawn from a probability table keyed by shot, delivery length and line, timing quality, batter rating vs bowler rating, and difficulty. Examples: a Perfect Loft on a full ball is mostly 4 or 6 with some caught risk; Pull on a full ball is bad; Defend rarely gets out and rarely scores.
6. Result text appears in the commentary line ("Glorious cover drive, FOUR!").

### Bowling (user bowls, AI bats)
1. At the start of each over the user picks a bowler.
2. Each ball: pick **Line** (Off, Middle, Leg) and **Length** (Yorker, Full, Good, Short).
3. A power meter oscillates; tap to stop it. The closer to the green zone, the more accurate the ball. Poor accuracy can drift the line/length and can produce a wide or no-ball.
4. The AI batter picks a shot and timing based on its rating and difficulty, then the same outcome table resolves the ball.

### Randomness
All randomness goes through `js/engine/rng.js` (`createRng(seed)` returning `{ next(), int(min, max), pick(arr) }`). No direct `Math.random()` anywhere else, so tests can be seeded and repeatable.

## 5. Teams and names (Joel)

- Each nation has: code, display name, two colours, and a name pool. Use plain colours, no flags, crests, official logos or sponsor marks.
- Squad: 11 players in batting order: 5 batters (one is wicketkeeper), 2 all-rounders, 4 bowlers (mix of pace and spin; SL and IND lean spin, AUS, SA, ENG lean pace).
- Ratings: `batting` and `bowling` from 1 to 100, random within role-based ranges (batters 60 to 95 batting, bowlers 55 to 95 bowling and 10 to 40 batting).
- **Names:** "First Last". First names may be common real given names that fit the nation. **Surnames must be invented** (for example built from syllables, or picked from a hand-written pool of made-up surnames). A surname must never match a real international cricketer. Keep a denylist of at least 100 well known current and past international cricketer surnames in `js/data/denylist.js` and have the generator reject any match. No duplicate full names within a match.
- Squads are generated fresh each session and when the user taps "Reroll names".

## 6. Interface contract between tracks

This is the part that lets Ayush and Joel work in parallel. Change it only by updating this spec in a PR that both agree to.

### File ownership
```
index.html                 Joel
css/styles.css             Joel
js/main.js                 Joel   (app shell, screen router, holds the current match)
js/data/nations.js         Joel
js/data/names.js           Joel
js/data/denylist.js        Joel
js/ui/screens/*.js         Joel   (menu, teamSelect, setup, toss, inningsBreak, result)
js/ui/components/scoreboard.js  Joel
js/engine/rng.js           Ayush
js/engine/match.js         Ayush
js/engine/outcomes.js      Ayush
js/engine/ai.js            Ayush
js/ui/screens/play.js      Ayush  (delivery view, controls, game loop)
css/play.css               Ayush
tests/engine.test.js       Ayush
tests/names.test.js        Joel
```

### Data shapes (JSDoc, already committed in `js/types.js`; edit only via a spec change)

```js
/** @typedef {'IND'|'ENG'|'AUS'|'NZ'|'WI'|'SA'|'SL'} NationCode */

/** @typedef {Object} Player
 * @property {string} id            unique within the match, e.g. 'IND-3'
 * @property {string} name          'Arjun Velkari'
 * @property {'BAT'|'WK'|'AR'|'BOWL'} role
 * @property {number} batting       1..100
 * @property {number} bowling       1..100
 * @property {'pace'|'spin'|null} bowlType
 */

/** @typedef {Object} Team
 * @property {NationCode} code
 * @property {string} name          'India'
 * @property {{primary:string, secondary:string}} colors
 * @property {Player[]} players     length 11, batting order
 */

/** @typedef {Object} MatchConfig
 * @property {Team} userTeam
 * @property {Team} aiTeam
 * @property {2|5|10} overs
 * @property {'easy'|'normal'|'hard'} difficulty
 * @property {'user'|'ai'} battingFirst
 * @property {number} [seed]
 */

/** @typedef {Object} BowlInput
 * @property {'off'|'middle'|'leg'} line
 * @property {'yorker'|'full'|'good'|'short'} length
 * @property {number} accuracy      0..1 from the power meter (AI supplies its own)
 */

/** @typedef {Object} BatInput
 * @property {'defend'|'drive'|'pull'|'cut'|'loft'|'leave'} shot
 * @property {number|null} timingMs  tap time minus arrival time; null for leave/miss
 */

/** @typedef {Object} BallResult
 * @property {number} runs          runs off the bat
 * @property {null|{type:'wide'|'noball', runs:number}} extra
 * @property {null|{kind:'bowled'|'caught'|'lbw'|'runout', batterId:string}} wicket
 * @property {'perfect'|'good'|'early'|'late'|'miss'|null} timing
 * @property {string} commentary
 */

/** @typedef {Object} BatterCard  @property {number} runs @property {number} balls @property {number} fours @property {number} sixes @property {string|null} howOut */
/** @typedef {Object} BowlerCard  @property {number} balls @property {number} runs @property {number} wickets */

/** @typedef {Object} Innings
 * @property {NationCode} battingTeam
 * @property {NationCode} bowlingTeam
 * @property {number} runs
 * @property {number} wickets
 * @property {number} legalBalls     overs text = Math.floor(b/6) + '.' + (b%6)
 * @property {string} strikerId
 * @property {string} nonStrikerId
 * @property {string|null} bowlerId
 * @property {Object<string, BatterCard>} batting   keyed by player id
 * @property {Object<string, BowlerCard>} bowling   keyed by player id
 * @property {BallResult[]} log
 * @property {number|null} target   set on 2nd innings
 */

/** @typedef {Object} MatchState
 * @property {MatchConfig} config
 * @property {Innings[]} innings     1 or 2 entries
 * @property {0|1} current
 * @property {'awaiting_bowler'|'in_play'|'innings_break'|'complete'} status
 * @property {null|{winner:NationCode|null, text:string}} result   winner null = tie
 */
```

Engines may add extra fields beyond these shapes; UI code must treat them as optional. Current engine additions: `MatchState.rngState`, `MatchState.lastBowlerId`, `Innings.extras {wides, noballs}`, and `BallResult.shot`, `delivery`, `bowlerId`, `batterId`.

### Functions

Engine (Ayush), all pure, no DOM, in `js/engine/match.js`:
```js
createMatch(config: MatchConfig): MatchState
availableBowlers(state): Player[]          // legal choices for the next over
setBowler(state, playerId): MatchState
aiChooseBowler(state): string               // player id
aiBowl(state): BowlInput
aiBat(state, bowl: BowlInput): BatInput
playBall(state, bowl: BowlInput, bat: BatInput): { state: MatchState, ball: BallResult }
startSecondInnings(state): MatchState      // status 'innings_break' -> 'awaiting_bowler'
oversText(innings): string                 // '3.4'
// read-only helpers: currentInnings, playerById, runRate, chaseInfo, previewDelivery, isUserBatting
// randomness is carried in state.rngState, so screens never need their own rng for match play
```
Engine functions return new state objects; UI must not mutate state directly.

Data (Joel), pure, in `js/data/`:
```js
NATIONS: Record<NationCode, {code, name, colors}>
generateTeam(code: NationCode, rng): Team
generateFixture(userCode, aiCode, rng): { userTeam: Team, aiTeam: Team }  // guarantees no duplicate names across both
```

UI glue:
```js
// js/main.js (Joel)
navigate(screenName, props)   // screenName: 'menu'|'teamSelect'|'setup'|'toss'|'play'|'inningsBreak'|'result'
// every screen module exports:
export function mount(rootEl, props, navigate) { ...; return function unmount() {} }

// js/ui/components/scoreboard.js (Joel)
renderScoreboard(el, state: MatchState, { compact: boolean })

// js/ui/screens/play.js (Ayush)
// props: { match: MatchState }. When an innings ends it calls
// navigate('inningsBreak', { match }) or navigate('result', { match }).
```

To stay unblocked before the other side lands: Ayush tests with a hand-written fixture team in `tests/fixtures.js`; Joel builds the innings break and result screens against a fixture `MatchState` in the same file.

## 7. Mobile and UI requirements (Joel, Ayush for play screen)

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Portrait first, works from 360x640 up. Use `100dvh` and `env(safe-area-inset-*)`.
- Touch targets at least 44x44px. No hover-only interactions.
- `touch-action: manipulation` on buttons (no double-tap zoom, no 300ms delay). Use `pointerdown` for time-critical taps (shot buttons, power meter), not `click`.
- Prevent text selection and long-press menus on game controls.
- Readable in sunlight: high contrast, minimum 16px body text.
- In landscape, show the layout centred at phone width rather than breaking.

## 8. Definition of done and common pitfalls (QA checklist for Violet)

These are the usual "vibe-coded game" bugs. Each one is a release blocker.

1. **Score maths:** overs show 0.1 to 0.5 then 1.0 (never 0.6); wides and no-balls do not count as legal balls; run rate never shows `NaN` or `Infinity` at 0 balls.
2. **Innings end:** chase ends the moment the target is passed, even mid-over; all out at 10 wickets (not 11); ties show "Match tied".
3. **Strike rotation:** odd runs swap ends; end of over swaps ends; new batter comes in at the dismissed batter's end.
4. **Bowler rules:** no bowler bowls consecutive overs or more than the cap.
5. **Timers:** every `setInterval`, `setTimeout` and `requestAnimationFrame` is cleared in `unmount`. Leaving and replaying must not speed up the game or double-fire.
6. **Input:** double taps cannot play two shots on one ball; controls are disabled between balls; buttons work with touch, mouse and keyboard.
7. **State:** Play Again starts a clean match (no leftover scores); browser refresh simply restarts.
8. **Security (Mark):** render names and commentary with `textContent`, never `innerHTML` with interpolated strings; no `eval` or `new Function`; no third-party scripts, CDNs, analytics or trackers; a strict CSP meta tag (`default-src 'self'`); no secrets in the repo.
9. **Copyright (Mark):** no real player surnames (denylist test passes), no EA, Real Cricket, ICC, IPL or board logos, names or assets. Nation names and plain colours are fine.
10. **Quality:** zero console errors during a full match; `node --test` passes; the game is playable start to finish at 360px wide in Chrome DevTools mobile mode and on a real phone if possible.

## 9. Plan to 9am

| Step | Ayush | Joel |
|---|---|---|
| 1 | `rng.js`, `match.js` state + `playBall` with a simple outcome table, engine tests | `nations.js`, `names.js`, denylist, `generateTeam`, names tests, `index.html` + router shell |
| 2 | `play.js`: batting tap timing, bowling line/length + meter, AI turns | Menu, Team Select, Setup, Toss screens, scoreboard component |
| 3 | Tune outcome table so scores feel like T20 (roughly 8 to 10 runs per over at Normal) | Innings Break and Result screens, mobile polish |
| 4 | Integrate on `main`, Violet runs section 8, Mark reviews section 8 items 8 and 9 | |

Work on separate branches, one PR per track, small commits. Joel merges the shell first so Ayush can plug `play.js` in.

## 10. Cut list (drop in this order if time runs short)

1. Difficulty levels (ship Normal only)
2. Canvas animation (fall back to a CSS progress bar for ball travel)
3. Reroll names button
4. 10-over option
5. Run outs

## 11. Out of scope for v1

Multiplayer, tournaments, saving progress, sound, fielding control, DRS, player editing, real player likenesses.
