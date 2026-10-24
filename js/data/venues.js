// Two real home grounds per nation (SPEC 13.4, changed at Talati's request).
// Ground names only: no sponsor names, logos or board marks. Purely visual:
// the engine never reads a venue. stands = [lower tier, upper tier, roof
// trim]; sky = tint laid over the day sky. tagline: one factual line in our
// own words for the Venue screen (SPEC 14.1).

/** @typedef {{id:string, nation:import('../types.js').NationCode, name:string, city:string, tagline:string, stands:[string,string,string], sky:string}} Venue */

/** @type {Venue[]} */
export const VENUES = [
  { id: 'ind-eden-gardens', nation: 'IND', name: 'Eden Gardens', city: 'Kolkata', tagline: 'Kolkata\'s historic giant, home to some of cricket\'s biggest crowds', stands: ['#3b5fa8', '#e98a2c', '#f2efe6'], sky: '#f6d8a8' },
  { id: 'ind-wankhede', nation: 'IND', name: 'Wankhede Stadium', city: 'Mumbai', tagline: 'Seaside Mumbai ground that hosted the 2011 World Cup final', stands: ['#2f7d6a', '#5d8fd1', '#e8ece9'], sky: '#b9c9d8' },
  { id: 'eng-lords', nation: 'ENG', name: "Lord's", city: 'London', tagline: 'St John\'s Wood ground famous for its slope and pavilion', stands: ['#24345e', '#b8323f', '#efe9dc'], sky: '#c9d3df' },
  { id: 'eng-the-oval', nation: 'ENG', name: 'The Oval', city: 'London', tagline: 'South London ground that staged England\'s first home Test in 1880', stands: ['#5a6b3e', '#8c7a5b', '#ece6d6'], sky: '#d0d9e2' },
  { id: 'aus-mcg', nation: 'AUS', name: 'Melbourne Cricket Ground', city: 'Melbourne', tagline: 'Australia\'s biggest ground, where the first Test was played in 1877', stands: ['#a5452c', '#d9a930', '#f3ede0'], sky: '#9fd0f2' },
  { id: 'aus-scg', nation: 'AUS', name: 'Sydney Cricket Ground', city: 'Sydney', tagline: 'Moore Park ground with heritage-listed members\' stands', stands: ['#1f7f8f', '#f08a6c', '#f4f1ea'], sky: '#8fd6f0' },
  { id: 'nz-basin-reserve', nation: 'NZ', name: 'Basin Reserve', city: 'Wellington', tagline: 'Wellington ground set inside a busy traffic roundabout', stands: ['#2b2b2b', '#e1b52e', '#e6e8eb'], sky: '#b8d4e8' },
  { id: 'nz-hagley-oval', nation: 'NZ', name: 'Hagley Oval', city: 'Christchurch', tagline: 'Tree-lined park ground in the heart of Christchurch', stands: ['#26425e', '#9aa6b2', '#eef1f4'], sky: '#a9cde6' },
  { id: 'wi-kensington', nation: 'WI', name: 'Kensington Oval', city: 'Bridgetown', tagline: 'Barbados ground that hosted the 2007 World Cup final', stands: ['#7a1e3a', '#f2b705', '#f6f1e4'], sky: '#8fd3f4' },
  { id: 'wi-queens-park', nation: 'WI', name: "Queen's Park Oval", city: 'Port of Spain', tagline: 'Large Port of Spain ground looking out to the Northern Range hills', stands: ['#18806b', '#e2533a', '#f5efe0'], sky: '#9ad9ee' },
  { id: 'sa-newlands', nation: 'SA', name: 'Newlands', city: 'Cape Town', tagline: 'Cape Town ground in the shadow of Table Mountain', stands: ['#a8763e', '#3e6b4f', '#efe6d4'], sky: '#a8d0ef' },
  { id: 'sa-wanderers', nation: 'SA', name: 'The Wanderers', city: 'Johannesburg', tagline: 'Johannesburg ground nicknamed the Bullring for its steep stands', stands: ['#6d4fa3', '#2f7d4f', '#efeaf4'], sky: '#b4cdee' },
  { id: 'sl-premadasa', nation: 'SL', name: 'R. Premadasa Stadium', city: 'Colombo', tagline: 'Sri Lanka\'s largest ground and a regular day-night venue', stands: ['#0a3d91', '#e5739a', '#f2eee6'], sky: '#9fd3ea' },
  { id: 'sl-galle', nation: 'SL', name: 'Galle International Stadium', city: 'Galle', tagline: 'Seaside ground beside the old Dutch fort walls', stands: ['#2f6b3a', '#f5a301', '#eef0e6'], sky: '#b7d9cf' },
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
