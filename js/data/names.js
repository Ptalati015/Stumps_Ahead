// Fictional squads. First names are common given names that fit each nation;
// surnames are invented by joining a made-up prefix and suffix, and any
// result on the denylist is thrown away. Pure module: no DOM, no Math.random.

import { NATIONS } from './nations.js';
import { isDenied } from './denylist.js';

const FIRST_NAMES = {
  IND: ['Aarav', 'Vihaan', 'Arjun', 'Kabir', 'Reyansh', 'Ishaan', 'Dev', 'Nikhil', 'Pranav', 'Siddharth',
    'Tanmay', 'Varun', 'Aditya', 'Kunal', 'Rohan', 'Yash', 'Harsh', 'Neel', 'Omkar', 'Samar'],
  ENG: ['Oliver', 'Harry', 'George', 'Freddie', 'Alfie', 'Charlie', 'Theo', 'Archie', 'Arthur', 'Toby',
    'Felix', 'Rory', 'Edward', 'Hugo', 'Max', 'Barnaby', 'Rupert', 'Callum', 'Jasper', 'Miles'],
  AUS: ['Jack', 'Lachlan', 'Cooper', 'Riley', 'Hamish', 'Angus', 'Flynn', 'Bailey', 'Darcy', 'Hudson',
    'Jett', 'Kai', 'Mack', 'Noah', 'Ollie', 'Paddy', 'Seb', 'Tate', 'Will', 'Zac'],
  NZ: ['Nikau', 'Tama', 'Wiremu', 'Manaia', 'Ari', 'Finn', 'Hunter', 'Logan', 'Mason', 'Ruben',
    'Hemi', 'Tane', 'Rawiri', 'Blake', 'Corey', 'Duncan', 'Ethan', 'Isaac', 'Kahu', 'Quinn'],
  WI: ['Andre', 'Jaden', 'Marlon', 'Tariq', 'Desmond', 'Kemar', 'Romario', 'Tevin', 'Akeem', 'Brandon',
    'Cleon', 'Dwayne', 'Javon', 'Keron', 'Leroy', 'Nigel', 'Odane', 'Rashad', 'Sheldon', 'Jermaine'],
  SA: ['Thabo', 'Sipho', 'Pieter', 'Johan', 'Kagiso', 'Lungile', 'Ruan', 'Wian', 'Bongani', 'Mandla',
    'Jaco', 'Dewald', 'Themba', 'Lwazi', 'Francois', 'Hendrik', 'Musa', 'Neo', 'Stefan', 'Tumelo'],
  SL: ['Kasun', 'Nuwan', 'Chamath', 'Dilan', 'Isuru', 'Lahiru', 'Pasan', 'Ravindu', 'Sahan', 'Tharindu',
    'Hasitha', 'Janith', 'Kavindu', 'Malith', 'Nipun', 'Oshada', 'Pulina', 'Sandun', 'Vihanga', 'Yasiru'],
};

// Each nation has one or two [prefixes, suffixes] sets; a surname is
// prefix + suffix from the same set.
const SURNAME_PARTS = {
  IND: [[['Vel', 'Ram', 'Dhar', 'Kan', 'Sur', 'Bhan', 'Ved', 'Nir', 'Char', 'Mad', 'Tal', 'Pav', 'Gop', 'Jai', 'Hem'],
    ['kari', 'wal', 'avat', 'ekar', 'iyan', 'ande', 'orkar', 'ithan', 'adkar', 'unde']]],
  ENG: [[['Ash', 'Brack', 'Thorn', 'Wex', 'Fallow', 'Haver', 'Mild', 'Pember', 'Raven', 'Stain', 'Ulver', 'Elm', 'Gild', 'Hollin', 'Quen'],
    ['combe', 'ley', 'worth', 'by', 'ford', 'ham', 'ridge', 'stead', 'thorpe', 'well']]],
  AUS: [[['Coola', 'Wattle', 'Yarra', 'Bunda', 'Dorri', 'Murra', 'Kurra', 'Tinda', 'Gunda', 'Mulla', 'Barra', 'Wonga'],
    ['by', 'ford', 'leer', 'dale', 'ton', 'wick', 'more', 'field', 'gate', 'combe']]],
  NZ: [[['Kai', 'Rangi', 'Wai', 'Tau', 'Hoki', 'Mata', 'Whare', 'Oto', 'Pae', 'Rua'],
    ['tara', 'nui', 'roa', 'wera', 'kino', 'hiku', 'mahi', 'tiki']],
  [['Ash', 'Kerr', 'Tussock', 'Glen', 'Brae', 'Fern', 'Stone'],
    ['burton', 'leigh', 'haven', 'muir', 'dale', 'wick']]],
  WI: [[['Charle', 'Mont', 'Bel', 'Dela', 'Fon', 'Gren', 'Lava', 'Tre', 'Vin', 'Rose', 'Spey', 'Gran'],
    ['ville', 'mont', 'clair', 'lette', 'ston', 'croix', 'mere', 'lawney', 'taine', 'court']]],
  SA: [[['Klein', 'Oost', 'Swart', 'Brand', 'Kroon', 'Groot', 'Riet', 'Wit', 'Berg', 'Mool'],
    ['veld', 'hoek', 'kop', 'vlei', 'stad', 'fontein', 'kloof', 'dorp']],
  [['Nko', 'Mthe', 'Zwe', 'Mabhe', 'Dla', 'Sitho', 'Qhu', 'Mpo', 'Ntu'],
    ['sana', 'njwa', 'lethu', 'ngu', 'muzi', 'beka', 'fana', 'thando']]],
  SL: [[['Amba', 'Ruhu', 'Dehi', 'Gal', 'Kande', 'Liyana', 'Maha', 'Panni', 'Wella', 'Kotta', 'Hetti', 'Ruwan'],
    ['pitiya', 'gedara', 'wala', 'kissa', 'gama', 'watte', 'arachchi', 'goda', 'wela', 'deniya']]],
};

