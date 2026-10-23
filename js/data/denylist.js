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
  'hettiarachchi', 'kandamby', 'gamage', 'jayasekera', 'wanigamuni', 'pushpakumara',
]);

export function isDenied(surname) {
  return DENYLIST.has(surname.trim().toLowerCase());
}
