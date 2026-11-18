// Skill inference for listings that do not state their skills.
//
// The imported catalogue has no skills on any listing, so comparing a student's
// skills with `internship.skills` matched nothing and every listing scored the
// same. The titles, however, are descriptive ("ReactJS Development", "Full
// Stack Development", "Digital Marketing"), so the likely skills are derived
// from the title:
//
//   explicit: named in the title itself        ("ReactJS Development" -> React)
//   typical : commonly needed for that role    ("Full Stack Development" -> JavaScript, React, Node.js, ...)
//   domain  : the broad field                  (software, marketing, design, ...)
//
// These are indications, not stated requirements, and are scored and labelled
// as such (see scoreInferredSkills).

import { normalizeSkill } from './skillMatcher';

export type SkillDomain =
  | 'software' | 'data' | 'design' | 'marketing' | 'content' | 'sales' | 'hr'
  | 'finance' | 'operations' | 'product' | 'support' | 'legal' | 'engineering'
  | 'education' | 'research' | 'health' | 'other';

export interface InferredSkills {
  explicit: string[];
  typical: string[];
  domain?: SkillDomain;
}

interface Rule {
  pattern: RegExp;
  skill: string;
  domain: SkillDomain;
  /** Skills usually needed for this role, in addition to the one named. */
  typical?: string[];
  /** A broad word: read from the title only (never a long description), and
   *  only when nothing more specific was recognised, so it cannot water down
   *  a specific match ("Social Media Marketing" stays just that). */
  titleOnly?: boolean;
}

// Word boundaries that also work around symbols such as "+", "#" and ".".
const w = (source: string) => new RegExp(`(?:^|[^a-z0-9+#])(?:${source})(?![a-z0-9+#])`, 'i');

