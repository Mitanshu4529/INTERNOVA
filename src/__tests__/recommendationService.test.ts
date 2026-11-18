import { describe, it, expect, beforeEach } from 'vitest';
import { RecommendationService } from '../services/recommendationService';
import type { UserProfile, Internship } from '../types/recommendation';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let mockUserProfile: UserProfile;
  let mockInternships: Internship[];

  beforeEach(() => {
    service = new RecommendationService();

    mockUserProfile = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      skills: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
      university: 'IIT Delhi',
      course: 'Computer Science',
      year: '3rd Year',
      cgpa: 8.5,
      location: 'Delhi',
      preferredLocation: 'Bangalore',
      expectedStipend: '₹20,000 / month',
      preferredWorkMode: ['Remote', 'Hybrid'],
      experience: 1,
      profileCompletion: 85
    };

    mockInternships = [
      {
        id: 'intern-1',
        title: 'Full Stack Developer Intern',
        company: 'TechCorp',
        location: 'Bangalore',
        stipend: '₹25,000 / month',
        duration: '6 months',
        description: 'Work on React and Node.js projects',
        skills: ['JavaScript', 'React', 'Node.js'],
        type: 'Remote',
        status: 'Active',
        companyId: 'company-1',
        source: 'internshala',
        cgpaRequirement: 7.0,
        experienceLevel: 'Entry Level'
      },
      {
        id: 'intern-2',
        title: 'Frontend Developer Intern',
        company: 'WebStudio',
        location: 'Mumbai',
        stipend: '₹15,000 / month',
        duration: '3 months',
        description: 'Build responsive web interfaces',
        skills: ['HTML', 'CSS', 'JavaScript', 'React'],
        type: 'On-site',
        status: 'Active',
        companyId: 'company-2',
        source: 'naukri',
        cgpaRequirement: 8.0
      },
      {
        id: 'intern-3',
        title: 'Backend Developer Intern',
        company: 'DataSystems',
        location: 'Delhi',
        stipend: '₹18,000 / month',
        duration: '4 months',
        description: 'Work with Python and databases',
        skills: ['Python', 'SQL', 'PostgreSQL'],
        type: 'Hybrid',
        status: 'Active',
        companyId: 'company-3',
        source: 'linkedin',
        cgpaRequirement: 7.5
      },
      {
        id: 'intern-4',
        title: 'Java Developer Intern',
        company: 'EnterpriseSoft',
        location: 'Bangalore',
        stipend: '₹30,000 / month',
        duration: '6 months',
        description: 'Enterprise Java development',
        skills: ['Java', 'Spring Boot', 'SQL'],
        type: 'On-site',
        status: 'Closed',
        companyId: 'company-4',
        source: 'company-website'
      }
    ];
  });

  describe('getRecommendations', () => {
    it('should return recommendations sorted by score', async () => {
      const results = await service.getRecommendations(mockUserProfile, mockInternships);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].rank).toBe(1);

      // Verify scores are in descending order
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score.totalScore).toBeGreaterThanOrEqual(
          results[i + 1].score.totalScore
        );
      }
    });

    it('should exclude closed internships', async () => {
      const results = await service.getRecommendations(mockUserProfile, mockInternships);

      const closedInternship = results.find(r => r.internship.status === 'Closed');
      expect(closedInternship).toBeUndefined();
    });

    it('should respect minimum score threshold', async () => {
      const minScore = 60;
      const results = await service.getRecommendations(mockUserProfile, mockInternships, minScore);

      results.forEach(result => {
        expect(result.score.totalScore).toBeGreaterThanOrEqual(minScore);
      });
    });

    it('should assign correct ranks', async () => {
      const results = await service.getRecommendations(mockUserProfile, mockInternships);

      results.forEach((result, index) => {
        expect(result.rank).toBe(index + 1);
      });
    });
  });

  describe('calculateRecommendationScore', () => {
    it('should calculate total score correctly', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[0]);

      expect(score.totalScore).toBeGreaterThan(0);
      expect(score.totalScore).toBeLessThanOrEqual(100);
      expect(score.factors.length).toBeGreaterThan(0);
    });

    it('should include all scoring factors', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[0]);

      const factorNames = score.factors.map(f => f.name);
      expect(factorNames).toContain('Skill Match');
      expect(factorNames).toContain('Location Match');
      expect(factorNames).toContain('Work Mode Match');
      expect(factorNames).toContain('CGPA Match');
    });

    it('should identify matched skills', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[0]);

      expect(score.matchedSkills).toContain('javascript');
      expect(score.matchedSkills).toContain('react');
      expect(score.matchedSkills).toContain('node.js');
    });

    it('should identify missing skills', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[2]);

      expect(score.missingSkills).toContain('python');
      expect(score.missingSkills).toContain('sql');
    });

    it('should generate explanation', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[0]);

      expect(score.explanation).toBeDefined();
      expect(score.explanation.length).toBeGreaterThan(0);
    });
  });

  describe('skill matching', () => {
    it('should give high score for perfect skill match', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[0]);
      const skillFactor = score.factors.find(f => f.name === 'Skill Match');

      expect(skillFactor).toBeDefined();
      expect(skillFactor!.score).toBeGreaterThan(80);
    });

    it('should give low score for no skill match', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[2]);
      const skillFactor = score.factors.find(f => f.name === 'Skill Match');

      expect(skillFactor).toBeDefined();
      expect(skillFactor!.score).toBeLessThan(50);
    });
  });

  describe('location matching', () => {
    it('should score remote positions high, just below a listing in the named city', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[0]);
      const locationFactor = score.factors.find(f => f.name === 'Location Match');

      expect(locationFactor).toBeDefined();
      expect(locationFactor!.score).toBe(90);
      // With no city on the profile, remote is a full match.
      const noCity = service.calculateRecommendationScore({ ...mockUserProfile, location: undefined, preferredLocation: undefined }, mockInternships[0]);
      expect(noCity.factors.find(f => f.name === 'Location Match')!.score).toBe(100);
    });

    it('should give high score for preferred location', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[0]);
      const locationFactor = score.factors.find(f => f.name === 'Location Match');

      expect(locationFactor).toBeDefined();
      expect(locationFactor!.score).toBeGreaterThan(80);
    });

    it('should give medium score for current location', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[2]);
      const locationFactor = score.factors.find(f => f.name === 'Location Match');

      expect(locationFactor).toBeDefined();
      expect(locationFactor!.score).toBeGreaterThan(50);
    });
  });

  describe('work mode matching', () => {
    it('should give high score for matching work mode', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[0]);
      const workModeFactor = score.factors.find(f => f.name === 'Work Mode Match');

      expect(workModeFactor).toBeDefined();
      expect(workModeFactor!.score).toBe(100);
    });

    it('should give low score for non-matching work mode', () => {
      const onSiteInternship = mockInternships[1];
      const score = service.calculateRecommendationScore(mockUserProfile, onSiteInternship);
      const workModeFactor = score.factors.find(f => f.name === 'Work Mode Match');

      expect(workModeFactor).toBeDefined();
      expect(workModeFactor!.score).toBeLessThan(50);
    });
  });

  describe('CGPA matching', () => {
    it('should give max score when user CGPA meets requirement', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[0]);
      const cgpaFactor = score.factors.find(f => f.name === 'CGPA Match');

      expect(cgpaFactor).toBeDefined();
      expect(cgpaFactor!.score).toBe(100);
    });

    it('should give max score when no CGPA requirement', () => {
      const internshipNoCgpa = { ...mockInternships[0], cgpaRequirement: 0 };
      const score = service.calculateRecommendationScore(mockUserProfile, internshipNoCgpa);
      const cgpaFactor = score.factors.find(f => f.name === 'CGPA Match');

      expect(cgpaFactor).toBeDefined();
      expect(cgpaFactor!.score).toBe(100);
    });

    it('should penalize when CGPA below requirement', () => {
      const highCgpaInternship = { ...mockInternships[0], cgpaRequirement: 9.0 };
      const score = service.calculateRecommendationScore(mockUserProfile, highCgpaInternship);
      const cgpaFactor = score.factors.find(f => f.name === 'CGPA Match');

      expect(cgpaFactor).toBeDefined();
      expect(cgpaFactor!.score).toBeLessThan(100);
    });
  });

  describe('profile completion bonus', () => {
    it('should reward complete profiles', () => {
      const score = service.calculateRecommendationScore(mockUserProfile, mockInternships[0]);
      const bonusFactor = score.factors.find(f => f.name === 'Profile Completion Bonus');

      expect(bonusFactor).toBeDefined();
      expect(bonusFactor!.score).toBe(85);
    });

    it('should penalize incomplete profiles', () => {
      const incompleteProfile = { ...mockUserProfile, profileCompletion: 30 };
      const score = service.calculateRecommendationScore(incompleteProfile, mockInternships[0]);
      const bonusFactor = score.factors.find(f => f.name === 'Profile Completion Bonus');

      expect(bonusFactor).toBeDefined();
      expect(bonusFactor!.score).toBe(30);
    });
  });

  describe('edge cases', () => {
    it('should handle empty skills array', () => {
      const noSkillsProfile = { ...mockUserProfile, skills: [] };
      const score = service.calculateRecommendationScore(noSkillsProfile, mockInternships[0]);

      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.matchedSkills.length).toBe(0);
    });

    it('should handle missing location', () => {
      const noLocationProfile = { ...mockUserProfile, location: undefined, preferredLocation: undefined };
      const score = service.calculateRecommendationScore(noLocationProfile, mockInternships[0]);

      expect(score.totalScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing CGPA', () => {
      const noCgpaProfile = { ...mockUserProfile, cgpa: 0 };
      const score = service.calculateRecommendationScore(noCgpaProfile, mockInternships[0]);

      expect(score.totalScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty internship list', async () => {
      const results = await service.getRecommendations(mockUserProfile, []);

      expect(results.length).toBe(0);
    });
  });

  describe('custom weights', () => {
    it('should allow custom weight configuration', () => {
      const customService = new RecommendationService({
        skillMatch: 0.5,
        locationMatch: 0.2
      });

      const score = customService.calculateRecommendationScore(mockUserProfile, mockInternships[0]);

      expect(score.factors.find(f => f.name === 'Skill Match')?.weight).toBe(0.5);
      expect(score.factors.find(f => f.name === 'Location Match')?.weight).toBe(0.2);
    });
  });
});
