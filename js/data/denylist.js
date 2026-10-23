// Surnames of well-known current and past international cricketers, lowercase.
// The name generator rejects any surname on this list (SPEC section 5).

export const DENYLIST = new Set([
  // India
  'tendulkar', 'kohli', 'dhoni', 'sharma', 'dravid', 'ganguly', 'gavaskar', 'kapil', 'sehwag', 'singh',
  'kumble', 'ashwin', 'jadeja', 'bumrah', 'shami', 'pant', 'gill', 'iyer', 'rahul', 'pandya', 'yadav',
  'kumar', 'patel', 'jaiswal', 'siraj', 'chahal', 'laxman', 'khan', 'raina', 'gambhir', 'pujara',
  'rahane', 'shastri', 'azharuddin', 'srinath', 'samson', 'kishan', 'amarnath', 'vengsarkar', 'bedi',
  'prasanna', 'chandrasekhar', 'manjrekar', 'tendulkar', 'agarkar', 'nehra', 'pathan', 'karthik',
  // England
  'root', 'stokes', 'anderson', 'broad', 'cook', 'pietersen', 'flintoff', 'botham', 'buttler',
  'bairstow', 'archer', 'wood', 'brook', 'crawley', 'pope', 'leach', 'woakes', 'curran', 'ali',
  'rashid', 'strauss', 'vaughan', 'swann', 'bell', 'trott', 'morgan', 'hales', 'roy', 'duckett',
  'atkinson', 'gooch', 'gower', 'boycott', 'hobbs', 'hutton', 'compton', 'trueman', 'willis',
  'atherton', 'stewart', 'hussain', 'gough', 'harmison', 'hoggard', 'panesar', 'tremlett', 'finn',
  // Australia
  'bradman', 'ponting', 'warne', 'mcgrath', 'gilchrist', 'hayden', 'waugh', 'clarke', 'smith',
  'warner', 'cummins', 'starc', 'hazlewood', 'lyon', 'labuschagne', 'head', 'khawaja', 'maxwell',
  'marsh', 'carey', 'lee', 'johnson', 'hussey', 'langer', 'border', 'finch', 'green', 'inglis',
  'zampa', 'stoinis', 'lillee', 'thomson', 'benaud', 'chappell', 'healy', 'taylor', 'gillespie',
  'martyn', 'symonds', 'bevan', 'slater', 'haddin', 'paine', 'siddle', 'harris', 'konstas',
  // New Zealand
  'williamson', 'mccullum', 'boult', 'southee', 'vettori', 'hadlee', 'guptill', 'conway', 'latham',
  'santner', 'henry', 'jamieson', 'wagner', 'neesham', 'ravindra', 'mitchell', 'phillips', 'ferguson',
  'crowe', 'fleming', 'astle', 'cairns', 'bond', 'oram', 'styris', 'young', 'blundell', 'nicholls',
  'mcmillan', 'chatfield', 'turner', 'coney', 'rutherford', 'sodhi', 'milne', 'munro', 'seifert', 'bracewell',
  // West Indies
  'lara', 'richards', 'gayle', 'pollard', 'bravo', 'sammy', 'chanderpaul', 'holder', 'hope', 'pooran',
  'russell', 'narine', 'hetmyer', 'roach', 'joseph', 'brathwaite', 'walsh', 'ambrose', 'marshall',
  'holding', 'garner', 'lloyd', 'greenidge', 'haynes', 'sarwan', 'blackwood', 'baptiste', 'powell',
  'king', 'shepherd', 'chase', 'seales', 'motie', 'hosein', 'cottrell', 'samuels', 'simmons',
  'sobers', 'kanhai', 'worrell', 'weekes', 'walcott', 'hall', 'griffith', 'gibbs', 'bishop',
  'adams', 'hooper', 'ramdin', 'gabriel', 'taylor', 'edwards', 'benn', 'badree', 'carty', 'alzarri',
  // South Africa
  'de villiers', 'villiers', 'kallis', 'steyn', 'amla', 'pollock', 'donald', 'boucher',
  'du plessis', 'plessis', 'de kock', 'kock', 'rabada', 'ngidi', 'nortje', 'maharaj', 'bavuma',
  'markram', 'klaasen', 'miller', 'jansen', 'philander', 'morkel', 'duminy', 'tahir', 'kirsten',
  'cronje', 'klusener', 'shamsi', 'stubbs', 'rickelton', 'coetzee', 'van der dussen', 'elgar',
  'ntini', 'mulder', 'zorzi', 'rhodes', 'gibbs', 'boje', 'prince', 'nel', 'tsotsobe', 'parnell',
  'hendricks', 'phehlukwayo', 'mahlangu', 'magala', 'baartman', 'burger', 'maphaka',
  // Sri Lanka
  'jayasuriya', 'sangakkara', 'jayawardene', 'muralitharan', 'malinga', 'vaas', 'dilshan',
  'mathews', 'mendis', 'perera', 'karunaratne', 'chandimal', 'hasaranga', 'theekshana', 'pathirana',
  'shanaka', 'asalanka', 'nissanka', 'ranatunga', 'de silva', 'silva', 'atapattu', 'tharanga',
  'herath', 'fernando', 'rajitha', 'madushanka', 'wellalage', 'samarawickrama', 'dickwella',
  'kumara', 'wickramasinghe', 'dissanayake', 'gunathilaka', 'jayawickrama', 'lakmal', 'kulasekara',
  'mahanama', 'gurusinha', 'kaluwitharana', 'tillakaratne', 'wettimuny', 'madugalle', 'mendis',
  'rathnayake', 'liyanage', 'vandersay', 'chameera', 'thushara', 'kamindu', 'udana', 'ratnayake',
  'hettiarachchi', 'kandamby', 'bandara', 'kleinveldt', 'dhawan', 'gamage', 'jayasekera', 'wanigamuni', 'pushpakumara',
]);

// True for an exact match or a near miss: within 1 edit of a listed surname
// of 5+ letters (Kleinveld vs Kleinveldt) or 2 edits of one with 6+ letters
// (Charwal vs Chahal).
export function isDenied(surname) {
  const s = surname.trim().toLowerCase();
  if (DENYLIST.has(s)) return true;
  for (const real of DENYLIST) {
    const allowed = real.length >= 6 ? 2 : real.length >= 5 ? 1 : 0;
    if (allowed && Math.abs(real.length - s.length) <= allowed && editDistance(s, real) <= allowed) return true;
  }
  return false;
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
