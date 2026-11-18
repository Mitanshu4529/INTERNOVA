// ============================================================
// INTERNOVA DATA NORMALIZER
// ============================================================
// Normalizes imported internship data for consistent scoring:
//   - Work mode: "Remote", "Hybrid", "On-site"
//   - Location: standardized city/state/country
//   - Stipend: parsed numeric amounts
//   - Skills: cleaned and deduplicated
// ============================================================

import type { WorkMode } from '../types/recommendation';

// ============================================================
// WORK MODE NORMALIZATION
// ============================================================

const REMOTE_ALIASES = [
  'remote', 'work from home', 'wfh', 'work-from-home',
  'work at home', 'telecommute', 'telework', 'virtual',
  'distributed', 'anywhere', 'fully remote', '100% remote',
  'online'
];

const HYBRID_ALIASES = [
  'hybrid', 'flexible', 'flex', 'part remote', 'part on-site',
  'semi-remote', 'hybrid - remote', 'hybrid - on-site',
  'remote/on-site', 'mixed'
];

const ONSITE_ALIASES = [
  'on-site', 'onsite', 'on site', 'in-office', 'in office',
  'office', 'on-premise', 'at office', 'at the office',
  'on-campus', 'campus'
];

/**
 * Normalizes any work mode string to one of: 'Remote', 'Hybrid', 'On-site'
 * Falls back to 'On-site' when ambiguous.
 */
export function normalizeWorkMode(raw: string | null | undefined): WorkMode {
  if (!raw || typeof raw !== 'string') return 'On-site';

  const cleaned = raw.toLowerCase().trim();

  // Check hybrid FIRST — "Remote/On-site" contains "remote" but is hybrid
  if (HYBRID_ALIASES.some(alias => cleaned.includes(alias))) {
    return 'Hybrid';
  }

  // Check remote aliases
  if (REMOTE_ALIASES.some(alias => cleaned.includes(alias))) {
    return 'Remote';
  }

  // Check on-site aliases
  if (ONSITE_ALIASES.some(alias => cleaned.includes(alias))) {
    return 'On-site';
  }

  // Default to On-site
  return 'On-site';
}

// ============================================================
// LOCATION NORMALIZATION
// ============================================================

// Common Indian state abbreviations and names
const INDIAN_STATES: Record<string, string> = {
  'ap': 'Andhra Pradesh', 'ar': 'Arunachal Pradesh', 'as': 'Assam',
  'br': 'Bihar', 'ch': 'Chhattisgarh', 'ga': 'Goa', 'gj': 'Gujarat',
  'hr': 'Haryana', 'hp': 'Himachal Pradesh', 'jh': 'Jharkhand',
  'ka': 'Karnataka', 'kl': 'Kerala', 'mp': 'Madhya Pradesh',
  'mh': 'Maharashtra', 'mn': 'Manipur', 'ml': 'Meghalaya',
  'mz': 'Mizoram', 'nl': 'Nagaland', 'od': 'Odisha', 'or': 'Odisha',
  'pb': 'Punjab', 'rj': 'Rajasthan', 'sk': 'Sikkim', 'tn': 'Tamil Nadu',
  'tg': 'Telangana', 'tr': 'Tripura', 'up': 'Uttar Pradesh',
  'uk': 'Uttarakhand', 'ut': 'Uttarakhand', 'wb': 'West Bengal',
  'dl': 'Delhi', 'py': 'Puducherry', 'j&k': 'Jammu and Kashmir',
  'jk': 'Jammu and Kashmir'
};

const INDIAN_CITIES: Record<string, string> = {
  'bangalore': 'Bangalore, Karnataka, India',
  'bengaluru': 'Bangalore, Karnataka, India',
  'mumbai': 'Mumbai, Maharashtra, India',
  'bombay': 'Mumbai, Maharashtra, India',
  'delhi': 'Delhi, India',
  'new delhi': 'Delhi, India',
  'noida': 'Noida, Uttar Pradesh, India',
  'gurgaon': 'Gurgaon, Haryana, India',
  'gurugram': 'Gurgaon, Haryana, India',
  'hyderabad': 'Hyderabad, Telangana, India',
  'chennai': 'Chennai, Tamil Nadu, India',
  'kolkata': 'Kolkata, West Bengal, India',
  'calcutta': 'Kolkata, West Bengal, India',
  'pune': 'Pune, Maharashtra, India',
  'ahmedabad': 'Ahmedabad, Gujarat, India',
  'jaipur': 'Jaipur, Rajasthan, India',
  'lucknow': 'Lucknow, Uttar Pradesh, India',
  'chandigarh': 'Chandigarh, India',
  'bhopal': 'Bhopal, Madhya Pradesh, India',
  'indore': 'Indore, Madhya Pradesh, India',
  'coimbatore': 'Coimbatore, Tamil Nadu, India',
  'kochi': 'Kochi, Kerala, India',
  'thiruvananthapuram': 'Thiruvananthapuram, Kerala, India',
  'vishakhapatnam': 'Visakhapatnam, Andhra Pradesh, India',
  'visakhapatnam': 'Visakhapatnam, Andhra Pradesh, India',
  'surat': 'Surat, Gujarat, India',
  'nagpur': 'Nagpur, Maharashtra, India',
  'mysore': 'Mysore, Karnataka, India',
  'mysuru': 'Mysore, Karnataka, India',
  'patna': 'Patna, Bihar, India',
  'raipur': 'Raipur, Chhattisgarh, India'
};

