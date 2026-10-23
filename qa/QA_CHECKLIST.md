# QA checklist

What Violet (QA) checks on every PR. Tools in this folder:

- `node qa/check-names.mjs [dir]` fails if any name-shaped string matches a real cricketer's surname (list in `qa/real-surnames.mjs`).
- `node qa/smoke.mjs [dir] [taps]` opens the app headless at 375px wide, taps random buttons, and reports console errors, uncaught exceptions and horizontal overflow. It saves `qa/last-smoke.png`.

## Match engine

- [ ] An over is exactly 6 legal balls. Wides and no-balls add a run and do not count as a ball.
- [ ] Overs display as `O.B` with B in 0..5 (after 6 balls it is `1.0`, never `0.6`).
- [ ] Run rate = runs / (legal balls / 6). No divide-by-zero at 0 balls (show 0.00, not NaN or Infinity).
- [ ] Required run rate uses balls remaining, and handles 0 balls remaining.
- [ ] Strike rotates on odd runs (1, 3, 5) and at the end of each over; both apply on the last ball of an over.
- [ ] Innings ends at all out (10 wickets), at the over limit, or when the target is passed, whichever is first.
- [ ] Chase ends the moment the target is passed, even mid-over. No more balls are bowled.
- [ ] Target is first-innings score + 1.
- [ ] Results: "won by N runs" (team batting first), "won by N wickets" (chasing team, N = 10 − wickets lost), and tie when scores level at the end.
- [ ] Singular/plural is correct ("1 run", "1 wicket").
- [ ] A bowler cannot bowl two overs in a row. Bowler over limits (overs / 5) are respected if implemented.
- [ ] The next batter comes from the batting order; nobody bats twice; the not-out batter stays.
- [ ] Batter and bowler stats add up to the team total (runs, balls faced, extras listed separately).
- [ ] The engine never reads a missing player (index 11, or after all out) without crashing.

## State

- [ ] "Play again" / new match fully resets score, wickets, overs, batting order, stats and the result.
- [ ] Choosing new teams after a match does not keep old players.
- [ ] Refreshing mid-match does not leave a broken screen (it is fine if it restarts).
- [ ] Nothing is stored server-side; no network calls besides loading the app.

## Teams and names

- [ ] All 7 nations are present: IND, ENG, AUS, NZ, WI, SA, SL.
- [ ] Each team has 11 players, no duplicate names within a match.
- [ ] `check-names.mjs` passes.
- [ ] The same team cannot be picked for both sides (or it is handled).

## Mobile and UI

- [ ] No horizontal scroll at 375px wide; `<meta name="viewport">` is present.
- [ ] Buttons are at least ~44px tall and do not overlap the scoreboard.
- [ ] Rapid double-taps do not bowl two balls or skip a screen.
- [ ] No console errors or uncaught exceptions during a full match (`smoke.mjs` passes).
- [ ] Works in portrait; landscape does not break the layout.

## Common code issues to look for

- Off-by-one in over/ball counters and loops over 11 players.
- `==` vs `===`, string vs number scores (e.g. `"4" + 1` = `"41"`).
- `Math.random()` ranges that can produce an impossible value (e.g. index equal to array length).
- Event listeners added on every render without removal (doubled actions on the second match).
- `innerHTML` with any user-typed text (escape it).
- Timers (`setTimeout`/`setInterval`) not cleared when leaving a screen.
