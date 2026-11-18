import { describe, it, expect } from 'vitest';
import {
  normalizeWorkMode,
  normalizeLocation,
  normalizeStipend,
  normalizeSkills,
  validateInternshipRecord,
  normalizeInternshipRecord
} from '../utils/dataNormalizer';

describe('Data Normalizer', () => {
  describe('normalizeWorkMode', () => {
    it('should normalize clear remote values', () => {
      expect(normalizeWorkMode('Remote')).toBe('Remote');
      expect(normalizeWorkMode('Work from home')).toBe('Remote');
      expect(normalizeWorkMode('WFH')).toBe('Remote');
      expect(normalizeWorkMode('Fully Remote')).toBe('Remote');
    });

    it('should normalize hybrid values', () => {
      expect(normalizeWorkMode('Hybrid')).toBe('Hybrid');
      expect(normalizeWorkMode('Flexible')).toBe('Hybrid');
      expect(normalizeWorkMode('Remote/On-site')).toBe('Hybrid');
    });

    it('should normalize on-site values', () => {
      expect(normalizeWorkMode('On-site')).toBe('On-site');
      expect(normalizeWorkMode('Onsite')).toBe('On-site');
      expect(normalizeWorkMode('In-office')).toBe('On-site');
      expect(normalizeWorkMode('Office')).toBe('On-site');
    });

    it('should default to On-site for unknown/empty values', () => {
      expect(normalizeWorkMode('')).toBe('On-site');
      expect(normalizeWorkMode(undefined)).toBe('On-site');
      expect(normalizeWorkMode(null)).toBe('On-site');
    });

    it('should be case-insensitive', () => {
      expect(normalizeWorkMode('REMOTE')).toBe('Remote');
      expect(normalizeWorkMode('HyBRiD')).toBe('Hybrid');
    });
  });

  describe('normalizeLocation', () => {
    it('should identify remote locations', () => {
      expect(normalizeLocation('Remote')).toBe('Remote');
      expect(normalizeLocation('Work from home')).toBe('Remote');
    });

    it('should normalize well-known Indian cities', () => {
      expect(normalizeLocation('Bangalore')).toBe('Bangalore, Karnataka, India');
      expect(normalizeLocation('bengaluru')).toBe('Bangalore, Karnataka, India');
      expect(normalizeLocation('Delhi')).toBe('Delhi, India');
      expect(normalizeLocation('New Delhi')).toBe('Delhi, India');
      expect(normalizeLocation('Kochi')).toBe('Kochi, Kerala, India');
    });

    it('should preserve structured locations with commas', () => {
      expect(normalizeLocation('Bangalore, India')).toBe('Bangalore, India');
      expect(normalizeLocation('Pune, Maharashtra')).toBe('Pune, Maharashtra');
    });

    it('should title-case comma-separated locations', () => {
      expect(normalizeLocation('jaipur, rajasthan')).toBe('Jaipur, Rajasthan');
    });
  });

  describe('normalizeStipend', () => {
    it('should detect unpaid internships', () => {
      const result = normalizeStipend('Unpaid');
      expect(result.isUnpaid).toBe(true);
      expect(result.amount).toBe(0);
      expect(result.text).toBe('Unpaid');
    });

    it('should parse monthly stipend with INR', () => {
      const result = normalizeStipend('₹10,000 / month');
      expect(result.amount).toBe(10000);
      expect(result.currency).toBe('₹');
      expect(result.period).toBe('month');
    });

    it('should parse range stipends by averaging', () => {
      const result = normalizeStipend('₹10,000 - 20,000');
      expect(result.amount).toBe(15000);
    });

    it('should handle K-suffix amounts', () => {
      const result = normalizeStipend('₹15K / month');
      expect(result.amount).toBe(15000);
    });

    it('should convert hourly to monthly', () => {
      const result = normalizeStipend('$15/hr');
      expect(result.currency).toBe('$');
      expect(result.amount).toBe(15 * 8 * 22); // ~2640
      expect(result.period).toBe('month');
    });

    it('should handle unstipend values', () => {
      const result = normalizeStipend('no stipend');
      expect(result.isUnpaid).toBe(true);
    });

    it('should not crash on empty input', () => {
      // A missing stipend is reported as missing, not as an invented amount.
      const result = normalizeStipend('');
      expect(result).toMatchObject({ text: 'Not specified', amount: 0, isUnpaid: false });
    });
  });

  describe('normalizeSkills', () => {
    it('should split on multiple delimiters', () => {
      const skills = normalizeSkills('JavaScript, React; Node.js | Python');
      expect(skills).toEqual(['JavaScript', 'React', 'Node.js', 'Python']);
    });

    it('should deduplicate case-insensitively', () => {
      const skills = normalizeSkills('JavaScript, React, javascript, react');
      expect(skills).toEqual(['JavaScript', 'React']);
    });

    it('should remove trailing punctuation', () => {
      const skills = normalizeSkills('JavaScript., React,');
      expect(skills).toEqual(['JavaScript', 'React']);
    });

    it('should handle newline separators', () => {
      const skills = normalizeSkills('Python\nDjango\nFlask');
      expect(skills).toEqual(['Python', 'Django', 'Flask']);
    });

    it('should return empty array for empty input', () => {
      expect(normalizeSkills('')).toEqual([]);
      expect(normalizeSkills(undefined)).toEqual([]);
    });
  });

  describe('validateInternshipRecord', () => {
    it('should pass valid records', () => {
      const result = validateInternshipRecord({
        title: 'Frontend Intern',
        company: 'TechCorp',
        skills: 'React',
        stipend: '₹15,000'
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should flag missing title', () => {
      const result = validateInternshipRecord({
        company: 'TechCorp',
        skills: 'React'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing internship title');
    });

    it('should warn but not fail on missing secondary fields', () => {
      const result = validateInternshipRecord({
        title: 'Frontend Intern'
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('normalizeInternshipRecord', () => {
    it('should produce fully structured internship objects', () => {
      const record = {
        title: 'React Developer Intern',
        company: 'TechCorp',
        location: 'Bengaluru',
        type: 'Work from home',
        stipend: '₹20,000 / month',
        skills: 'React, JavaScript, TypeScript',
        duration: '6 months'
      };

      const result = normalizeInternshipRecord(record, 'test-source');

      expect(result.title).toBe('React Developer Intern');
      expect(result.company).toBe('TechCorp');
      expect(result.location).toBe('Bangalore, Karnataka, India');
      expect(result.type).toBe('Remote');
      expect(result.status).toBe('Active');
      expect(result.skills).toEqual(['React', 'JavaScript', 'TypeScript']);
      expect(result.stipendAmount).toBe(20000);
      expect(result.source).toBe('test-source');
    });

    it('should detect work mode from location when type is missing', () => {
      const record = {
        title: 'Design Intern',
        location: 'Remote',
        stipend: '₹10,000'
      };

      const result = normalizeInternshipRecord(record);
      expect(result.type).toBe('Remote');
      expect(result.location).toBe('Remote');
    });

    it('should use defaults for missing fields', () => {
      const record = {
        title: 'Generic Intern',
        location: '',
        stipend: ''
      };

      const result = normalizeInternshipRecord(record);
      expect(result.company).toBe('Partner Company');
      expect(result.duration).toBe('');            // not invented
      expect(result.description).toBe('');
      expect(result.stipend).toBe('Not specified');
      expect(result.location).toBe('Remote');
      expect(result.skills).toEqual([]);
      expect(result.type).toBe('On-site');
    });
  });
});