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

## 12. Phase 3: batting upgrade

Talati's feedback on the play view: the batter should be movable before the ball, the chosen shot should visibly happen (a loft should look like a loft), the stance currently looks wrong for a right-hander, and batting should support swipe-to-hit with a visible hit line, like most mobile sports games. Match rules, scoring, the outcome table's balance and team generation stay as they are, apart from the small additive changes listed here.

### 12.1 What the player sees and does

**Batting camera.** When the user bats, the pitch cam moves to behind the batter, looking down the pitch at the bowler, like EA Cricket and Real Cricket. When the user bowls, the current camera behind the bowler stays.

**Correct stance, right- and left-handed.**
- Right-hander, seen from behind: he stands side-on with his left shoulder toward the bowler, chest facing the off side, which is screen right. The bat is grounded behind his back foot near middle stump, and the bat face points down the pitch, toward the bowler.
- Left-hander: the exact mirror image. He faces screen left, and every off/leg direction on screen flips.
- The bat swings in 3D. Model the bat as a segment in world space and project it with the existing `project()`. Do not rotate a flat profile drawing in the screen plane, because that is why it currently looks wrong.

**Move the batter.** From the start of the bowler's run-up until the ball is released, the user can shuffle across the crease.
- Controls: drag the batter left or right, or use two ◀ ▶ buttons, each step 0.15 m.
- Range: 0.6 m toward the off side to 0.6 m toward the leg side of the normal guard.
- The position locks at release. A small marker on the crease shows the current position.
- It resets to normal guard for each new ball.

**Swipe to hit.** The swipe zone is the lower half of the delivery view.
- Swipe direction sets where the ball goes. Up means straight back past the bowler. Toward the off side means cover or point. Down and to the side means square or behind square. This is mirrored for left-handers.
- Timing is taken at the moment the swipe passes 30 px, using the same windows as today (perfect ±60 ms, and so on).
- A tap with no swipe means Defend.
- A swipe longer than max(110 px, 40% of the zone height) (the phone swipe zone is only about 100 px tall, so 40% alone made almost every swipe a loft), or any swipe while the **Loft** toggle is on, is played in the air.
- The shot type comes from the swipe angle and aerial flag:

| Swipe sector (right-hander, 0° = straight up) | Ground shot | In the air |
|---|---|---|
| -30° to +30° (straight) | drive | loft |
| -30° to -110° (off side) | drive (cover) or cut (square, past -70°) | loft |
| +30° to +110° (leg side) | pull | loft |
| beyond ±110° (behind square) | cut (off) / pull (leg) | loft |

**Shot buttons stay as an alternative.** Each button plays its shot in a default direction: Defend straight, Drive -20°, Cut -85°, Pull +80°, Loft 0°. The Loft button is a single tap-to-play-loft; the Loft toggle is only for swipes.

**Aim line and hit line.**
- While the finger is down, an arrow from the batter shows the swipe direction: dashed for ground shots, arched for aerial ones.
- After contact, the field cam draws the actual path of the ball. Ground shots get a solid line along the turf. Aerial shots get an arc, with the shadow on the ground separated from the ball.
- The line fades when the next ball starts.

**Visible shots.** Each shot has its own swing, and the ball's flight matches what the engine decided:
- **Loft:** a high follow-through, and the ball climbs. A six clears the rope in the air. A catch is taken by the fielder nearest the landing point.
- **Drive:** a full face down the ground, and the ball rolls.
- **Cut** and **pull:** a horizontal bat on the right side.
- **Defend:** the ball drops dead near the batter.
- **Early** timing sends the ball squarer on the leg side for a right-hander. **Late** timing sends it squarer on the off side, toward the keeper and slips on an edge.

### 12.2 Engine changes (Ayush), additive

`BatInput` gains optional fields. If they are left out, behaviour is exactly as today, so the existing tests and the AI keep working.

```js
/** @typedef {Object} BatInput
 * @property {'defend'|'drive'|'pull'|'cut'|'loft'|'leave'} shot
 * @property {number|null} timingMs
 * @property {number} [offsetX]   metres, -0.6..0.6, + = toward the batter's leg side
 * @property {number} [aimDeg]    intended direction, -180..180, 0 = straight, + = leg side (batter-relative, so the same for R and L)
 * @property {boolean} [aerial]
 */
```

- **Position:** the effective line is shifted by `offsetX`.
  - Moving 0.3 m or more toward the off side turns an off-stump ball into a middle ball, and a middle ball into leg.
  - Moving toward the leg side does the opposite.
  - Exposing the stumps raises the bowled/LBW weight for a missed or Leave ball on that line. A straight ball with the batter moved 0.45 m or more to the leg side counts as aimed at the stumps.
