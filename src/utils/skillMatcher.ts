// ============================================================
// INTERNOVA SKILL MATCHER - NORMALIZATION & FUZZY MATCHING
// ============================================================
// Provides skill normalization, alias resolution, and fuzzy
// matching to prevent false positives (e.g., Java vs JavaScript)
// ============================================================

import type { SkillCategory } from '../types/recommendation';

// ============================================================
// CANONICAL SKILLS DATABASE
// ============================================================

export const CANONICAL_SKILLS: Record<string, {
  aliases: string[];
  category: SkillCategory;
  related: string[];
}> = {
  'javascript': {
    aliases: ['js', 'ecmascript', 'es6', 'vanilla js'],
    category: 'programming-language',
    related: ['typescript', 'node.js', 'react']
  },
  'typescript': {
    aliases: ['ts', 'ts.js'],
    category: 'programming-language',
    related: ['javascript', 'angular', 'react']
  },
  'python': {
    aliases: ['py', 'python3'],
    category: 'programming-language',
    related: ['django', 'flask', 'pandas']
  },
  'java': {
    aliases: ['java se', 'java 8', 'java 11', 'java 17'],
    category: 'programming-language',
    related: ['spring boot', 'kotlin']
  },
  'c++': {
    aliases: ['cpp', 'c plus plus'],
    category: 'programming-language',
    related: ['c', 'stl']
  },
  'c#': {
    aliases: ['csharp', 'c sharp'],
    category: 'programming-language',
    related: ['.net', 'asp.net']
  },
  'go': {
    aliases: ['golang'],
    category: 'programming-language',
    related: ['docker', 'kubernetes']
  },
  'ruby': {
    aliases: ['rb'],
    category: 'programming-language',
    related: ['rails']
  },
  'php': {
    aliases: ['php7', 'php8'],
    category: 'programming-language',
    related: ['laravel', 'wordpress']
  },
  'swift': {
    aliases: ['swift 5', 'swiftui'],
    category: 'programming-language',
    related: ['ios', 'xcode']
  },
  'kotlin': {
    aliases: ['kt'],
    category: 'programming-language',
    related: ['android', 'java']
  },
  'r': {
    aliases: ['r language', 'rstats'],
    category: 'programming-language',
    related: ['python', 'statistics']
  },
  'react': {
    aliases: ['reactjs', 'react.js', 'react native'],
    category: 'framework',
    related: ['javascript', 'redux', 'next.js']
  },
  'angular': {
    aliases: ['angularjs', 'angular 2+'],
    category: 'framework',
    related: ['typescript', 'rxjs']
  },
  'vue.js': {
    aliases: ['vue', 'vuejs', 'vue.js'],
    category: 'framework',
    related: ['javascript', 'vuex']
  },
  'next.js': {
    aliases: ['nextjs', 'next js'],
    category: 'framework',
    related: ['react', 'javascript']
  },
  'node.js': {
    aliases: ['node', 'nodejs', 'node js'],
    category: 'framework',
    related: ['javascript', 'express.js']
  },
  'express.js': {
    aliases: ['express', 'expressjs'],
    category: 'framework',
    related: ['node.js', 'javascript']
  },
  'django': {
    aliases: ['django framework', 'drf'],
    category: 'framework',
    related: ['python', 'rest api']
  },
  'flask': {
    aliases: ['flask python'],
    category: 'framework',
    related: ['python']
  },
  'spring boot': {
    aliases: ['spring', 'springboot'],
    category: 'framework',
    related: ['java', 'hibernate']
  },
  'laravel': {
    aliases: ['laravel php'],
    category: 'framework',
    related: ['php', 'composer']
  },
  'rails': {
    aliases: ['ruby on rails', 'ror'],
    category: 'framework',
    related: ['ruby', 'postgresql']
  },
  'sql': {
    aliases: ['structured query language'],
    category: 'database',
    related: ['mysql', 'postgresql']
  },
  'mysql': {
    aliases: ['mysql database'],
    category: 'database',
    related: ['sql', 'php']
  },
  'postgresql': {
    aliases: ['postgres', 'psql'],
    category: 'database',
    related: ['sql', 'python']
  },
  'mongodb': {
    aliases: ['mongo'],
    category: 'database',
    related: ['node.js', 'nosql']
  },
  'redis': {
    aliases: ['redis database'],
    category: 'database',
    related: ['node.js', 'caching']
  },
  'aws': {
    aliases: ['amazon web services', 'ec2', 's3', 'lambda'],
    category: 'cloud-platform',
    related: ['docker', 'kubernetes']
  },
  'azure': {
    aliases: ['microsoft azure'],
    category: 'cloud-platform',
    related: ['c#', '.net']
  },
  'gcp': {
    aliases: ['google cloud', 'google cloud platform'],
    category: 'cloud-platform',
    related: ['kubernetes', 'docker']
  },
  'docker': {
    aliases: ['docker container', 'docker compose'],
    category: 'tool',
    related: ['kubernetes', 'aws']
  },
  'kubernetes': {
    aliases: ['k8s'],
    category: 'tool',
    related: ['docker', 'aws']
  },
  'git': {
    aliases: ['github', 'gitlab', 'version control'],
    category: 'tool',
    related: ['ci/cd']
  },
  'linux': {
    aliases: ['ubuntu', 'centos', 'bash'],
    category: 'tool',
    related: ['docker', 'devops']
  },
  'machine learning': {
    aliases: ['ml', 'ml engineering'],
    category: 'data-science',
    related: ['python', 'tensorflow']
  },
  'deep learning': {
    aliases: ['dl', 'neural networks'],
    category: 'data-science',
    related: ['tensorflow', 'pytorch']
  },
  'tensorflow': {
    aliases: ['tf', 'tf.js'],
    category: 'data-science',
    related: ['python', 'machine learning']
  },
  'pytorch': {
    aliases: ['torch'],
    category: 'data-science',
    related: ['python', 'machine learning']
  },
  'pandas': {
    aliases: ['pandas python', 'dataframe'],
    category: 'data-science',
    related: ['python', 'numpy']
  },
  'numpy': {
    aliases: ['numpy array'],
    category: 'data-science',
    related: ['python', 'pandas']
  },
  'scikit-learn': {
    aliases: ['sklearn'],
    category: 'data-science',
    related: ['python', 'machine learning']
  },
  'data science': {
    aliases: ['datascience', 'data analysis'],
    category: 'data-science',
    related: ['python', 'machine learning']
  },
  'rest api': {
    aliases: ['restful api', 'restful'],
    category: 'methodology',
    related: ['node.js', 'json']
  },
  'graphql': {
    aliases: ['graphql api', 'apollo graphql'],
    category: 'methodology',
    related: ['node.js', 'react']
  },
  'agile': {
    aliases: ['agile methodology'],
    category: 'methodology',
    related: ['scrum', 'kanban']
  },
  'scrum': {
    aliases: ['scrum framework'],
    category: 'methodology',
    related: ['agile', 'sprint']
  },
  'communication': {
    aliases: ['communication skills'],
    category: 'soft-skill',
    related: ['teamwork', 'leadership']
  },
  'teamwork': {
    aliases: ['team work', 'collaboration'],
    category: 'soft-skill',
    related: ['communication', 'leadership']
  },
  'problem solving': {
    aliases: ['problem-solving', 'critical thinking'],
    category: 'soft-skill',
    related: ['analytical']
  },
  'leadership': {
    aliases: ['leadership skills'],
    category: 'soft-skill',
    related: ['communication', 'teamwork']
  },
  'time management': {
    aliases: ['time-management', 'prioritization'],
    category: 'soft-skill',
    related: ['organization']
  },
  'adaptability': {
    aliases: ['flexibility', 'quick learner'],
    category: 'soft-skill',
    related: ['learning']
  },
  'ui/ux design': {
    aliases: ['ui ux', 'ux design', 'ui design'],
    category: 'design',
    related: ['figma', 'sketch']
  },
  'figma': {
    aliases: ['figma design'],
    category: 'design',
    related: ['ui/ux design']
  },
  'photoshop': {
    aliases: ['adobe photoshop'],
    category: 'design',
    related: ['graphic design']
  },
  'html': {
    aliases: ['html5', 'hypertext markup language'],
    category: 'programming-language',
    related: ['css', 'javascript']
  },
  'css': {
    aliases: ['css3', 'cascading style sheets'],
    category: 'programming-language',
    related: ['html', 'tailwind']
  },
  'tailwind': {
    aliases: ['tailwind css', 'tailwindcss'],
    category: 'framework',
    related: ['css', 'react']
  },
  'bootstrap': {
    aliases: ['bootstrap css'],
    category: 'framework',
    related: ['css', 'html']
  },
  'power bi': {
    aliases: ['powerbi'],
    category: 'tool',
    related: ['data visualization']
  },
  'tableau': {
    aliases: ['tableau desktop'],
    category: 'tool',
    related: ['data visualization']
  },
  'excel': {
    aliases: ['microsoft excel', 'ms excel'],
    category: 'tool',
    related: ['data analysis']
  },
  'testing': {
    aliases: ['software testing', 'qa', 'quality assurance'],
    category: 'methodology',
    related: ['jest', 'cypress']
  }
};

