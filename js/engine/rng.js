// Seeded random numbers. All game randomness goes through here so matches
// can be replayed in tests. Pure: no DOM, no Math.random.

/**
 * @param {number} seed
 * @returns {{ next(): number, int(min:number, max:number): number, pick<T>(arr:T[]): T,
 *   weighted(weights:Object<string, number>): string, normal(): number, state(): number }}
 */
export function createRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // Pick a key of { key: weight } in proportion to its weight.
    weighted(weights) {
      const entries = Object.entries(weights).filter(([, w]) => w > 0);
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let roll = next() * total;
      for (const [key, w] of entries) {
        roll -= w;
        if (roll < 0) return key;
      }
      return entries[entries.length - 1][0];
    },
    // Standard normal sample (Box-Muller).
    normal() {
      const u = Math.max(next(), 1e-9);
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
    // Current internal state, to store in MatchState and resume from later.
    state: () => a,
  };
}

// Derive an independent stream from a stored state, so read-only helpers
// (AI choices, delivery preview) are repeatable without advancing the match.
export function forkRng(stateValue, salt) {
  return createRng(Math.imul((stateValue ^ salt) >>> 0, 2654435761) >>> 0);
}

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