// Batting order template: 5 batters (slot 6 keeps wicket), 2 all-rounders,
// 4 bowlers. Ratings are [min, max] inclusive, per SPEC section 5.
const SQUAD_TEMPLATE = [
  { role: 'BAT', bat: [70, 92], bowl: [5, 30] },
  { role: 'BAT', bat: [66, 90], bowl: [5, 30] },
  { role: 'BAT', bat: [72, 95], bowl: [10, 35] },
  { role: 'BAT', bat: [66, 92], bowl: [10, 35] },
  { role: 'WK', bat: [60, 85], bowl: [1, 10] },
  { role: 'AR', bat: [55, 78], bowl: [55, 80] },
  { role: 'AR', bat: [48, 72], bowl: [58, 82] },
  { role: 'BOWL', bat: [25, 40], bowl: [65, 92] },
  { role: 'BOWL', bat: [15, 35], bowl: [60, 95] },
  { role: 'BOWL', bat: [12, 30], bowl: [60, 95] },
  { role: 'BOWL', bat: [10, 25], bowl: [55, 92] },
];

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Every allowed surname for a nation (denylisted ones removed). */
export function surnamePool(code) {
  const out = new Set();
  for (const [prefixes, suffixes] of SURNAME_PARTS[code]) {
    for (const p of prefixes) {
      for (const s of suffixes) {
        // Skip awkward joins like Montmont or Ashhaven.
        if (s.toLowerCase().startsWith(p.toLowerCase()) || p.slice(-1).toLowerCase() === s[0]) continue;
        const name = p + s;
        if (!isDenied(name)) out.add(name);
      }
    }
  }
  return [...out];
}

function pickNames(code, count, rng, taken) {
  const firsts = shuffled(FIRST_NAMES[code], rng);
  const surnames = shuffled(surnamePool(code), rng);
  const names = [];
  for (let i = 0; i < surnames.length && names.length < count; i++) {
    const full = `${firsts[names.length % firsts.length]} ${surnames[i]}`;
    if (!taken.has(full)) {
      taken.add(full);
      names.push(full);
    }
  }
  if (names.length < count) throw new Error(`Could not generate ${count} names for ${code}`);
  return names;
}

function bowlTypes(code, rng) {
  // Four specialist bowlers: `spinBias` spinners, rest pace. All-rounders
  // are one of each so every side has a spin option.
  const spin = NATIONS[code].spinBias;
  const specialists = shuffled(['spin', 'spin', 'spin', 'spin'].fill('pace', spin), rng);
  return { AR: shuffled(['pace', 'spin'], rng), BOWL: specialists };
}

/**
 * @param {import('../types.js').NationCode} code
 * @param {{int(min:number, max:number):number}} rng
 * @param {Set<string>} [taken] full names already used in this match
 * @returns {import('../types.js').Team}
 */
export function generateTeam(code, rng, taken = new Set()) {
  const nation = NATIONS[code];
  if (!nation) throw new Error(`Unknown nation ${code}`);
  const names = pickNames(code, SQUAD_TEMPLATE.length, rng, taken);
  const types = bowlTypes(code, rng);
  let ar = 0;
  let bowl = 0;
  const players = SQUAD_TEMPLATE.map((slot, i) => {
    let bowlType = null;
    if (slot.role === 'AR') bowlType = types.AR[ar++];
    if (slot.role === 'BOWL') bowlType = types.BOWL[bowl++];
    return {
      id: `${code}-${i + 1}`,
      name: names[i],
      role: slot.role,
      batting: rng.int(slot.bat[0], slot.bat[1]),
      bowling: rng.int(slot.bowl[0], slot.bowl[1]),
      bowlType,
    };
  });
  return { code, name: nation.name, colors: { ...nation.colors }, players };
}

/** Both squads for one match, with no full name shared between them. */
export function generateFixture(userCode, aiCode, rng) {
  if (userCode === aiCode) throw new Error('Pick two different nations');
  const taken = new Set();
  return { userTeam: generateTeam(userCode, rng, taken), aiTeam: generateTeam(aiCode, rng, taken) };
}
