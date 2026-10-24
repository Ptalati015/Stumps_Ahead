# Changelog

All notable changes to Stumps Ahead. Versions follow semantic versioning: features bump the minor version, fixes the patch.

## 1.4.0 - 2026-10-24

- Batting direction pad: pick where to hit (cover, straight, mid-wicket, point, square leg, third man, fine leg, or Auto) next to the shot buttons. It stays set between balls, and each shot only goes where that shot can go. Aiming against the line of the ball is a little riskier. Auto plays exactly as before.
- Richer commentary: several lines for every kind of ball, fewer repeats, and lines that say where a fielded ball went.
- Milestones: fifties, hundreds, three- and five-wicket hauls, hat-trick balls and hat-tricks, maidens and 50 partnerships get a line, and the big ones get a banner. The last over and the winning runs get a line too.
- Pause: a pause button during the match opens the full scorecard, a short how-to-play, Resume, and Quit to menu (with a confirm).

## 1.3.1 - 2026-10-24

- The arrival marker at the batter's crease is removed from the play view. Wides are still decided by where the ball reaches the batter; the engine just keeps that to itself.

## 1.3.0 - 2026-10-24

- Fix: wides are now decided only by where the ball reaches the batter (more than 0.9 m outside off, or past 0.45 m down leg). A ball that reaches the batter on the stumps is never a wide, and the arrival marker shows where it will reach; wayward deliveries can still drift wide.
- Over or around the wicket: a bowling toggle that stays set between balls. The bowler runs in from that side, the umpire moves across, and the angle changes the ball's path and slightly shifts the chances of LBW and edges. The AI bowler switches sides too.
- An arrival marker at the batter's crease shows where your delivery will reach the batter, and turns red if it will be a wide.
- Batting: swipe-to-hit, the yellow aim arrow and the Aerial toggle are removed. Shot buttons (including Loft), moving the batter and the hit line stay.

## 1.2.0 - 2026-10-24

- Venue screen: choosing the ground is now its own screen between Match Setup and the toss. It shows illustrated cards for both teams' home grounds, with Home/Away tags, city and a short description, and night versions with floodlights for a pink ball.
- Fix: inswing and outswing (most visibly on yorkers) no longer swerve off the pitch and back. Swing is now a smooth curve in the air, and the ball stays on the pitch unless it is a wide.

## 1.1.0 - 2026-10-24

- Bowling: drag the landing ring to pick exactly where the ball pitches. The Line and Length buttons still work as presets.
- Bowling variations: Stock, Inswing, Outswing and Slower for pace bowlers; Turn in and Turn away for spinners. The AI bowler uses them too.
- Venues: two real home grounds per nation (names only), picked on the Setup screen and shown on the toss, play and result screens.
- Ball colour: red, white or pink. A pink ball turns the match into a night game under floodlights.
- The version number now shows on the menu and result screens.

## 1.0.0 - 2026-10-24

- Single-session T20-style cricket game for mobile browsers: seven nations, generated fictional squads, toss, batting and bowling, scorecards and result.
- Animated match scene with a broadcast-style pitch cam and a field cam.
- Batting upgrade: camera behind the batter, right- and left-handed stances, moving across the crease, swipe to hit with aim arrow and hit line, and shot flight that matches the result.
