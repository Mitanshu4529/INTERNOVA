// City names for location matching.
//
// The catalogue and users spell the same place differently ("Bangalore" in 165
// listings, "Bengaluru" in 1,293), so names are mapped to one canonical form
// before comparing.

const CITY_ALIASES: Record<string, string> = {
  bangalore: 'bengaluru',
  bengalooru: 'bengaluru',
  blr: 'bengaluru',
  gurgaon: 'gurugram',
  bombay: 'mumbai',
  'navi mumbai': 'mumbai',
  calcutta: 'kolkata',
  madras: 'chennai',
  'new delhi': 'delhi',
  'delhi ncr': 'delhi',
  ncr: 'delhi',
  poona: 'pune',
  trivandrum: 'thiruvananthapuram',
  cochin: 'kochi',
  mysore: 'mysuru',
  vizag: 'visakhapatnam',
  vishakhapatnam: 'visakhapatnam',
  pondicherry: 'puducherry',
  baroda: 'vadodara',
  mangalore: 'mangaluru',
  'greater noida': 'noida',
};

/** One place name -> its canonical, lower-cased form. */
export function canonicalCity(name: string | null | undefined): string {
  const cleaned = (name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return CITY_ALIASES[cleaned] || cleaned;
}

/** All places named in a location string ("Mumbai, Pune / Bengaluru" -> three cities). */
export function citiesIn(location: string | null | undefined): string[] {
  return (location || '')
    .split(/[,/;|&]|\band\b/i)
    .map(canonicalCity)
    .filter(Boolean);
}

/**
 * True when the two locations name the same city. A user's "Bangalore"
 * matches "Bengaluru" and "Bengaluru, Karnataka, India"; "New Delhi" does not
 * match "New York", and "Goa" does not match "Goalpara".
 */
export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  const citiesA = citiesIn(a);
  const citiesB = new Set(citiesIn(b));
  return citiesA.some(city => citiesB.has(city));
}

// ---------------------------------------------------------------------------
// Nearby places
// ---------------------------------------------------------------------------
//
// A student in Noida can commute to Delhi or Gurugram, and a listing that only
// says "Kerala" may well be in the student's city. Neither is the same city,
// so they count as a partial match, below an exact one.

/** Cities that form one commuting area. */
const METRO_AREAS: Record<string, string[]> = {
  'Delhi NCR': ['delhi', 'noida', 'gurugram', 'ghaziabad', 'faridabad'],
  'Mumbai area': ['mumbai', 'thane'],
  'Chandigarh area': ['chandigarh', 'mohali', 'panchkula'],
  'Hyderabad area': ['hyderabad', 'secunderabad'],
  'Kolkata area': ['kolkata', 'howrah'],
  'Pune area': ['pune', 'pimpri chinchwad'],
  'Ahmedabad area': ['ahmedabad', 'gandhinagar'],
};

/** States (as they appear in listings), with the cities students pick from. */
const STATE_CITIES: Record<string, string[]> = {
  karnataka: ['bengaluru', 'mysuru', 'mangaluru'],
  kerala: ['kochi', 'thiruvananthapuram', 'kozhikode'],
  maharashtra: ['mumbai', 'pune', 'nagpur', 'thane', 'nashik'],
  'tamil nadu': ['chennai', 'coimbatore', 'madurai'],
  telangana: ['hyderabad', 'secunderabad'],
  gujarat: ['ahmedabad', 'surat', 'vadodara', 'rajkot', 'gandhinagar'],
  'west bengal': ['kolkata', 'howrah'],
  'uttar pradesh': ['noida', 'ghaziabad', 'lucknow', 'kanpur', 'agra', 'meerut', 'allahabad'],
  haryana: ['gurugram', 'faridabad', 'panchkula'],
  rajasthan: ['jaipur', 'udaipur', 'jodhpur'],
  punjab: ['mohali', 'ludhiana', 'amritsar'],
  'madhya pradesh': ['indore', 'bhopal', 'jabalpur'],
  'andhra pradesh': ['visakhapatnam', 'vijayawada'],
  jharkhand: ['ranchi', 'jamshedpur'],
  bihar: ['patna'],
  odisha: ['bhubaneswar'],
  goa: ['panaji'],
};

const REMOTE_NAMES = new Set(['remote', 'work from home', 'wfh', 'online', 'anywhere']);

/** True when the place a student chose means "I want to work remotely". */
export function isRemotePreference(location: string | null | undefined): boolean {
  return citiesIn(location).some(city => REMOTE_NAMES.has(city));
}

/**
 * If the two locations are not the same city but are close, returns a short
 * description of how ("Delhi NCR", "Kerala"); otherwise null.
 */
export function nearbyArea(a: string | null | undefined, b: string | null | undefined): string | null {
  const citiesA = citiesIn(a);
  const citiesB = citiesIn(b);
  if (citiesA.length === 0 || citiesB.length === 0) return null;
  if (citiesA.some(city => citiesB.includes(city))) return null; // the same city is not "nearby"

  for (const [area, members] of Object.entries(METRO_AREAS)) {
    if (citiesA.some(c => members.includes(c)) && citiesB.some(c => members.includes(c))) return area;
  }
  // One side names a state, the other a city in it.
  for (const [state, members] of Object.entries(STATE_CITIES)) {
    const label = state.replace(/\b\w/g, ch => ch.toUpperCase());
    if (citiesA.includes(state) && citiesB.some(c => members.includes(c))) return label;
    if (citiesB.includes(state) && citiesA.some(c => members.includes(c))) return label;
  }
  return null;
}