// ============================================================
// LEVENSHTEIN DISTANCE
// ============================================================

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

// ============================================================
// NORMALIZATION
// ============================================================

const MIN_FUZZY_LENGTH = 6;
const MAX_FUZZY_DISTANCE = 1;

// Real technologies that are a single edit away from a dictionary entry but are
// NOT the same skill. They are kept as their own (unknown) skill instead.
const DISTINCT_SKILL_NAMES = new Set([
  'nuxt.js', 'nuxtjs', 'nestjs', 'nest.js', 'preact', 'mssql', 'flash', 'mango', 'panda',
  'jscript', 'c-sharp', 'golang'
]);

export interface NormalizedSkill {
  original: string;
  normalized: string;
  category: SkillCategory;
  aliases: string[];
  confidence: number;
}

// Normalising a skill scans the whole dictionary (including an edit-distance
// pass), and the feed asks for the same few skills thousands of times, so
// results are remembered.
const normalizeCache = new Map<string, NormalizedSkill>();
const NORMALIZE_CACHE_LIMIT = 5000;

export function normalizeSkill(rawSkill: string): NormalizedSkill {
  const cached = normalizeCache.get(rawSkill);
  if (cached) return cached;
  const result = normalizeSkillUncached(rawSkill);
  if (normalizeCache.size >= NORMALIZE_CACHE_LIMIT) normalizeCache.clear();
  normalizeCache.set(rawSkill, result);
  return result;
}