/**
 * Normalizes a raw location string into a standardized format.
 * Recognizes major Indian cities and appends state/country when missing.
 * Returns "Remote" if the location indicates remote work.
 */
export function normalizeLocation(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return 'Remote';

  const cleaned = raw.toLowerCase().trim();

  // Remote indicators
  if (REMOTE_ALIASES.some(alias => cleaned.includes(alias))) {
    return 'Remote';
  }

  // If it has commas, it's already structured (e.g., "Bangalore, India", "Jaipur, Rajasthan")
  // Title-case each part and return as-is — don't look up cities
  if (raw.includes(',')) {
    return raw.trim().split(',').map(p =>
      p.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    ).join(', ');
  }

  // Check if it's a well-known Indian city (bare city name, no commas)
  for (const [cityKey, normalized] of Object.entries(INDIAN_CITIES)) {
    if (cleaned.includes(cityKey)) {
      return normalized;
    }
  }

  // Check for state abbreviations (e.g., "KA", "MH")
  const upper = raw.toUpperCase().trim();
  if (INDIAN_STATES[loweredKey(upper)]) {
    return INDIAN_STATES[loweredKey(upper)];
  }

  // Return as-is with title casing
  return raw.trim().split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function loweredKey(s: string): string {
  return s.toLowerCase();
}

// ============================================================
// STIPEND NORMALIZATION
// ============================================================

export interface NormalizedStipend {
  text: string;        // Clean display text
  amount: number;      // Numeric monthly amount
  currency: string;    // '₹' or '$'
  period: string;      // 'month', 'hour', 'week'
  isUnpaid: boolean;
}

const UNPAID_ALIASES = ['unpaid', 'no stipend', 'nil', 'n/a', 'voluntary'];

/**
 * Parses a raw stipend string into a normalized structure.
 * Handles formats like:
 *   "₹10,000 / month", "$15/hr", "15000-20000", "Unpaid", "₹10K-15K"
 * Always normalizes to monthly equivalent for comparison.
 */
export function normalizeStipend(raw: string | null | undefined): NormalizedStipend {
  // A missing stipend stays missing: no amount is made up for it.
  if (!raw || typeof raw !== 'string') {
    return { text: 'Not specified', amount: 0, currency: '₹', period: 'month', isUnpaid: false };
  }

  const cleaned = raw.toLowerCase().trim();

  // Every amount in the text, with its multiplier suffix:
  //   "15K" -> 15000, "1.5k" -> 1500, "2 lakh" -> 200000, "3 LPA" -> 300000
  // The suffix must directly follow the number, so the "k" in "week" is not a multiplier.
  const withoutSymbols = cleaned.replace(/[\u20B9$\u20AC\u00A3]/g, ' ').replace(/(\d),(?=\d)/g, '$1');
  const amountPattern = /(\d+(?:\.\d+)?)\s*(k|lakhs?|lacs?|lpa)?(?![a-z])/g;
  const amounts: { value: number; start: number; end: number; lpa: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = amountPattern.exec(withoutSymbols)) !== null) {
    let value = parseFloat(m[1]);
    const suffix = m[2] || '';
    if (suffix === 'k') value *= 1000;
    else if (suffix) value *= 100000;
    amounts.push({ value, start: m.index, end: m.index + m[0].length, lpa: suffix === 'lpa' });
  }

  // Unpaid only when every stated amount is zero ("0", "0 / month"), not when a
  // range merely starts at zero ("0-5000").
  const allZero = amounts.length > 0 && amounts.every(x => x.value === 0);
  if (allZero || UNPAID_ALIASES.some(alias => cleaned.includes(alias))) {
    return { text: 'Unpaid', amount: 0, currency: '₹', period: 'month', isUnpaid: true };
  }

  // Detect currency
  const currency = raw.includes('$') ? '$' : '₹';

  // Detect period and normalize to monthly
  const isHourly = /\b(hour|hr|hrs|hourly)\b/.test(cleaned);
  const isWeekly = /\b(week|weekly)\b/.test(cleaned);
  const isYearly = /\b(year|annual|yearly|annum|pa|lpa)\b/.test(cleaned) || amounts.some(x => x.lpa);

  if (amounts.length === 0) {
    return { text: 'Not specified', amount: 0, currency, period: 'month', isUnpaid: false };
  }

  // A second number only forms a range when it is joined to the first by "-" or
  // "to" ("5000-8000", "5k to 8k"). In "5000 + incentives upto 2000" the second
  // number is a bonus and must not be averaged in.
  let amount = amounts[0].value;
  if (amounts.length > 1) {
    const between = withoutSymbols.slice(amounts[0].end, amounts[1].start);
    if (/^\s*(-|\u2013|\u2014|to)\s*$/.test(between)) {
      amount = (amounts[0].value + amounts[1].value) / 2;
    }
  }
  amount = Math.round(amount);

  // Normalize to monthly
  if (isHourly) amount *= 8 * 22;   // 8 hrs × 22 working days
  if (isWeekly) amount *= 4;
  if (isYearly) amount = Math.round(amount / 12);

  // Determine display period
  let period = 'month';
  if (isHourly) period = 'hour';
  if (isWeekly) period = 'week';
  if (isYearly) period = 'month'; // We normalized to monthly

  // Build display text
  const formatted = `${currency}${amount.toLocaleString('en-IN')}`;

  return {
    text: `${formatted} / month`,
    amount,
    currency,
    period: 'month',
    isUnpaid: false
  };
}

