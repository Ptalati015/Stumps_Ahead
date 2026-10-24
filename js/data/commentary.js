// Commentary lines (SPEC 16.2). Plain-text templates only: the engine's
// commentaryFor fills the placeholders and the UI renders with textContent,
// so nothing here is ever parsed as HTML. Player names arrive through the
// placeholders, so every name stays fictional.
//
// Placeholders: {batter} {bowler} {fielder} {how} (a shot phrase such as
// "a crisp straight drive") {where} (a field area such as "to cover")
// {n} (a number).

/** @type {Record<string, string[]>} */
export const COMMENTARY = {
  // ---- Dots ----
  dot_defend: [
    'Solid defence from {batter}.',
    '{batter} blocks it back down the pitch.',
    'Watchful stuff, {batter} keeps it out.',
    '{bowler} asks the question and {batter} answers with a dead bat.',
    'Nothing loose there, defended by {batter}.',
  ],
  dot_fielded: [
    '{how} from {batter}, straight to {fielder}.',
    'Pushed {where}, {fielder} cuts it off. No run.',
    '{batter} finds {fielder} {where}.',
    'Well struck {where}, but {fielder} is right behind it.',
    'Picked up smartly by {fielder}, they stay put.',
  ],
  beaten: [
    'Beaten! That one goes past the edge.',
    '{bowler} beats the outside edge of {batter}.',
    '{batter} has a waft and misses.',
    'A lovely delivery, {batter} plays and misses.',
  ],
  leave: [
    '{batter} shoulders arms.',
    'Left alone, through to the keeper.',
    'A good leave from {batter}.',
    '{batter} watches it all the way and lets it go.',
  ],

  // ---- Runs ----
  single: [
    'Worked {where} for a single.',
    '{batter} pushes it {where} and takes one.',
    'Quick single, {batter} is home with ease.',
    'Just the one, tucked away {where}.',
  ],
  two: [
    'Placed {where} and they come back for two.',
    'Good running from {batter}, two more.',
    'Two to {batter}, {fielder} chases it down {where}.',
    'They push hard and pick up a couple.',
  ],
  three: [
    'Three! Fine running between the wickets.',
    'All the way out {where}, and they run three.',
    '{batter} threads it {where}, {fielder} keeps it to three.',
    'Three more to {batter}, well judged.',
  ],
  four: [
    'FOUR! {how} from {batter}.',
    'Cracked away {where} for four!',
    '{batter} pierces the field {where}, four runs.',
    'To the rope {where}, no one is catching that.',
    'Four! {fielder} gives chase but it wins the race.',
  ],
  six: [
    'SIX! {batter} goes big {where}!',
    'That is huge! {how} and it sails over the rope.',
    '{batter} launches {bowler} into the crowd!',
    'Six more! {fielder} can only watch it fly {where}.',
  ],

  // ---- Wickets ----
  bowled: [
    'Bowled! {bowler} crashes through the gate.',
    'Timber! {batter} plays all around it.',
    'The stumps are rattled, {batter} has to go.',
    'Cleaned up! A beauty from {bowler}.',
  ],
  caught: [
    'Caught! {fielder} takes it {where}.',
    'Up in the air... and {fielder} holds on!',
    '{batter} picks out {fielder}. Gone.',
    'Straight down the throat of {fielder}.',
  ],
  caught_behind: [
    'Edged and taken! The keeper makes no mistake.',
    'A thin edge from {batter}, and that is out.',
    '{bowler} finds the edge, caught behind.',
    'A feather through to the keeper, {batter} walks.',
  ],
  lbw: [
    'Given! {batter} is trapped right in front.',
    'A big appeal... and the finger goes up. LBW.',
    '{bowler} pins {batter} on the pads, that is plumb.',
    'It kept straight and {batter} is LBW.',
  ],
  runout: [
    'Run out! The throw from {fielder} is right on the stumps.',
    'They went for a tight one and {batter} is well short!',
    'Direct hit from {fielder}! {batter} has to go.',
    'A dreadful mix-up, and {batter} pays for it.',
  ],

  // ---- Extras ----
  wide: [
    'Wide, says the umpire.',
    '{bowler} sprays that one, called wide.',
    'Too far across, and the arms go out. Wide.',
    'A wide, one more to the total.',
  ],
  noball: [
    'No ball! {bowler} oversteps.',
    'The arm goes out, no ball.',
    '{bowler} has overstepped, a run gifted.',
    'No ball called, and {bowler} is not happy.',
  ],

  // ---- Milestones ----
  fifty: [
    'FIFTY for {batter}!',
    'That is a half-century, {batter} raises the bat.',
    '{batter} brings up fifty with that one.',
    'A fine fifty for {batter}, well played.',
  ],
  hundred: [
    'HUNDRED! What an innings from {batter}!',
    '{batter} reaches a magnificent century!',
    'Three figures for {batter}!',
    'A hundred for {batter}, take a bow.',
  ],
  threefor: [
    'That is three wickets for {bowler}.',
    '{bowler} has three now and is right on top.',
    'A third wicket for {bowler}.',
    'Three-for! {bowler} is running through them.',
  ],
  fivefor: [
    'FIVE WICKETS for {bowler}!',
    'A five-for! What a spell from {bowler}.',
    '{bowler} takes a fifth. Remarkable bowling.',
    'Five for {bowler}, hats off.',
  ],
  hattrick_ball: [
    '{bowler} is on a hat-trick!',
    'Two in two. The field crowds in for {bowler}.',
    'Hat-trick ball coming up for {bowler}.',
    'Can {bowler} make it three in three?',
  ],
  hattrick: [
    'HAT-TRICK! {bowler} has three in three!',
    'Unbelievable! A hat-trick for {bowler}!',
    '{bowler} completes the hat-trick!',
    'Three in a row! A hat-trick for {bowler}!',
  ],
  maiden: [
    'A maiden over from {bowler}.',
    'Nothing off it. A maiden for {bowler}.',
    '{bowler} finishes a tidy maiden.',
    'Six dots in it, a maiden for {bowler}.',
  ],
  partnership50: [
    'Fifty partnership between these two.',
    'The stand is worth fifty now.',
    'A fifty partnership, built the hard way.',
    'These two have put on fifty together.',
  ],

  // ---- Situations ----
  last_over: [
    '{n} needed off the last over.',
    'Last over: {n} to win.',
    'It all comes down to this. {n} off six balls.',
    '{n} required from the final over.',
  ],
  won_it: [
    '{batter} wins it! What a finish!',
    'That is the match! They have done it!',
    'The winning runs, and it is all over!',
    '{batter} seals the win!',
  ],
};