function normalizeSkillUncached(rawSkill: string): NormalizedSkill {
  const cleaned = rawSkill.toLowerCase().trim();

  // Direct match. hasOwnProperty, not a plain lookup: "constructor" or
  // "toString" would otherwise hit Object.prototype and count as known skills.
  if (Object.prototype.hasOwnProperty.call(CANONICAL_SKILLS, cleaned)) {
    return {
      original: rawSkill,
      normalized: cleaned,
      category: CANONICAL_SKILLS[cleaned].category,
      aliases: CANONICAL_SKILLS[cleaned].aliases,
      confidence: 1.0
    };
  }

  // Alias match
  for (const [canonical, data] of Object.entries(CANONICAL_SKILLS)) {
    for (const alias of data.aliases) {
      if (alias.toLowerCase() === cleaned) {
        return {
          original: rawSkill,
          normalized: canonical,
          category: data.category,
          aliases: data.aliases,
          confidence: 1.0
        };
      }
    }
  }

  // Fuzzy match (typo tolerance). A ratio threshold alone is not enough: real,
  // different technologies sit one edit away from each other ("Nuxt.js" vs
  // "Next.js", "Preact" vs "React", "MSSQL" vs "MySQL"). So a fuzzy match also
  // needs a reasonably long word, at most one edit, and must not be a name that
  // is known to be a different skill.
  let bestMatch: { skill: string; score: number; distance: number; data: typeof CANONICAL_SKILLS[string] } | null = null;

  const fuzzyEligible = cleaned.length >= MIN_FUZZY_LENGTH && !DISTINCT_SKILL_NAMES.has(cleaned);
  if (fuzzyEligible) {
    for (const [canonical, data] of Object.entries(CANONICAL_SKILLS)) {
      for (const candidate of [canonical, ...data.aliases.map(a => a.toLowerCase())]) {
        // Short dictionary entries ("java", "go", "git") are never fuzzy targets.
        if (candidate.length < MIN_FUZZY_LENGTH) continue;
        const distance = levenshteinDistance(cleaned, candidate);
        const score = 1 - distance / Math.max(cleaned.length, candidate.length);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { skill: canonical, score, distance, data };
        }
      }
    }
  }

  if (bestMatch && bestMatch.score >= 0.8 && bestMatch.distance <= MAX_FUZZY_DISTANCE) {
    return {
      original: rawSkill,
      normalized: bestMatch.skill,
      category: bestMatch.data.category,
      aliases: bestMatch.data.aliases,
      confidence: bestMatch.score
    };
  }

  return {
    original: rawSkill,
    normalized: cleaned,
    category: 'other',
    aliases: [],
    confidence: 0.5
  };
}