// ============================================================
// SKILLS NORMALIZATION
// ============================================================

/**
 * Normalizes a raw skills string into a clean, deduplicated array.
 * Handles various delimiters: commas, semicolons, pipes, newlines, bullets.
 * Removes trailing periods, whitespace, and common prefixes.
 */
export function normalizeSkills(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];

  // Split on multiple delimiters
  // A plain hyphen is NOT a delimiter: it is part of names such as "scikit-learn",
  // "Front-end" or "Problem-solving". Only a spaced " - " separates list items.
  const parts = raw
    .split(/[,;|\n\r•·●–—]+|\s-\s/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 50);  // Filter out empty or absurdly long entries

  // Clean each skill
  const cleaned = parts.map(s => {
    return s
      .replace(/^[•·●\-–—\s]+/, '')   // Leading bullets
      .replace(/[.,;:!?\s]+$/, '')       // Trailing punctuation
      .replace(/\s+/g, ' ')             // Collapse whitespace
      .trim();
  }).filter(s => s.length > 1 || /^[cr]$/i.test(s));   // keep the one-letter languages C and R

  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const skill of cleaned) {
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(skill);
    }
  }

  return unique;
}

// ============================================================
// VALIDATION
// ============================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a raw internship record before import.
 * Returns validation result with errors (blocking) and warnings (non-blocking).
 */
export function validateInternshipRecord(record: Record<string, string>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const title = record.title || record.job_title || record.position || '';
  if (!title.trim()) {
    errors.push('Missing internship title');
  }

  const company = record.company || record.company_name || '';
  if (!company.trim()) {
    warnings.push('Missing company name — will use "Partner Company"');
  }

  const skills = record.skills || record.required_skills || '';
  if (!skills.trim()) {
    warnings.push('No skills specified — matching will be less accurate');
  }

  const stipend = record.stipend || record.salary || '';
  if (!stipend.trim()) {
    warnings.push('No stipend specified — will use default');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================
// FULL RECORD NORMALIZATION
// ============================================================

export interface NormalizedInternship {
  title: string;
  company: string;
  location: string;
  stipend: string;
  stipendAmount: number;
  duration: string;
  description: string;
  skills: string[];
  type: WorkMode;
  status: 'Active' | 'Closed';
  source: string;
  companyId: string;
}

/**
 * Normalizes a raw CSV record into a fully structured internship object
 * ready for database insertion and recommendation scoring.
 */
export function normalizeInternshipRecord(
  record: Record<string, string>,
  defaultSource: string = 'csv-import'
): NormalizedInternship {
  // Work mode: check type/work_mode field first, fall back to location
  const workModeRaw = record.type || record.work_mode || record.mode || record.work_type || '';
  const locationRaw = record.location || record.city || record.area || '';

  let workMode = normalizeWorkMode(workModeRaw);
  // If no explicit work mode field, infer from location
  if (!workModeRaw && locationRaw) {
    workMode = normalizeWorkMode(locationRaw);
  }

  const stipendNorm = normalizeStipend(record.stipend || record.salary || record.stipendamount || '');

  return {
    title: (record.title || record.job_title || record.position || record.role || 'Internship Opportunity').trim(),
    company: (record.company || record.company_name || record.organization || 'Partner Company').trim(),
    location: normalizeLocation(locationRaw),
    stipend: stipendNorm.text,
    stipendAmount: stipendNorm.amount,
    // Missing duration and description stay empty rather than being invented.
    duration: (record.duration || record.length || '').trim(),
    description: (record.description || record.job_description || record.details || '').trim(),
    skills: normalizeSkills(record.skills || record.required_skills || record.key_skills || record.tags || ''),
    type: workMode,
    status: (record.status || 'Active').toLowerCase() === 'closed' ? 'Closed' : 'Active',
    source: record.source || defaultSource,
    companyId: record.company_id || record.companyid || ''
  };
}