- **Direction:** `aimDeg` feeds the result. The final angle is `aimDeg` plus a timing error: perfect ±5°, good ±12°, and early/late add 25° to 40° toward the leg side (early) or the off side (late), plus edge risk.
- A shot played against its natural region keeps the existing fit penalties, which are now keyed by the derived shot. An example is a pull aimed through cover.
- `BallResult` gains the following fields. The scene uses them instead of picking its own random direction, so the picture always matches the scorecard:

```js
 * @property {number|null} angleDeg   final direction, batter-relative, same convention as aimDeg
 * @property {boolean} aerial
 * @property {number|null} carryM     metres the ball travels in the air (0 for ground shots)
 * @property {number|null} distanceM  total distance; >= rope for a four, carryM >= rope for a six
```
- **AI batting** (user bowls) fills `aimDeg`, `aerial` and `offsetX` too, using the same derivation, so the scene shows its shots the same way.
- **Tests:**
  - Leaving the new fields out gives identical results to today for a fixed seed.
  - A six always has `aerial: true` and `carryM` at least the rope distance.
  - `angleDeg` stays within the timing error band.
  - A batter moved to the leg side gets bowled more often by a straight ball over 2,000 seeded balls.
  - The existing 270-match invariant test still passes.

### 12.3 Teams change (Joel), additive

`Player` gains `bats: 'R'|'L'`, and about 30% of players are left-handed. `generateTeam` sets it from the passed-in rng. No other change to names or ratings.

### 12.4 Scene API (Joel provides, Ayush calls from play.js)

The existing `newBall, setMarker, hideMarker, runUp, release, swing, outcome, destroy` keep working. Add:

```js
scene.setCamera('batting' | 'bowling')
scene.setBatter({ bats: 'R'|'L', offsetX: number })   // call on new ball and on every move; animates the shuffle
scene.showAim({ aimDeg, aerial } | null)               // live arrow while swiping; null hides it
scene.swing(shot, { aimDeg, aerial })                  // existing call, extra arg picks the swing variant
scene.outcome(ball)                                    // now reads ball.angleDeg / aerial / carryM / distanceM and draws the hit line
```

All angles are batter-relative. The scene mirrors them for left-handers and for the camera. play.js never deals with screen directions except to turn the swipe vector into `aimDeg`, using `swipeToAim(dx, dy, bats)` in `js/ui/input/swipe.js` (Ayush, pure, unit tested).

### 12.5 File ownership for this phase

| Ayush | Joel |
|---|---|
| `js/engine/outcomes.js`, `match.js`, `ai.js`, `tests/engine.test.js` | `js/ui/scene/scene.js`, `figures.js`, `svg.js` |
| `js/ui/screens/play.js` (move controls, swipe zone, Loft toggle, wiring) | `js/data/names.js` (`bats`), `tests/names.test.js` |
| `js/ui/input/swipe.js` + `tests/swipe.test.js` | `css/play.css` styling for the move buttons, swipe zone and toggle |
| `js/types.js` (`BatInput` and `BallResult` additions) | `js/types.js` (`Player.bats` only) |

Joel lands the scene API (12.4) first with stubs that already accept the new arguments, so Ayush can wire play.js against it in parallel. One PR per dev, rebased on main. Ayush's PR should merge first if both touch `js/types.js`.

### 12.6 Done when (for Violet and Mark)

1. A right-hander is seen side-on and facing screen right, a left-hander is the mirror, and the bat face points down the pitch in stance. Check this with a screenshot for each.
2. Moving the batter works by drag and by buttons, stops at ±0.6 m, locks at release and resets each ball. Moving well across and leaving a straight ball can get you bowled.
3. Swipe straight, cover, square-off, square-leg, and fine on both sides. Each one goes roughly where it was aimed, for both R and L batters. A tap defends.
4. Lofts visibly go in the air. Every six is shown in the air over the rope. Every four on the ground reaches the rope. Every caught dismissal is taken where the ball lands.
5. The aim arrow shows during the swipe, and the hit line is drawn after the shot and cleared on the next ball.
6. Swipes don't scroll or zoom the page (`touch-action: none` on the swipe zone only), and one ball can't take two inputs.
7. Shot buttons and keyboard shortcuts still work. All existing tests and QA scripts still pass, and the smoke test runs at 375px with no console errors.
8. Security: no new `innerHTML`, no new dependencies, and pointer handlers are removed in `unmount`.
