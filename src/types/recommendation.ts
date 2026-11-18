// ============================================================
// INTERNOVA RECOMMENDATION TYPES
// ============================================================
// Type definitions for the multi-factor recommendation engine
// ============================================================

export type WorkMode = 'Remote' | 'On-site' | 'Hybrid';
export type InternshipStatus = 'Active' | 'Closed';

export type SkillCategory =
  | 'programming-language'
  | 'framework'
  | 'database'
  | 'cloud-platform'
  | 'tool'
  | 'methodology'
  | 'soft-skill'
  | 'design'
  | 'data-science'
  | 'mobile'
  | 'other';

export interface Internship {
  id: string;
  title: string;
  company: string;
  location: string;
  stipend: string;
  duration: string;
  description: string;
  skills: string[];
  /**
   * Likely skills derived from the title, used only when the listing states
   * none (`skills` is empty). See utils/listingSkills.
   */
  inferredSkills?: { explicit: string[]; typical: string[]; domain?: string };
  type: WorkMode;
  status: InternshipStatus;
  companyId: string;
  source: string;
  requirements?: {
    minExperience?: number;
    maxExperience?: number;
  };
  cgpaRequirement?: number;
  experienceLevel?: string;
  applicants?: number;
  posted?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  skills: string[];
  location?: string;
  preferredLocation?: string;
  expectedStipend?: string;
  preferredWorkMode?: WorkMode[];
  experience?: number; // Years of experience
  cgpa?: number;
  profileCompletion?: number; // 0-100
  university?: string;
  course?: string;
  year?: string;
}

export interface ScoringFactor {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  contribution: number; // this factor's share of the total score (applied factors add up to the total)
  details: string;
  /**
   * False when there is nothing to compare for this factor (the student has
   * not stated a preference, or the listing states no requirement). Such a
   * factor is left out of the total instead of adding the same fixed number
   * to every listing. Absent means true.
   */
  applies?: boolean;
}

export interface RecommendationWeights {
  skillMatch: number;
  locationMatch: number;
  stipendMatch: number;
  workModeMatch: number;
  experienceMatch: number;
  cgpaMatch: number;
  profileCompletionBonus: number;
}

export interface StipendRange {
  min: number;
  max: number;
  currency: 'INR' | 'USD';
  period: 'hour' | 'week' | 'month';
}

export interface LocationMatch {
  isMatch: boolean;
  isPreferred: boolean;
  type: 'exact' | 'city' | 'nearby' | 'state' | 'country' | 'none';
  /** For 'nearby': what the two places share, e.g. "Delhi NCR" or "Kerala". */
  area?: string;
}

export interface RecommendationScore {
  totalScore: number; // 0-100
  factors: ScoringFactor[];
  internshipId: string;
  matchedSkills: string[];
  missingSkills: string[];
  explanation: string;
}

export interface RecommendationResult {
  internship: Internship;
  score: RecommendationScore;
  rank: number;
}

export interface RecommendationRequest {
  userProfile: UserProfile;
  internships: Internship[];
  minScore?: number;
  weights?: Partial<RecommendationWeights>;
}

// ============================================================
// DEFAULT WEIGHTS
// ============================================================
// Weights sum to 1.0 — every contribution = factorScore * weight.
// Skill Match carries the most weight (35%), profile completion
// the least (10%) per the agreed scoring model.
// ============================================================

export const DEFAULT_WEIGHTS: RecommendationWeights = {
  skillMatch: 0.35,
  locationMatch: 0.15,
  stipendMatch: 0.10,
  workModeMatch: 0.15,
  experienceMatch: 0.10,
  cgpaMatch: 0.05,
  profileCompletionBonus: 0.10
};