// Seven nations, plain colours only (no flags, crests or board logos).
// `spinBias` is how many of the four specialist bowlers are spinners.

/** @type {Record<import('../types.js').NationCode, {code:string, name:string, colors:{primary:string, secondary:string}, spinBias:number}>} */
export const NATIONS = {
  IND: { code: 'IND', name: 'India', colors: { primary: '#1f5fbf', secondary: '#ff9933' }, spinBias: 2 },
  ENG: { code: 'ENG', name: 'England', colors: { primary: '#14306b', secondary: '#d4213d' }, spinBias: 1 },
  AUS: { code: 'AUS', name: 'Australia', colors: { primary: '#e8b80c', secondary: '#0f6b3a' }, spinBias: 1 },
  NZ: { code: 'NZ', name: 'New Zealand', colors: { primary: '#1b1b1b', secondary: '#c9ced6' }, spinBias: 1 },
  WI: { code: 'WI', name: 'West Indies', colors: { primary: '#7a1e3a', secondary: '#f2b705' }, spinBias: 1 },
  SA: { code: 'SA', name: 'South Africa', colors: { primary: '#006b3f', secondary: '#ffb612' }, spinBias: 1 },
  SL: { code: 'SL', name: 'Sri Lanka', colors: { primary: '#0a3d91', secondary: '#f5a301' }, spinBias: 2 },
};

export const NATION_CODES = Object.keys(NATIONS);
