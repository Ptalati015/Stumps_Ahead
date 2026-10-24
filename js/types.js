// Shared data shapes for Stumps Ahead. Source of truth: SPEC.md section 6.

/** @typedef {'IND'|'ENG'|'AUS'|'NZ'|'WI'|'SA'|'SL'} NationCode */

/** @typedef {Object} Player
 * @property {string} id            unique within the match, e.g. 'IND-3'
 * @property {string} name          'Arjun Velkari'
 * @property {'BAT'|'WK'|'AR'|'BOWL'} role
 * @property {number} batting       1..100
 * @property {number} bowling       1..100
 * @property {'pace'|'spin'|null} bowlType
 * @property {'R'|'L'} bats         batting hand; about 30% left-handed
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
 * @property {string} [venueId]          js/data/venues.js id; visual only, the engine ignores it
 * @property {'red'|'white'|'pink'} [ball]   pink = night mode in the scene; visual only
 */

/** @typedef {Object} BowlInput
 * @property {'off'|'middle'|'leg'} line
 * @property {'yorker'|'full'|'good'|'short'} length
 * @property {number} accuracy      0..1 from the power meter (AI supplies its own)
 * @property {{x:number, z:number}} [pitch]   landing spot; x metres batter-relative (+ = leg side, 0 = middle stump), z metres from the batter's stumps
 * @property {'stock'|'in'|'out'|'slower'} [variation]
 * @property {'over'|'around'} [side]   bowler's side of the wicket; left out = 'over', played exactly as v1.2
 */

/** @typedef {Object} Delivery   what prepareDelivery returns; BallResult.delivery
 * @property {'off'|'middle'|'leg'} line   at the batter, after drift and swing
 * @property {'yorker'|'full'|'good'|'short'} length
 * @property {number} kph
 * @property {number} travelMs
 * @property {null|'wide'|'noball'} extra   wide only when arrivalX < -0.90 or > +0.45
 * @property {null|{x:number, z:number}} pitch   landing spot after scatter
 * @property {'stock'|'in'|'out'|'slower'} variation
 * @property {number} swingX     metres of swing/turn at the batter, + = toward leg
 * @property {'over'|'around'} side
 * @property {number} releaseX   release point across the crease, metres batter-relative
 * @property {number} arrivalX   where the ball reaches the batting crease, metres batter-relative
 * @property {null|'in'|'across'} angle   only set when BowlInput.side was given
 * @property {boolean} hattrickBall   the bowler's last two legal balls were both their wickets
 * @property {string|null} note       situational line for the run-up ("{n} needed off the last over")
 */

/** @typedef {Object} BatInput
 * @property {'defend'|'drive'|'pull'|'cut'|'loft'|'leave'} shot
 * @property {number|null} timingMs  tap time minus arrival time; null for leave/miss
 * @property {number} [offsetX]   metres, -0.6..0.6, + = toward the batter's leg side
 * @property {number} [aimDeg]    intended direction, -180..180, 0 = straight, + = leg side (batter-relative)
 * @property {boolean} [aerial]
 * @property {'auto'|'pad'} [aimSource]   'pad' clamps aimDeg to the shot's arc and can play against the line; left out = 'auto'
 */

/** @typedef {Object} BallResult
 * @property {number} runs          runs off the bat
 * @property {null|{type:'wide'|'noball', runs:number}} extra
 * @property {null|{kind:'bowled'|'caught'|'lbw'|'runout', batterId:string}} wicket
 * @property {'perfect'|'good'|'early'|'late'|'miss'|null} timing
 * @property {string} commentary     the ball's line, plus at most one milestone or situational line
 * @property {Array<{kind:'fifty'|'hundred'|'threefor'|'fivefor'|'hattrick_ball'|'hattrick'|'maiden'|'partnership50', playerId:string}>} milestones
 * @property {string|null} note     situational line ("And that wins it!"), else null
 * @property {number|null} angleDeg   final direction, batter-relative, same convention as aimDeg
 * @property {boolean} aerial
 * @property {number|null} carryM     metres in the air (0 for ground shots)
 * @property {number|null} distanceM  total distance; >= rope for a four, carryM >= rope for a six
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

export {};
