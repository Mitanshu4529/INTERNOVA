import { locationWithWorkMode } from '../utils/liveApi';
import { describe, it, expect } from 'vitest';
import { calculateSkillMatchScore, normalizeSkill, isKnownSkill, skillsMatch } from '../utils/skillMatcher';
import { normalizeStipend, normalizeSkills } from '../utils/dataNormalizer';
import { RecommendationService } from '../services/recommendationService';

/**
 * Regression tests for defects found in the engineering audit. Each block names
 * the behaviour that used to be wrong.
 */

describe('skill matching: non-dictionary skills', () => {
  it('unrelated requirements are a 0% match, not 100% ("Matched 0/0")', () => {
    const result = calculateSkillMatchScore(['React'], ['Marketing', 'SEO', 'Content Writing']);
    expect(result.score).toBe(0);
    expect(result.matched).toEqual([]);
    expect(result.missing).toHaveLength(3);
    expect(result.details).toContain('Matched 0/3');
  });

  it('non-dictionary skills match each other literally and case-insensitively', () => {
    const result = calculateSkillMatchScore(['seo', 'Python'], ['SEO', 'Content Writing']);
    expect(result.score).toBe(50);
    expect(result.matched).toEqual(['seo']);
  });

  it('blank and missing requirement entries count as "no skills listed"', () => {
    expect(calculateSkillMatchScore(['React'], ['', '   ']).score).toBe(50);
    expect(calculateSkillMatchScore(['React'], undefined as unknown as string[]).score).toBe(50);
    expect(calculateSkillMatchScore(undefined as unknown as string[], ['React']).score).toBe(0);
  });
});

describe('skill matching: fuzzy false positives', () => {
  it('Java and JavaScript stay different skills in both directions', () => {
    expect(skillsMatch('Java', 'JavaScript')).toBe(false);
    expect(skillsMatch('JavaScript', 'Java')).toBe(false);
    expect(calculateSkillMatchScore(['Java'], ['JavaScript']).score).toBe(0);
  });

  it.each([
    ['NestJS', 'next.js'],
    ['Nest.js', 'next.js'],
    ['Nuxt.js', 'next.js'],
    ['Preact', 'react'],
    ['MSSQL', 'mysql'],
    ['Flash', 'flask'],
    ['Mango', 'mongodb'],
    ['Panda', 'pandas'],
  ])('%s is not rewritten to %s', (input, wrong) => {
    const normalized = normalizeSkill(input);
    expect(normalized.normalized).not.toBe(wrong);
    expect(normalized.normalized).toBe(input.toLowerCase());
  });

  it('a genuine one-letter typo of a long skill name is still corrected', () => {
    expect(normalizeSkill('javascrpt').normalized).toBe('javascript');
    expect(normalizeSkill('typescrip').normalized).toBe('typescript');
  });

  it('Object.prototype property names are not treated as known skills', () => {
    for (const word of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(isKnownSkill(word), word).toBe(false);
      expect(normalizeSkill(word).category, word).toBe('other');
    }
  });
});

describe('stipend normalization', () => {
  it.each([
    ['₹15K / month', 15000],
    ['15k', 15000],
    ['₹1.5K per month', 1500],
    ['₹10,000 / month', 10000],
    ['5000-8000', 6500],
    ['5k to 8k per month', 6500],
    ['0-5000', 2500],
    ['3 LPA', 25000],
    ['2 lakh per annum', 16667],
    ['₹5000/month + incentives upto 2000', 5000],
    ['15K/week', 60000],
    ['₹2,000 per week', 8000],
  ])('%s -> %d per month', (input, monthly) => {
    const result = normalizeStipend(input);
    expect(result.amount).toBe(monthly);
    expect(result.isUnpaid).toBe(false);
  });

  it.each(['0', '₹0 / month', 'Unpaid', 'unpaid internship'])('%s is unpaid', (input) => {
    const result = normalizeStipend(input);
    expect(result.isUnpaid).toBe(true);
    expect(result.amount).toBe(0);
  });

  it('hourly pay is converted to a monthly amount', () => {
    expect(normalizeStipend('$15/hr').amount).toBe(15 * 8 * 22);
  });
});

describe('skill list normalization', () => {
  it('keeps hyphenated skill names intact', () => {
    expect(normalizeSkills('scikit-learn, Problem-solving, Front-end')).toEqual(['scikit-learn', 'Problem-solving', 'Front-end']);
  });

  it('still splits on spaced hyphens, commas, pipes and bullets', () => {
    expect(normalizeSkills('React - Node.js | Python; SQL')).toEqual(['React', 'Node.js', 'Python', 'SQL']);
  });

  it('keeps the one-letter languages C and R', () => {
    expect(normalizeSkills('C, R, Python')).toEqual(['C', 'R', 'Python']);
  });
});

describe('recommendation service: stipend factor', () => {
  const service = new RecommendationService();
  const baseInternship = {
    id: 'i1', title: 'Dev Intern', company: 'Acme', location: 'Remote', type: 'Remote',
    duration: '3 months', description: '', skills: ['React'], status: 'Active'
  } as any;
  const baseProfile = { id: 'u1', skills: ['React'], profileCompletion: 100 } as any;

  const stipendFactor = (expectedStipend: string, offered: string) => {
    const score = service.calculateRecommendationScore(
      { ...baseProfile, expectedStipend },
      { ...baseInternship, stipend: offered }
    );
    return score.factors.find((f: any) => f.name === 'Stipend Match')!;
  };

  it('"₹15K / month" meets an expectation of 10000 (was scored 0)', () => {
    expect(stipendFactor('10000', '₹15K / month').score).toBe(100);
  });

  it('a lower offer is scored proportionally', () => {
    expect(stipendFactor('20000', '₹10,000 / month').score).toBe(50);
  });

  it('a yearly figure is compared on a monthly basis', () => {
    expect(stipendFactor('20000', '3 LPA').score).toBe(100);
  });

  it('an expectation of 0 is neutral and never divides by zero', () => {
    const factor = stipendFactor('0', '₹10,000 / month');
    expect(factor.score).toBe(50);
    expect(Number.isFinite(factor.contribution)).toBe(true);
  });

  it('total scores stay within 0-100 and are ordered best first', async () => {
    const results = await service.getRecommendations(
      { ...baseProfile, skills: ['React', 'Node.js'] },
      [
        { ...baseInternship, id: 'a', skills: ['Marketing', 'SEO'] },
        { ...baseInternship, id: 'b', skills: ['React', 'Node.js'] },
        { ...baseInternship, id: 'c', skills: [] },
      ]
    );
    for (const r of results) {
      expect(r.score.totalScore).toBeGreaterThanOrEqual(0);
      expect(r.score.totalScore).toBeLessThanOrEqual(100);
    }
    expect(results.map((r: any) => r.internship.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('work type chosen by a company is kept in the location', () => {
  it('adds Remote or Hybrid when the location does not already say so', () => {
    expect(locationWithWorkMode('Pune', 'Remote')).toBe('Pune (Remote)');
    expect(locationWithWorkMode('Pune', 'Hybrid')).toBe('Pune (Hybrid)');
    expect(locationWithWorkMode('', 'Remote')).toBe('Remote');
  });

  it('leaves the location alone when it already matches, or for on-site work', () => {
    expect(locationWithWorkMode('Work from home', 'Remote')).toBe('Work from home');
    expect(locationWithWorkMode('Pune (Remote)', 'Remote')).toBe('Pune (Remote)');
    expect(locationWithWorkMode('Pune', 'On-site')).toBe('Pune');
    expect(locationWithWorkMode('  ', 'On-site')).toBeNull();
  });
});
