# Stumps Ahead

A short-format cricket game for mobile browsers, inspired by EA Sports Cricket and Real Cricket 20 but much simpler. You play one T20-style match against the computer.

**Play it:** https://ptalati015.github.io/Stumps_Ahead/

## What's in the game

- Seven nations: India, England, Australia, New Zealand, West Indies, South Africa and Sri Lanka.
- Squads are generated fresh every session. All player names are fictional.
- Real home grounds for each nation (two per team), shown by their plain names without sponsors.
- Batting with shot buttons (including Loft), moving across the crease, and right- and left-handed batters.
- Bowling where you drag a landing ring to pick where the ball pitches. You also choose a variation (swing, slower ball or spin), and whether to bowl over or around the wicket.
- Red, white or pink ball. A pink ball makes it a night match under floodlights.
- 2, 5 or 10 overs, at Easy, Normal or Hard difficulty.

There is no backend, no account and no saved data. Refreshing the page starts a new session.

## Run it locally

You need any static file server, because ES modules don't load from `file://`.

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Tests

Tests use Node's built-in runner (Node 22 or later). There are no dependencies to install.

```sh
node --test
```

QA scripts live in `qa/` (see `qa/QA_CHECKLIST.md`). `node qa/check-names.mjs` checks that no generated name matches a real cricketer. `node qa/smoke.mjs` runs a headless mobile smoke test and needs Playwright.

## Project layout

```
index.html        App shell
css/              Styles
js/main.js        Screen router; holds the current match
js/engine/        Match rules, outcomes, AI, seeded RNG (pure, no DOM)
js/data/          Nations, name generator, venues
js/ui/            Screens, scoreboard, match scene, input
js/version.js     Current version
tests/            Node tests
qa/               QA checklist and scripts
dev/              Developer test page for the play screen
```

## How the project works

- **SPEC.md** is the product spec and the contract between the engine and UI code, including who owns which file.
- **CHANGELOG.md** lists every release. Versions use semantic versioning: new features bump the minor version and fixes bump the patch. The version in `js/version.js` is changed only in release PRs.
- Changes go through pull requests. Merging to `main` needs the owner's approval. GitHub Pages deploys from `main`.

The team works in named roles: Karen (product and spec), Ayush (match engine and play screen), Joel (teams, names and UI screens), Mark (security), Violet (QA), Researcher (ideas for what to build next) and Julie (docs, bug triage and release checks).
