import { describe, it, expect } from 'vitest';
import {
  normalizeSkill,
  normalizeSkills,
  getCanonicalSkills,
  skillsMatch,
  calculateSkillMatchScore,
  isKnownSkill
} from '../utils/skillMatcher';

describe('Skill Matcher', () => {
  describe('normalizeSkill', () => {
    it('should normalize exact matches', () => {
      const result = normalizeSkill('JavaScript');
      expect(result.normalized).toBe('javascript');
      expect(result.confidence).toBe(1.0);
    });

    it('should normalize aliases', () => {
      const jsResult = normalizeSkill('js');
      expect(jsResult.normalized).toBe('javascript');
      expect(jsResult.confidence).toBe(1.0);

      const reactResult = normalizeSkill('reactjs');
      expect(reactResult.normalized).toBe('react');
      expect(reactResult.confidence).toBe(1.0);
    });

    it('should handle case insensitivity', () => {
      const result1 = normalizeSkill('JAVASCRIPT');
      const result2 = normalizeSkill('javascript');
      const result3 = normalizeSkill('JavaScript');

      expect(result1.normalized).toBe('javascript');
      expect(result2.normalized).toBe('javascript');
      expect(result3.normalized).toBe('javascript');
    });

    it('should use fuzzy matching for typos', () => {
      const result = normalizeSkill('Javascrpt'); // Missing 'i'
      expect(result.normalized).toBe('javascript');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should return low confidence for unknown skills', () => {
      const result = normalizeSkill('UnknownSkillXYZ');
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('skillsMatch - preventing false positives', () => {
    it('should NOT match Java and JavaScript', () => {
      const match = skillsMatch('Java', 'JavaScript');
      expect(match).toBe(false);
    });

    it('should NOT match Java and JavaScript (reversed)', () => {
      const match = skillsMatch('JavaScript', 'Java');
      expect(match).toBe(false);
    });

    it('should match JavaScript and js', () => {
      const match = skillsMatch('JavaScript', 'js');
      expect(match).toBe(true);
    });

    it('should match React and reactjs', () => {
      const match = skillsMatch('React', 'reactjs');
      expect(match).toBe(true);
    });

    it('should match Python and py', () => {
      const match = skillsMatch('Python', 'py');
      expect(match).toBe(true);
    });

    it('should NOT match related but different skills', () => {
      const match = skillsMatch('React', 'Angular');
      expect(match).toBe(false);
    });
  });

  describe('normalizeSkills', () => {
    it('should normalize array of skills', () => {
      const skills = ['JavaScript', 'reactjs', 'node.js', 'PYTHON'];
      const result = normalizeSkills(skills);

      expect(result.length).toBe(4);
      expect(result[0].normalized).toBe('javascript');
      expect(result[1].normalized).toBe('react');
      expect(result[2].normalized).toBe('node.js');
      expect(result[3].normalized).toBe('python');
    });
  });

  describe('getCanonicalSkills', () => {
    it('should deduplicate normalized skills', () => {
      const skills = ['JavaScript', 'js', 'javascript', 'JS'];
      const result = getCanonicalSkills(skills);

      expect(result.length).toBe(1);
      expect(result[0]).toBe('javascript');
    });

    it('should keep skills that are not in the dictionary as their literal', () => {
      // Dropping unknown skills made requirement lists like ["Marketing", "SEO"]
      // look empty, which then scored as a perfect match.
      const skills = ['JavaScript', 'UnknownSkillXYZ', '  '];
      const result = getCanonicalSkills(skills);

      expect(result).toEqual(['javascript', 'unknownskillxyz']);
    });
  });

  describe('calculateSkillMatchScore', () => {
    it('should calculate 100% match when all skills present', () => {
      const userSkills = ['JavaScript', 'React', 'Node.js'];
      const requiredSkills = ['javascript', 'react', 'node.js'];
      const result = calculateSkillMatchScore(userSkills, requiredSkills);

      expect(result.score).toBe(100);
      expect(result.matched.length).toBe(3);
      expect(result.missing.length).toBe(0);
    });

    it('should calculate partial match correctly', () => {
      const userSkills = ['JavaScript', 'React'];
      const requiredSkills = ['javascript', 'react', 'node.js', 'typescript'];
      const result = calculateSkillMatchScore(userSkills, requiredSkills);

      expect(result.score).toBe(50); // 2 out of 4
      expect(result.matched.length).toBe(2);
      expect(result.missing.length).toBe(2);
    });

    it('should return 0 for no matching skills', () => {
      const userSkills = ['Python', 'Django'];
      const requiredSkills = ['javascript', 'react'];
      const result = calculateSkillMatchScore(userSkills, requiredSkills);

      expect(result.score).toBe(0);
      expect(result.matched.length).toBe(0);
      expect(result.missing.length).toBe(2);
    });

    it('should return a neutral score when the listing states no skills', () => {
      const userSkills = ['JavaScript', 'React'];
      const requiredSkills: string[] = [];
      const result = calculateSkillMatchScore(userSkills, requiredSkills);

      // Neutral, not 100: a listing without skills is not a perfect match.
      expect(result.score).toBe(50);
      expect(result.details).toContain('No specific skills listed');
    });

    it('should return 0 when user has no skills', () => {
      const userSkills: string[] = [];
      const requiredSkills = ['javascript', 'react'];
      const result = calculateSkillMatchScore(userSkills, requiredSkills);

      expect(result.score).toBe(0);
      expect(result.details).toContain('No skills provided');
    });

    it('should match skills case-insensitively', () => {
      const userSkills = ['JAVASCRIPT', 'REACT'];
      const requiredSkills = ['javascript', 'react'];
      const result = calculateSkillMatchScore(userSkills, requiredSkills);

      expect(result.score).toBe(100);
    });

    it('should provide detailed explanation', () => {
      const userSkills = ['JavaScript', 'React'];
      const requiredSkills = ['javascript', 'react', 'node.js'];
      const result = calculateSkillMatchScore(userSkills, requiredSkills);

      expect(result.details).toContain('Matched 2/3');
      expect(result.details).toContain('javascript');
      expect(result.details).toContain('react');
      expect(result.details).toContain('node.js');
    });
  });

  describe('isKnownSkill', () => {
    it('should return true for known skills', () => {
      expect(isKnownSkill('JavaScript')).toBe(true);
      expect(isKnownSkill('React')).toBe(true);
      expect(isKnownSkill('Python')).toBe(true);
    });

    it('should return true for aliases', () => {
      expect(isKnownSkill('js')).toBe(true);
      expect(isKnownSkill('reactjs')).toBe(true);
      expect(isKnownSkill('py')).toBe(true);
    });

    it('should return false for unknown skills', () => {
      expect(isKnownSkill('UnknownSkillXYZ')).toBe(false);
    });
  });

  describe('Java vs JavaScript disambiguation', () => {
    it('should clearly separate Java and JavaScript', () => {
      const javaSkill = normalizeSkill('Java');
      const jsSkill = normalizeSkill('JavaScript');

      expect(javaSkill.normalized).toBe('java');
      expect(jsSkill.normalized).toBe('javascript');
      expect(javaSkill.normalized).not.toBe(jsSkill.normalized);
    });

    it('should not match Java when user has JavaScript', () => {
      const userSkills = ['JavaScript'];
      const requiredSkills = ['Java'];
      const result = calculateSkillMatchScore(userSkills, requiredSkills);

      expect(result.score).toBe(0);
      expect(result.matched.length).toBe(0);
    });

    it('should not match JavaScript when user has Java', () => {
      const userSkills = ['Java'];
      const requiredSkills = ['JavaScript'];
      const result = calculateSkillMatchScore(userSkills, requiredSkills);

      expect(result.score).toBe(0);
      expect(result.matched.length).toBe(0);
    });
  });
});
