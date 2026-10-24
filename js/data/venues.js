// Two fictional home grounds per nation (SPEC 13.4). Names were web-checked
// so none is a real ground or trademark. Purely visual: the engine never
// reads a venue. stands = [lower tier, upper tier, roof trim]; sky = tint
// laid over the day sky.

/** @typedef {{id:string, nation:import('../types.js').NationCode, name:string, city:string, stands:[string,string,string], sky:string}} Venue */

/** @type {Venue[]} */
export const VENUES = [
  { id: 'ind-saffron', nation: 'IND', name: 'Saffron Park', city: 'Saffronpur', stands: ['#3b5fa8', '#e98a2c', '#f2efe6'], sky: '#f6d8a8' },
  { id: 'ind-monsoon', nation: 'IND', name: 'Monsoon Oval', city: 'Varshanagar', stands: ['#2f7d6a', '#5d8fd1', '#e8ece9'], sky: '#b9c9d8' },
  { id: 'eng-thornleigh', nation: 'ENG', name: 'Thornwexley Park', city: 'Thornwexley', stands: ['#24345e', '#b8323f', '#efe9dc'], sky: '#c9d3df' },
  { id: 'eng-riverbend', nation: 'ENG', name: 'Riverbend Ground', city: 'Wexford-on-Lea', stands: ['#5a6b3e', '#8c7a5b', '#ece6d6'], sky: '#d0d9e2' },
  { id: 'aus-redgum', nation: 'AUS', name: 'Red Gum Oval', city: 'Murrabyn', stands: ['#a5452c', '#d9a930', '#f3ede0'], sky: '#9fd0f2' },
  { id: 'aus-coral', nation: 'AUS', name: 'Coral Coast Stadium', city: 'Tindaport', stands: ['#1f7f8f', '#f08a6c', '#f4f1ea'], sky: '#8fd6f0' },
  { id: 'nz-kowhai', nation: 'NZ', name: 'Kowhai Ridge Oval', city: 'Rangiwai', stands: ['#2b2b2b', '#e1b52e', '#e6e8eb'], sky: '#b8d4e8' },
  { id: 'nz-harbourview', nation: 'NZ', name: 'Harbourview Oval', city: 'Port Tamaki', stands: ['#26425e', '#9aa6b2', '#eef1f4'], sky: '#a9cde6' },
  { id: 'wi-tradewinds', nation: 'WI', name: 'Trade Winds Ground', city: 'Belmont Bay', stands: ['#7a1e3a', '#f2b705', '#f6f1e4'], sky: '#8fd3f4' },
  { id: 'wi-calypso', nation: 'WI', name: 'Calypso Park', city: 'St Delacroix', stands: ['#18806b', '#e2533a', '#f5efe0'], sky: '#9ad9ee' },
  { id: 'sa-karoo', nation: 'SA', name: 'Karoo Oval', city: 'Doringvlakte', stands: ['#a8763e', '#3e6b4f', '#efe6d4'], sky: '#a8d0ef' },
  { id: 'sa-jacaranda', nation: 'SA', name: 'Jacaranda Park', city: 'Riethoek', stands: ['#6d4fa3', '#2f7d4f', '#efeaf4'], sky: '#b4cdee' },
  { id: 'sl-lotuslake', nation: 'SL', name: 'Lotus Lake Stadium', city: 'Wellagama', stands: ['#0a3d91', '#e5739a', '#f2eee6'], sky: '#9fd3ea' },
  { id: 'sl-teahills', nation: 'SL', name: 'Tea Hills Oval', city: 'Theyilagama', stands: ['#2f6b3a', '#f5a301', '#eef0e6'], sky: '#b7d9cf' },
];

const BY_ID = new Map(VENUES.map((v) => [v.id, v]));

/** @returns {Venue|null} */
export function getVenue(id) {
  return BY_ID.get(id) ?? null;
}

/** A nation's two grounds, in order. */
export function venuesFor(code) {
  return VENUES.filter((v) => v.nation === code);
}
