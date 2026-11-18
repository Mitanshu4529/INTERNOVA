// ============================================================
// INTERNOVA RECOMMENDATION SERVICE
// ============================================================
// Multi-factor recommendation engine with explainable scoring
// ============================================================

import { calculateSkillMatchScore } from '../utils/skillMatcher';
import { normalizeStipend } from '../utils/dataNormalizer';
import { inferListingSkills, scoreInferredSkills } from '../utils/listingSkills';
import { sameCity, nearbyArea, isRemotePreference } from '../utils/locations';
import type {
  Internship,
  UserProfile,
  RecommendationResult,
  RecommendationScore,
  ScoringFactor,
  RecommendationWeights,
  RecommendationRequest,
  StipendRange,
  LocationMatch
} from '../types/recommendation';
import { DEFAULT_WEIGHTS } from '../types/recommendation';

export class RecommendationService {
  private weights: RecommendationWeights;

  constructor(customWeights?: Partial<RecommendationWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
  }

  // ============================================================
  // MAIN RECOMMENDATION FUNCTION
  // ============================================================

  async getRecommendations(
    userProfile: UserProfile,
    internships: Internship[],
    minScore: number = 0
  ): Promise<RecommendationResult[]> {
    const results: RecommendationResult[] = [];

    for (const internship of internships) {
      // Skip closed internships
      if (internship.status === 'Closed') continue;

      const score = this.calculateRecommendationScore(userProfile, internship);

      // Only include if meets minimum threshold
      if (score.totalScore >= minScore) {
        results.push({
          internship,
          score,
          rank: 0 // Will be set after sorting
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score.totalScore - a.score.totalScore);

    // Assign ranks
    results.forEach((result, index) => {
      result.rank = index + 1;
    });

    return results;
  }

  // ============================================================
  // SCORING CALCULATION
  // ============================================================

  calculateRecommendationScore(
    userProfile: UserProfile,
    internship: Internship
  ): RecommendationScore {
    const factors: ScoringFactor[] = [];

    // 1. Skill Match Score
    const skillFactor = this.calculateSkillMatchFactor(userProfile, internship);
    factors.push(skillFactor);

    // 2. Location Match Score
    const locationFactor = this.calculateLocationMatchFactor(userProfile, internship);
    factors.push(locationFactor);

    // 3. Stipend Match Score
    const stipendFactor = this.calculateStipendMatchFactor(userProfile, internship);
    factors.push(stipendFactor);

    // 4. Work Mode Match Score
    const workModeFactor = this.calculateWorkModeMatchFactor(userProfile, internship);
    factors.push(workModeFactor);

    // 5. Experience Match Score
    const experienceFactor = this.calculateExperienceMatchFactor(userProfile, internship);
    factors.push(experienceFactor);

    // 6. CGPA Match Score
    const cgpaFactor = this.calculateCgpaMatchFactor(userProfile, internship);
    factors.push(cgpaFactor);

    // 7. Profile completion (shown for reference; it describes the profile,
    //    not the listing, so it is never part of the match)
    const profileBonus = this.calculateProfileCompletionBonus(userProfile);
    factors.push(profileBonus);

    // The total counts only the factors there is something to compare for,
    // and their weights are rescaled to add up to 1. Otherwise factors nobody
    // filled in (no stipend preference, no CGPA requirement, ...) would add
    // the same fixed points to every listing: a perfect match topped out near
    // 85% and a listing with nothing in common still showed 40-66%.
    const applied = factors.filter(factor => factor.applies !== false);
    const weightSum = applied.reduce((sum, factor) => sum + factor.weight, 0);
    for (const factor of factors) {
      factor.contribution = factor.applies !== false && weightSum > 0
        ? (factor.score * factor.weight) / weightSum
        : 0;
    }
    // Nothing to compare at all (an empty profile): a neutral 50.
    const totalScore = weightSum > 0
      ? Math.round(applied.reduce((sum, factor) => sum + factor.contribution, 0))
      : 50;

    // Matched and missing skills (same comparison the skill factor used)
    const skillMatch = this.matchSkills(userProfile, internship);

    // Generate explanation
    const explanation = this.generateExplanation(factors, skillMatch.matched, totalScore, weightSum > 0);

    return {
      totalScore: Math.min(100, Math.max(0, totalScore)),
      factors,
      internshipId: internship.id,
      matchedSkills: skillMatch.matched,
      missingSkills: skillMatch.missing,
      explanation
    };
  }

  // ============================================================
  // INDIVIDUAL FACTOR CALCULATIONS
  // ============================================================

  private calculateSkillMatchFactor(
    userProfile: UserProfile,
    internship: Internship
  ): ScoringFactor {
    const result = this.matchSkills(userProfile, internship);

    return {
      name: 'Skill Match',
      score: result.score,
      weight: this.weights.skillMatch,
      contribution: (result.score * this.weights.skillMatch),
      details: result.details,
      // Without skills on the profile there is nothing to compare.
      applies: (userProfile.skills || []).some(s => typeof s === 'string' && s.trim())
    };
  }

  // Skills stated on the listing are compared as requirements. When a listing
  // states none, the likely skills are derived from its title instead; without
  // that, a catalogue with no skills data would score every listing the same.
  private matchSkills(userProfile: UserProfile, internship: Internship) {
    const stated = (internship.skills || []).filter(s => typeof s === 'string' && s.trim());
    if (stated.length > 0) {
      return calculateSkillMatchScore(userProfile.skills, stated);
    }
    const inferred = internship.inferredSkills
      ? { ...internship.inferredSkills, domain: internship.inferredSkills.domain as any }
      : inferListingSkills(internship.title, internship.description);
    if (inferred.explicit.length === 0 && inferred.typical.length === 0) {
      // Nothing to go on at all: neutral, as before.
      return calculateSkillMatchScore(userProfile.skills, []);
    }
    if (!userProfile.skills || userProfile.skills.length === 0) {
      return { score: 0, matched: [], missing: inferred.explicit, details: 'Add skills to your profile to see how well this matches' };
    }
    return scoreInferredSkills(userProfile.skills, inferred);
  }

  private calculateLocationMatchFactor(
    userProfile: UserProfile,
    internship: Internship
  ): ScoringFactor {
    const locationMatch = this.matchLocation(
      userProfile.location,
      userProfile.preferredLocation,
      internship.location,
      internship.type
    );

    let score = 0;
    let details = '';

    const hasLocation = Boolean(userProfile.location || userProfile.preferredLocation);
    const wantsRemote = isRemotePreference(userProfile.preferredLocation) || isRemotePreference(userProfile.location);
    if (internship.type === 'Remote') {
      // Remote suits any location, but a student who named a city sees
      // listings in that city just ahead of remote ones. A student who chose
      // "Remote" as their location gets remote listings as a full match.
      score = hasLocation && !wantsRemote ? 90 : 100;
      details = wantsRemote ? 'Remote position - matches your preference' : 'Remote position - location flexible';
    } else if (!userProfile.location && !userProfile.preferredLocation) {
      // No location on the profile: nothing to compare, so stay neutral rather
      // than marking every on-site listing as a poor fit.
      score = 50;
      details = 'Add your location to your profile to rank nearby listings higher';
    } else if (locationMatch.isPreferred) {
      score = 100;
      details = `Matches your preferred location: ${userProfile.preferredLocation}`;
    } else if (locationMatch.isMatch) {
      score = 85;
      details = `Matches your current location: ${userProfile.location}`;
    } else if (locationMatch.type === 'nearby') {
      // Not the same city, but within reach (same metro area) or possibly the
      // same place (the listing only names the state).
      score = 65;
      details = `Close to you: ${locationMatch.area} (${internship.location})`;
    } else if (locationMatch.type === 'state') {
      score = 60;
      details = `Same state as your location`;
    } else if (locationMatch.type === 'country') {
      score = 40;
      details = `Same country, different region`;
    } else {
      score = 20;
      details = `Different location (${internship.location})`;
    }

    return {
      name: 'Location Match',
      score,
      weight: this.weights.locationMatch,
      contribution: score * this.weights.locationMatch,
      details,
      applies: hasLocation
    };
  }

  private calculateStipendMatchFactor(
    userProfile: UserProfile,
    internship: Internship
  ): ScoringFactor {
    if (!userProfile.expectedStipend) {
      return {
        name: 'Stipend Match',
        score: 50,
        weight: this.weights.stipendMatch,
        contribution: 50 * this.weights.stipendMatch,
        details: 'No stipend preference specified',
        applies: false
      };
    }

    const expectedRange = this.parseStipend(userProfile.expectedStipend);
    const offeredRange = this.parseStipend(internship.stipend);

    let score = 50;
    let details = '';
    let applies = true;

    if (!offeredRange || !expectedRange || expectedRange.min <= 0) {
      // No usable expectation (or "0"), or the listing states no stipend:
      // nothing to compare, so this factor is left out.
      details = !offeredRange ? 'This listing does not state a stipend' : 'Unable to compare stipends';
      applies = false;
    } else if (offeredRange.min >= expectedRange.min) {
      score = 100;
      details = `Meets or exceeds your expectation (${internship.stipend})`;
    } else {
      const ratio = offeredRange.min / expectedRange.min;
      score = Math.round(Math.min(100, ratio * 100));
      details = `${Math.round(ratio * 100)}% of your expected stipend`;
    }

    return {
      name: 'Stipend Match',
      score,
      weight: this.weights.stipendMatch,
      contribution: score * this.weights.stipendMatch,
      details,
      applies
    };
  }

  private calculateWorkModeMatchFactor(
    userProfile: UserProfile,
    internship: Internship
  ): ScoringFactor {
    if (!userProfile.preferredWorkMode || userProfile.preferredWorkMode.length === 0) {
      return {
        name: 'Work Mode Match',
        score: 50,
        weight: this.weights.workModeMatch,
        contribution: 50 * this.weights.workModeMatch,
        details: 'No work mode preference specified',
        applies: false
      };
    }

    const isMatch = userProfile.preferredWorkMode.includes(internship.type);
    // Hybrid is part remote, part on-site: a partial fit for either preference.
    const partial = !isMatch && internship.type === 'Hybrid';
    const score = isMatch ? 100 : partial ? 60 : 30;
    const details = isMatch
      ? `Matches your preference: ${internship.type}`
      : partial
        ? 'Hybrid - partly matches your preferred work mode'
        : `${internship.type} - not your preferred work mode`;

    return {
      name: 'Work Mode Match',
      score,
      weight: this.weights.workModeMatch,
      contribution: score * this.weights.workModeMatch,
      details,
      applies: true
    };
  }

  private calculateExperienceMatchFactor(
    userProfile: UserProfile,
    internship: Internship
  ): ScoringFactor {
    const userExp = userProfile.experience || 0;
    const requiredExp = internship.requirements?.minExperience || 0;
    const maxExp = internship.requirements?.maxExperience || 10;
    const statesExperience = internship.requirements?.minExperience != null || internship.requirements?.maxExperience != null;

    let score = 50;
    let details = '';

    if (userExp >= requiredExp && userExp <= maxExp) {
      score = 100;
      details = `Your experience (${userExp}y) fits the requirement`;
    } else if (userExp < requiredExp) {
      const gap = requiredExp - userExp;
      score = Math.max(30, 100 - gap * 20);
      details = `${gap} year(s) below minimum experience`;
    } else {
      score = 80;
      details = `You exceed the experience requirement`;
    }

    return {
      name: 'Experience Match',
      score,
      weight: this.weights.experienceMatch,
      contribution: score * this.weights.experienceMatch,
      // Only a listing that states an experience range can be compared.
      details: statesExperience ? details : 'This listing states no experience requirement',
      applies: statesExperience
    };
  }

  private calculateCgpaMatchFactor(
    userProfile: UserProfile,
    internship: Internship
  ): ScoringFactor {
    const userCgpa = userProfile.cgpa || 0;
    const requiredCgpa = internship.cgpaRequirement || 0;

    let score = 50;
    let details = '';

    if (requiredCgpa === 0) {
      score = 100;
      details = 'This listing states no CGPA requirement';
    } else if (userCgpa === 0) {
      score = 50;
      details = 'CGPA not provided';
    } else if (userCgpa >= requiredCgpa) {
      score = 100;
      details = `Your CGPA (${userCgpa}) meets requirement (${requiredCgpa})`;
    } else {
      const gap = requiredCgpa - userCgpa;
      score = Math.max(0, 100 - gap * 50);
      details = `${gap.toFixed(1)} below required CGPA`;
    }

    return {
      name: 'CGPA Match',
      score,
      weight: this.weights.cgpaMatch,
      contribution: score * this.weights.cgpaMatch,
      details,
      applies: requiredCgpa > 0
    };
  }

  private calculateProfileCompletionBonus(userProfile: UserProfile): ScoringFactor {
    const completion = userProfile.profileCompletion || 0;
    const bonusScore = completion; // 0-100

    return {
      name: 'Profile Completion Bonus',
      score: bonusScore,
      weight: this.weights.profileCompletionBonus,
      contribution: bonusScore * this.weights.profileCompletionBonus,
      details: `Profile ${completion}% complete`,
      applies: false
    };
  }

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  private matchLocation(
    userLocation: string | undefined,
    preferredLocation: string | undefined,
    internshipLocation: string,
    workMode: string
  ): LocationMatch {
    if (!userLocation && !preferredLocation) {
      return { isMatch: false, isPreferred: false, type: 'none' };
    }

    // Cities are compared by canonical name, so "Bangalore" matches
    // "Bengaluru" and a listing that names several cities matches any of them.
    if (preferredLocation && sameCity(preferredLocation, internshipLocation)) {
      return { isMatch: true, isPreferred: true, type: 'city' };
    }
    if (userLocation && sameCity(userLocation, internshipLocation)) {
      return { isMatch: true, isPreferred: false, type: 'city' };
    }
    const area = nearbyArea(preferredLocation, internshipLocation) || nearbyArea(userLocation, internshipLocation);
    if (area) {
      return { isMatch: false, isPreferred: false, type: 'nearby', area };
    }

    return { isMatch: false, isPreferred: false, type: 'none' };
  }

  // Both sides are converted to a monthly amount with the shared normalizer, so
  // "15K", "1.5 lakh per annum" and "$15/hr" are compared on the same scale.
  // (The previous parser read "15K / month" as 15 and ignored the pay period.)
  private parseStipend(stipendStr: string): StipendRange | null {
    if (!stipendStr || typeof stipendStr !== 'string' || !/\d/.test(stipendStr)) {
      // No number at all: only an explicit "unpaid" is meaningful.
      if (stipendStr && normalizeStipend(stipendStr).isUnpaid) {
        return { min: 0, max: 0, currency: 'INR', period: 'month' };
      }
      return null;
    }

    const normalized = normalizeStipend(stipendStr);
    return {
      min: normalized.amount,
      max: normalized.amount,
      currency: normalized.currency === '$' ? 'USD' : 'INR',
      period: 'month'
    };
  }

  private generateExplanation(factors: ScoringFactor[], matchedSkills: string[], totalScore: number, comparable: boolean): string {
    if (!comparable) {
      return 'Add your skills and a location to your profile to see how well this internship matches.';
    }
    const topFactors = factors
      .filter(factor => factor.applies !== false)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);

    const quality = this.getMatchQuality(totalScore);
    let explanation = `This internship is ${/^[aeiou]/.test(quality) ? 'an' : 'a'} ${quality} match. `;

    if (matchedSkills.length > 0) {
      explanation += `You have ${matchedSkills.length} matching skill(s): ${matchedSkills.slice(0, 3).join(', ')}${matchedSkills.length > 3 ? '...' : ''}. `;
    }

    const strongestFactor = topFactors[0];
    if (strongestFactor && strongestFactor.score >= 80) {
      explanation += `Strong ${strongestFactor.name.toLowerCase()}.`;
    }

    return explanation;
  }

  private getMatchQuality(total: number): string {
    if (total >= 80) return 'excellent';
    if (total >= 65) return 'great';
    if (total >= 50) return 'good';
    if (total >= 35) return 'fair';
    return 'weak';
  }
}

// Export singleton instance
export const recommendationService = new RecommendationService();