export function normalizeSkills(skills: string[]): NormalizedSkill[] {
  return skills.map(normalizeSkill);
}

export function getCanonicalSkills(skills: string[]): string[] {
  // Skills that are not in the dictionary are kept as their lower-cased literal
  // rather than dropped. Dropping them made a requirement list such as
  // ["Marketing", "SEO"] look empty, which then scored as a 100% match.
  const canonicalSet = new Set<string>();
  for (const raw of skills) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    canonicalSet.add(normalizeSkill(raw).normalized);
  }
  return Array.from(canonicalSet);
}

// ============================================================
// MATCHING
// ============================================================

/** Skill score used when a listing does not state any skills. */
export const NO_REQUIREMENTS_SCORE = 50;

export function skillsMatch(skill1: string, skill2: string): boolean {
  const norm1 = normalizeSkill(skill1);
  const norm2 = normalizeSkill(skill2);
  return norm1.normalized === norm2.normalized;
}

export function calculateSkillMatchScore(
  userSkills: string[],
  requiredSkills: string[]
): { score: number; matched: string[]; missing: string[]; details: string } {
  const normalizedReqSkills = getCanonicalSkills(requiredSkills || []);

  // A listing without skills says nothing about fit, so it gets a neutral
  // score. Scoring it 100 ranked every skill-less listing above real matches.
  if (normalizedReqSkills.length === 0) {
    return { score: NO_REQUIREMENTS_SCORE, matched: [], missing: [], details: 'No specific skills listed' };
  }

  const normalizedUserSkills = getCanonicalSkills(userSkills || []);
  if (normalizedUserSkills.length === 0) {
    return { score: 0, matched: [], missing: normalizedReqSkills, details: 'No skills provided by user' };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const reqSkill of normalizedReqSkills) {
    if (normalizedUserSkills.includes(reqSkill)) {
      matched.push(reqSkill);
    } else {
      missing.push(reqSkill);
    }
  }

  const matchRatio = matched.length / normalizedReqSkills.length;
  const score = Math.round(matchRatio * 100);

  let details = `Matched ${matched.length}/${normalizedReqSkills.length} required skills`;
  if (matched.length > 0) details += ` (${matched.join(', ')})`;
  if (missing.length > 0) details += `. Missing: ${missing.join(', ')}`;

  return { score, matched, missing, details };
}

export function isKnownSkill(skill: string): boolean {
  const normalized = normalizeSkill(skill);
  return normalized.confidence >= 0.8;
}