const RULES: Rule[] = [
  // --- specific technologies (always explicit) ---
  { pattern: w('react\\s*native'), skill: 'React Native', domain: 'software', typical: ['JavaScript', 'React'] },
  { pattern: w('react(?:\\.?js)?'), skill: 'React', domain: 'software', typical: ['JavaScript'] },
  { pattern: w('node(?:\\.?js)?'), skill: 'Node.js', domain: 'software', typical: ['JavaScript'] },
  { pattern: w('next(?:\\.?js)'), skill: 'Next.js', domain: 'software', typical: ['React', 'JavaScript'] },
  { pattern: w('angular(?:\\.?js)?'), skill: 'Angular', domain: 'software', typical: ['TypeScript', 'JavaScript'] },
  { pattern: w('vue(?:\\.?js)?'), skill: 'Vue.js', domain: 'software', typical: ['JavaScript'] },
  // A bare "JS" counts, but not the ".js" ending of Node.js / Vue.js / Next.js.
  { pattern: /(?:^|[^a-z0-9+#])javascript(?![a-z0-9+#])|(?:^|[^a-z0-9+#.])js(?![a-z0-9+#])/i, skill: 'JavaScript', domain: 'software' },
  { pattern: w('typescript'), skill: 'TypeScript', domain: 'software' },
  { pattern: w('python'), skill: 'Python', domain: 'software' },
  { pattern: w('django'), skill: 'Django', domain: 'software', typical: ['Python'] },
  { pattern: w('flask'), skill: 'Flask', domain: 'software', typical: ['Python'] },
  { pattern: w('java'), skill: 'Java', domain: 'software' },
  { pattern: w('spring\\s*boot'), skill: 'Spring Boot', domain: 'software', typical: ['Java'] },
  { pattern: w('kotlin'), skill: 'Kotlin', domain: 'software' },
  { pattern: w('swift|ios'), skill: 'iOS Development', domain: 'software', typical: ['Swift'] },
  { pattern: w('android'), skill: 'Android Development', domain: 'software', typical: ['Kotlin', 'Java'] },
  { pattern: w('flutter'), skill: 'Flutter', domain: 'software', typical: ['Dart'] },
  { pattern: w('php'), skill: 'PHP', domain: 'software' },
  { pattern: w('laravel'), skill: 'Laravel', domain: 'software', typical: ['PHP'] },
  { pattern: w('wordpress'), skill: 'WordPress', domain: 'software', typical: ['PHP', 'HTML', 'CSS'] },
  { pattern: w('c\\+\\+'), skill: 'C++', domain: 'software' },
  { pattern: w('c#|\\.net|dot\\s*net'), skill: 'C#', domain: 'software' },
  { pattern: w('golang'), skill: 'Go', domain: 'software' },
  { pattern: w('ruby(?:\\s*on\\s*rails)?'), skill: 'Ruby', domain: 'software' },
  { pattern: w('pl/sql|sql|mysql|postgres(?:ql)?'), skill: 'SQL', domain: 'data' },
  { pattern: w('mongo\\s*db'), skill: 'MongoDB', domain: 'software' },
  { pattern: w('aws|cloud'), skill: 'AWS', domain: 'software' },
  { pattern: w('devops'), skill: 'DevOps', domain: 'software', typical: ['Docker', 'AWS', 'Linux'] },
  { pattern: w('salesforce'), skill: 'Salesforce', domain: 'software' },
  { pattern: w('power\\s*bi'), skill: 'Power BI', domain: 'data' },
  { pattern: w('tableau'), skill: 'Tableau', domain: 'data' },
  { pattern: w('excel'), skill: 'Excel', domain: 'data' },
  { pattern: w('figma'), skill: 'Figma', domain: 'design' },
  { pattern: w('photoshop'), skill: 'Photoshop', domain: 'design' },

  // --- software roles ---
  { pattern: w('full\\s*-?\\s*stack|mern|mean'), skill: 'Full Stack Development', domain: 'software', typical: ['JavaScript', 'React', 'Node.js', 'HTML', 'CSS', 'SQL'] },
  { pattern: w('front\\s*-?\\s*end'), skill: 'Frontend Development', domain: 'software', typical: ['JavaScript', 'React', 'HTML', 'CSS'] },
  { pattern: w('back\\s*-?\\s*end'), skill: 'Backend Development', domain: 'software', typical: ['Node.js', 'Python', 'Java', 'SQL'] },
  { pattern: w('web\\s*(?:development|developer|design(?:er)?)|website'), skill: 'Web Development', domain: 'software', typical: ['JavaScript', 'HTML', 'CSS', 'React', 'Node.js'] },
  { pattern: w('mobile\\s*app|app\\s*develop(?:ment|er)'), skill: 'Mobile App Development', domain: 'software', typical: ['Flutter', 'React Native', 'Kotlin', 'Swift'] },
  { pattern: w('software\\s*(?:development|developer|engineer(?:ing)?)|sde|programmer|coding'), skill: 'Software Development', domain: 'software', typical: ['JavaScript', 'Python', 'Java', 'Git'] },
  { pattern: w('(?:software\\s*)?testing|qa|quality\\s*assurance|test\\s*engineer'), skill: 'Software Testing', domain: 'software' },
  { pattern: w('cyber\\s*security|information\\s*security|ethical\\s*hacking'), skill: 'Cyber Security', domain: 'software' },
  { pattern: w('game\\s*develop(?:ment|er)'), skill: 'Game Development', domain: 'software', typical: ['C#', 'C++'] },
  { pattern: w('blockchain|web3'), skill: 'Blockchain', domain: 'software' },

  // --- data / AI ---
  { pattern: w('data\\s*scien(?:ce|tist)'), skill: 'Data Science', domain: 'data', typical: ['Python', 'Machine Learning', 'SQL'] },
  { pattern: w('machine\\s*learning|ml|deep\\s*learning'), skill: 'Machine Learning', domain: 'data', typical: ['Python'] },
  { pattern: w('artificial\\s*intelligence|ai|generative\\s*ai|llm|nlp'), skill: 'Artificial Intelligence', domain: 'data', typical: ['Python', 'Machine Learning'] },
  { pattern: w('data\\s*analy(?:tics|sis|st)'), skill: 'Data Analysis', domain: 'data', typical: ['SQL', 'Excel', 'Python'] },
  { pattern: w('business\\s*analy(?:st|sis|tics)'), skill: 'Business Analysis', domain: 'data', typical: ['Excel', 'SQL'] },
  { pattern: w('data\\s*entry'), skill: 'Data Entry', domain: 'operations', typical: ['Excel'] },
  { pattern: w('data\\s*engineer(?:ing)?'), skill: 'Data Engineering', domain: 'data', typical: ['SQL', 'Python'] },

  // --- design ---
  { pattern: w('ui\\s*/?\\s*ux|ux|ui\\s*design(?:er)?|product\\s*design(?:er)?'), skill: 'UI/UX Design', domain: 'design', typical: ['Figma'] },
  { pattern: w('graphic\\s*design(?:er|ing)?|creative\\s*design'), skill: 'Graphic Design', domain: 'design', typical: ['Photoshop', 'Canva'] },
  { pattern: w('video\\s*edit(?:ing|or)(?:/making)?|video\\s*making'), skill: 'Video Editing', domain: 'design' },
  { pattern: w('motion\\s*graphics?|animation'), skill: 'Motion Graphics', domain: 'design' },
  { pattern: w('photography'), skill: 'Photography', domain: 'design' },
  { pattern: w('interior\\s*design'), skill: 'Interior Design', domain: 'design' },
  { pattern: w('fashion\\s*design'), skill: 'Fashion Design', domain: 'design' },

  // --- marketing / content ---
  { pattern: w('digital\\s*marketing'), skill: 'Digital Marketing', domain: 'marketing', typical: ['SEO', 'Social Media Marketing'] },
  { pattern: w('social\\s*media'), skill: 'Social Media Marketing', domain: 'marketing' },
  { pattern: w('seo|search\\s*engine\\s*optimi[sz]ation'), skill: 'SEO', domain: 'marketing' },
  { pattern: w('influencer\\s*marketing'), skill: 'Influencer Marketing', domain: 'marketing' },
  { pattern: w('market\\s*research'), skill: 'Market Research', domain: 'marketing' },
  { pattern: w('brand(?:ing)?'), skill: 'Branding', domain: 'marketing' },
  { pattern: w('marketing'), skill: 'Marketing', domain: 'marketing' },
  { pattern: w('content\\s*writ(?:ing|er)|copywrit(?:ing|er)|blog(?:ging)?|technical\\s*writ(?:ing|er)'), skill: 'Content Writing', domain: 'content' },
  { pattern: w('content\\s*creat(?:ion|or)|content'), skill: 'Content Creation', domain: 'content' },

  // --- business ---
  { pattern: w('business\\s*develop(?:ment|er)|bde|lead\\s*generation'), skill: 'Business Development', domain: 'sales', typical: ['Sales'] },
  { pattern: w('(?:inside|field)?\\s*sales|telecalling|tele\\s*sales'), skill: 'Sales', domain: 'sales' },
  { pattern: w('human\\s*resources?|hr'), skill: 'Human Resources', domain: 'hr', typical: ['Recruitment'] },
  { pattern: w('talent\\s*acquisition|recruit(?:ment|er|ing)'), skill: 'Recruitment', domain: 'hr' },
  { pattern: w('financ(?:e|ial)|investment|equity'), skill: 'Finance', domain: 'finance' },
  { pattern: w('account(?:s|ing|ant)|bookkeeping|taxation'), skill: 'Accounting', domain: 'finance' },
  { pattern: w('operations?|supply\\s*chain|logistics'), skill: 'Operations', domain: 'operations' },
  { pattern: w('product\\s*manage(?:ment|r)'), skill: 'Product Management', domain: 'product' },
  { pattern: w('project\\s*manage(?:ment|r)|program\\s*manage(?:ment|r)'), skill: 'Project Management', domain: 'product' },
  { pattern: w('customer\\s*(?:service|support|success|care)|client\\s*servic'), skill: 'Customer Support', domain: 'support' },
  { pattern: w('event\\s*manage(?:ment|r)'), skill: 'Event Management', domain: 'operations' },
  { pattern: w('legal|law|lawyer|advocate|litigation|patent|paralegal'), skill: 'Legal', domain: 'legal' },

  // --- more technologies ---
  { pattern: w('rust'), skill: 'Rust', domain: 'software' },
  { pattern: w('c\\s*(?:programming|language)|embedded\\s*c'), skill: 'C', domain: 'software' },
  { pattern: w('sap'), skill: 'SAP', domain: 'software' },
  { pattern: w('big\\s*data|hadoop|spark'), skill: 'Big Data', domain: 'data', typical: ['SQL', 'Python'] },
  { pattern: w('computer\\s*vision'), skill: 'Computer Vision', domain: 'data', typical: ['Python', 'Machine Learning'] },
  { pattern: w('tally'), skill: 'Tally', domain: 'finance' },
  { pattern: w('canva'), skill: 'Canva', domain: 'design' },
  { pattern: w('auto\\s*cad|cad|solidworks|revit'), skill: 'AutoCAD', domain: 'engineering' },
  { pattern: w('it\\s*support|technical\\s*support|support\\s*engineer|help\\s*desk|information\\s*technology|networking|system\\s*admin(?:istrator)?'), skill: 'IT Support', domain: 'software' },
  { pattern: w('web\\s*dev|developer|programming'), skill: 'Software Development', domain: 'software', typical: ['JavaScript', 'Python', 'Java', 'Git'], titleOnly: true },

  // --- core engineering ---
  { pattern: w('mechanical'), skill: 'Mechanical Engineering', domain: 'engineering', typical: ['AutoCAD'] },
  { pattern: w('electrical'), skill: 'Electrical Engineering', domain: 'engineering' },
  { pattern: w('electronics|vlsi|pcb|physical\\s*design|hardware'), skill: 'Electronics', domain: 'engineering' },
  { pattern: w('embedded|iot|firmware'), skill: 'Embedded Systems', domain: 'engineering', typical: ['C', 'C++'] },
  { pattern: w('robotics'), skill: 'Robotics', domain: 'engineering', typical: ['Python', 'C++'] },
  { pattern: w('civil|site\\s*engineer(?:ing)?|structural'), skill: 'Civil Engineering', domain: 'engineering', typical: ['AutoCAD'] },
  { pattern: w('architect(?:ure|ural)?'), skill: 'Architecture', domain: 'engineering', typical: ['AutoCAD'], titleOnly: true },
  { pattern: w('industrial|manufacturing|production\\s*engineer(?:ing)?'), skill: 'Industrial Engineering', domain: 'engineering', titleOnly: true },

  // --- more design ---
  { pattern: w('videograph(?:y|er)|cinematograph(?:y|er)|video\\s*production'), skill: 'Videography', domain: 'design', typical: ['Video Editing'] },
  { pattern: w('3d|animator|vfx'), skill: '3D Modeling', domain: 'design', titleOnly: true },
  { pattern: w('design(?:er|ing)?|visual|artist|illustrat(?:or|ion)'), skill: 'Design', domain: 'design', titleOnly: true },

  // --- more marketing / content ---
  { pattern: w('public\\s*relations|pr|communications?|media'), skill: 'Public Relations', domain: 'marketing', titleOnly: true },
  { pattern: w('e\\s*-?\\s*commerce|merchandising|catalog(?:ue|ing)?'), skill: 'E-commerce', domain: 'marketing' },
  { pattern: w('google\\s*ads|ppc|performance\\s*market(?:ing|er)|paid\\s*ads|ads'), skill: 'Performance Marketing', domain: 'marketing', typical: ['Digital Marketing'], titleOnly: true },
  { pattern: w('marketer|growth|campus\\s*ambassador|community|outreach|campaign'), skill: 'Marketing', domain: 'marketing', titleOnly: true },
  { pattern: w('editor(?:ial)?|article|documentation|journalis(?:m|t)|proofread(?:ing|er)'), skill: 'Content Writing', domain: 'content', titleOnly: true },

  // --- more business ---
  { pattern: w('client\\s*acquisition|account\\s*manage(?:ment|r)|relationship\\s*manage(?:ment|r)|client\\s*relation(?:s|ship)?'), skill: 'Sales', domain: 'sales' },
  { pattern: w('ca|chartered\\s*accountant|audit(?:ing|or)?|tax|company\\s*secretary'), skill: 'Accounting', domain: 'finance', titleOnly: true },
  { pattern: w('insurance|wealth|banking|risk|compliance'), skill: 'Finance', domain: 'finance', titleOnly: true },
  { pattern: w('administration|admin|office\\s*assistant|back\\s*office|coordinator'), skill: 'Administration', domain: 'operations', titleOnly: true },
  { pattern: w('founder.?s?\\s*office|strategy|consult(?:ant|ing)|general\\s*management'), skill: 'Business Strategy', domain: 'operations', titleOnly: true },
  { pattern: w('travel|tourism|hospitality|hotel'), skill: 'Travel & Hospitality', domain: 'operations', titleOnly: true },
  { pattern: w('wedding\\s*plann(?:er|ing)|events?'), skill: 'Event Management', domain: 'operations', titleOnly: true },
  { pattern: w('quality\\s*(?:analyst|check|control)'), skill: 'Quality Control', domain: 'operations', titleOnly: true },
  { pattern: w('support|client\\s*services?'), skill: 'Customer Support', domain: 'support', titleOnly: true },

  // --- education, research, health ---
  { pattern: w('teach(?:ing|er)|tutor(?:ing)?|academic|education|trainer|faculty|counsell?(?:or|ing)'), skill: 'Teaching', domain: 'education', titleOnly: true },
  { pattern: w('research|r\\s*&\\s*d'), skill: 'Research', domain: 'research', titleOnly: true },
  { pattern: w('psycholog(?:y|ist)'), skill: 'Psychology', domain: 'research' },
  { pattern: w('health(?:care)?|medical|pharma(?:cy|ceutical)?|clinical|nursing|biotech(?:nology)?'), skill: 'Healthcare', domain: 'health', titleOnly: true },
];

const dedupe = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Derives likely skills and the field of work from a listing's title (and description). */
export function inferListingSkills(title: string | null | undefined, description?: string | null): InferredSkills {
  // A description that only repeats the title, or holds a place name, adds nothing.
  const text = [title, description && description !== title ? description : ''].filter(Boolean).join(' . ');
  const explicit: string[] = [];
  const typical: string[] = [];
  let domain: SkillDomain | undefined;

  for (const rule of RULES) {
    if (rule.titleOnly && explicit.length > 0) continue;
    if (!rule.pattern.test(rule.titleOnly ? title || '' : text)) continue;
    // "Java" must not fire for a title that only says "JavaScript".
    if (rule.skill === 'Java' && /javascript/i.test(text) && !/(?:^|[^a-z])java(?![a-z])/i.test(text.replace(/javascript/gi, ''))) continue;
    // "React Native" is its own skill: plain "React" is only listed as named in
    // the title when it also appears on its own.
    if (rule.skill === 'React' && explicit.includes('React Native') && !/react/i.test(text.replace(/react\s*native/gi, ''))) continue;
    // Generic "Marketing"/"Content Creation" are implied by their more specific forms.
    if (rule.skill === 'Marketing' && explicit.some(s => /marketing|seo/i.test(s))) continue;
    if (rule.skill === 'Content Creation' && explicit.some(s => /content|social media/i.test(s))) continue;
    explicit.push(rule.skill);
    if (rule.typical) typical.push(...rule.typical);
    domain = domain || rule.domain;
  }

  const explicitUnique = dedupe(explicit);
  const explicitKeys = new Set(explicitUnique.map(s => s.toLowerCase()));
  return {
    explicit: explicitUnique,
    typical: dedupe(typical).filter(s => !explicitKeys.has(s.toLowerCase())),
    domain,
  };
}

/** Canonical key for comparing two skill names ("ReactJS" and "React" are the same). */
const skillKey = (skill: string) => normalizeSkill(skill).normalized;

// What a student's own skills amount to (remembered for the last profile):
//   keys    - every way their skills can be named. Each skill is also read
//             through the same rules as a listing title, so "Law" counts as
//             Legal, "HR" as Human Resources and "Teacher" as Teaching.
//   domains - the fields of work those skills belong to.
let lastProfileKey: string | null = null;
let lastProfile = { keys: new Set<string>(), domains: new Set<SkillDomain>() };

function readUserSkills(userSkills: string[]) {
  const key = userSkills.join('\u0001');
  if (key === lastProfileKey) return lastProfile;
  const keys = new Set<string>();
  const domains = new Set<SkillDomain>();
  for (const skill of userSkills) {
    if (typeof skill !== 'string' || !skill.trim()) continue;
    keys.add(skillKey(skill));
    const inferred = inferListingSkills(skill);
    inferred.explicit.forEach(s => keys.add(skillKey(s)));
    if (inferred.domain) domains.add(inferred.domain);
  }
  lastProfileKey = key;
  lastProfile = { keys, domains };
  return lastProfile;
}

export const INFERRED_SCORES = {
  /** Two or more of the role's typical skills. */
  typicalStrong: 90,
  /** One of the role's typical skills. */
  typicalSome: 70,
  /** Same field of work, no specific skill in common. Kept above the neutral
   *  score of a listing whose title says nothing, and below a real skill match. */
  sameField: 55,
};

/**
 * Scores a student's skills against skills inferred from a listing's title.
 *
 *  - every skill named in the title matched            -> 100
 *  - some of the skills named in the title matched     -> share matched (at least 70)
 *  - 2+ / 1 of the role's typical skills               -> 90 / 70
 *  - only the same field of work                       -> 55
 *  - nothing in common                                 -> 0
 *
 * The best of these applies.
 */
export function scoreInferredSkills(userSkills: string[], inferred: InferredSkills): { score: number; matched: string[]; missing: string[]; details: string } {
  const { keys: userKeys, domains } = readUserSkills(userSkills || []);
  const matchedExplicit = inferred.explicit.filter(s => userKeys.has(skillKey(s)));
  const matchedTypical = inferred.typical.filter(s => userKeys.has(skillKey(s)));

  // Matching a skill the title names never scores below matching a typical one.
  const explicitScore = matchedExplicit.length > 0
    ? Math.max(INFERRED_SCORES.typicalSome, Math.round((matchedExplicit.length / inferred.explicit.length) * 100))
    : 0;
  const typicalScore = matchedTypical.length >= 2 ? INFERRED_SCORES.typicalStrong : matchedTypical.length === 1 ? INFERRED_SCORES.typicalSome : 0;
  const fieldScore = inferred.domain && domains.has(inferred.domain) ? INFERRED_SCORES.sameField : 0;
  const score = Math.max(explicitScore, typicalScore, fieldScore);

  const matched = dedupe([...matchedExplicit, ...matchedTypical]);
  const missing = inferred.explicit.filter(s => !userKeys.has(skillKey(s)));

  let details: string;
  if (matched.length > 0) {
    details = `Matches ${matched.join(', ')} (skills inferred from the title)`;
  } else if (fieldScore > 0) {
    details = `Same field as your skills, but none of the likely skills match (${inferred.explicit.join(', ')})`;
  } else {
    details = `None of the likely skills match (${[...inferred.explicit, ...inferred.typical].slice(0, 4).join(', ')})`;
  }
  return { score, matched, missing, details };
}
