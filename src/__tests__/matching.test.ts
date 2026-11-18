import { describe, it, expect } from 'vitest';
import { inferListingSkills, scoreInferredSkills } from '../utils/listingSkills';
import { sameCity, canonicalCity, nearbyArea, isRemotePreference } from '../utils/locations';
import { mapInternship, repairShiftedRow } from '../utils/liveApi';
import { RecommendationService } from '../services/recommendationService';

// Matching against a catalogue that states no skills on any listing, city
// spelling, and repair of rows that were imported with shifted columns.

describe('skills inferred from listing titles', () => {
  it.each([
    ['ReactJS Development', ['React']],
    ['Node.js Development', ['Node.js']],
    ['React Native Developer (Intern)', ['React Native']],
    ['Python Django Full-Stack Intern', ['Python', 'Django', 'Full Stack Development']],
    ['Search Engine Optimization (SEO)', ['SEO']],
    ['Digital Marketing', ['Digital Marketing']],
    ['Human Resources (HR)', ['Human Resources']],
    ['Business Development (Sales)', ['Business Development', 'Sales']],
    ['pl/sql developer - Internship', ['SQL']],
    ['Java Development', ['Java']],
  ])('%s -> %j', (title, explicit) => {
    expect(inferListingSkills(title).explicit).toEqual(explicit);
  });

  it('JavaScript in a title is not read as Java', () => {
    expect(inferListingSkills('JavaScript Developer Intern').explicit).toEqual(['JavaScript']);
  });

  it('a title with nothing recognisable infers nothing', () => {
    expect(inferListingSkills('Intern')).toEqual({ explicit: [], typical: [], domain: undefined });
    expect(inferListingSkills(null)).toEqual({ explicit: [], typical: [], domain: undefined });
  });

  it('a description that only holds a city adds no skills', () => {
    expect(inferListingSkills('Operations', 'Goa').explicit).toEqual(['Operations']);
  });

  const mine = ['React', 'Node.js'];
  const score = (title: string) => scoreInferredSkills(mine, inferListingSkills(title)).score;

  it('ranks listings sensibly for a React + Node.js profile', () => {
    expect(score('ReactJS Development')).toBe(100);          // named in the title
    expect(score('Node.js Development')).toBe(100);
    expect(score('Full Stack Development')).toBe(90);        // two typical skills
    expect(score('Web Development')).toBe(90);
    expect(score('Front End Development')).toBe(70);         // one typical skill
    expect(score('Backend Development')).toBe(70);
    expect(score('Python Development')).toBe(55);            // same field only
    expect(score('Digital Marketing')).toBe(0);              // different field
    expect(score('Human Resources (HR)')).toBe(0);
  });

  it('a marketing profile is matched to marketing listings, not software ones', () => {
    const s = (title: string) => scoreInferredSkills(['SEO', 'Content Writing'], inferListingSkills(title)).score;
    expect(s('Search Engine Optimization (SEO)')).toBe(100);
    expect(s('Content Writing')).toBe(100);
    expect(s('Digital Marketing')).toBe(70);
    expect(s('ReactJS Development')).toBe(0);
  });

  it.each([
    [['Law'], 'Legal Intern', 100],
    [['HR'], 'Human Resources (HR)', 100],
    [['Teaching'], 'Teaching Intern Early Childhood', 100],
    [['AutoCAD', 'Civil Engineering'], 'Civil Site Engineer', 100],
    [['Mechanical Engineering'], 'Mechanical Design Intern', 100],
    [['Social Media Marketing'], 'Social Media Marketing', 100],
    [['Sales'], 'Business Developer', 70],                   // typical skill of the role
    [['Rust'], 'Rust Developer', 100],
    [['Research'], 'Research Analyst Intern', 100],
    [['Accounting'], 'CA Intern', 100],
    [['Public Relations'], 'Media & Public Relations (PR)', 100],
    [['Embedded Systems'], 'Embedded Systems', 100],
    [['Photoshop'], 'Design Intern', 55],                    // same field, generic title
    [['Law'], 'ReactJS Development', 0],
  ] as [string[], string, number][])('%j against "%s" scores %i', (skills, title, expected) => {
    expect(scoreInferredSkills(skills, inferListingSkills(title)).score).toBe(expected);
  });

  it('broad words are only read from the title, not from a description', () => {
    const inferred = inferListingSkills('Sales Intern', 'You will support the design team and do research on events.');
    expect(inferred.explicit).toEqual(['Sales']);
  });

  it('a specific design skill is not doubled up with generic "Design"', () => {
    expect(inferListingSkills('Graphic Designer Intern').explicit).toEqual(['Graphic Design']);
    expect(inferListingSkills('UI/UX Designer').explicit).toEqual(['UI/UX Design']);
  });

  it('explains what matched', () => {
    const result = scoreInferredSkills(mine, inferListingSkills('Full Stack Development'));
    expect(result.matched).toEqual(['React', 'Node.js']);
    expect(result.details).toContain('inferred from the title');
  });
});

describe('city names', () => {
  it('treats renamed cities as the same place', () => {
    expect(sameCity('Bangalore', 'Bengaluru')).toBe(true);
    expect(sameCity('bangalore', 'Bengaluru, Karnataka, India')).toBe(true);
    expect(sameCity('Gurgaon', 'Gurugram')).toBe(true);
    expect(sameCity('Delhi', 'New Delhi')).toBe(true);
    expect(canonicalCity('  Bombay ')).toBe('mumbai');
  });

  it('matches any city in a multi-city listing', () => {
    expect(sameCity('Pune', 'Mumbai, Pune, Bengaluru')).toBe(true);
    expect(sameCity('Kochi', 'Mumbai, Pune, Bengaluru')).toBe(false);
  });

  it('does not match on a shared first word or a prefix', () => {
    expect(sameCity('New Delhi', 'New York, USA')).toBe(false);
    expect(sameCity('Goa', 'Goalpara')).toBe(false);
    expect(sameCity('', 'Bengaluru')).toBe(false);
  });
});

describe('nearby places', () => {
  it('links cities in one commuting area', () => {
    expect(nearbyArea('Noida', 'Delhi')).toBe('Delhi NCR');
    expect(nearbyArea('Gurgaon', 'New Delhi, Noida')).toBe('Delhi NCR');
    expect(nearbyArea('Thane', 'Mumbai')).toBe('Mumbai area');
  });

  it('links a state named on a listing to a city in it, both ways round', () => {
    expect(nearbyArea('Kochi', 'Kerala')).toBe('Kerala');
    expect(nearbyArea('Karnataka', 'Bangalore')).toBe('Karnataka');
  });

  it('the same city is not "nearby", and unrelated cities are not linked', () => {
    expect(nearbyArea('Delhi', 'New Delhi')).toBeNull();
    expect(nearbyArea('Noida', 'Mumbai')).toBeNull();
    expect(nearbyArea('Pune', 'Karnataka')).toBeNull();
    expect(nearbyArea('', 'Delhi')).toBeNull();
  });

  it('recognises a remote preference', () => {
    expect(isRemotePreference('Remote')).toBe(true);
    expect(isRemotePreference('Work from home')).toBe(true);
    expect(isRemotePreference('Pune')).toBe(false);
    expect(isRemotePreference(undefined)).toBe(false);
  });
});

describe('recommendation service on a catalogue without stated skills', () => {
  const service = new RecommendationService();
  const listing = (id: string, title: string, location: string) => ({
    ...mapInternship({ id, title, company: 'Acme', location, skills: [], description: title, stipend: 'Unpaid', duration: '3 months' }),
    companyId: '', source: '',
  }) as any;
  const profile: any = { id: 'u', name: 'U', email: 'u@example.com', skills: ['React', 'Node.js'], location: 'Bangalore', preferredLocation: 'Bangalore', profileCompletion: 60 };

  it('puts skill-and-city matches first for React + Node.js in Bangalore', async () => {
    const results = await service.getRecommendations(profile, [
      listing('hr-remote', 'Human Resources (HR)', 'Work from home'),
      listing('marketing-blr', 'Digital Marketing', 'Bengaluru'),
      listing('react-chennai', 'ReactJS Development', 'Chennai'),
      listing('fullstack-blr', 'Full Stack Development', 'Bengaluru'),
      listing('react-blr', 'ReactJS Development', 'Bengaluru'),
      listing('node-remote', 'Node.js Development', 'Work from home'),
    ]);
    const order = results.map(r => r.internship.id);
    // Same city first, then the remote listing with the same skill match.
    expect(order[0]).toBe('react-blr');
    expect(order.slice(1, 3).sort()).toEqual(['fullstack-blr', 'node-remote']);
    expect(order.indexOf('react-chennai')).toBeLessThan(order.indexOf('marketing-blr'));
    // Neither skills nor (for the on-site one) field match: these two come last.
    expect(order.slice(4).sort()).toEqual(['hr-remote', 'marketing-blr']);
    // The scores are spread out, not all the same.
    expect(new Set(results.map(r => r.score.totalScore)).size).toBeGreaterThanOrEqual(3);
  });

  it('"Bangalore" on the profile matches a "Bengaluru" listing', () => {
    const at = (city: string) => service.calculateRecommendationScore(profile, listing('x', 'ReactJS Development', city)).factors
      .find(f => f.name === 'Location Match')!.score;
    expect(at('Bengaluru')).toBe(100);
    expect(at('Chennai')).toBe(20);
  });

  it('a nearby city scores between the same city and a different one', () => {
    const noida = { ...profile, location: 'Noida', preferredLocation: 'Noida' };
    const factor = (city: string) => service.calculateRecommendationScore(noida, listing('x', 'ReactJS Development', city)).factors
      .find(f => f.name === 'Location Match')!;
    expect(factor('Noida').score).toBe(100);
    expect(factor('Delhi').score).toBe(65);
    expect(factor('Delhi').details).toContain('Delhi NCR');
    expect(factor('Chennai').score).toBe(20);
    // Order in the feed: same city, then remote, then nearby, then elsewhere.
    expect(factor('Work from home').score).toBe(90);
  });

  it('a student who chose "Remote" gets remote listings as a full match', () => {
    const remote = { ...profile, location: 'Remote', preferredLocation: 'Remote' };
    const factor = (city: string) => service.calculateRecommendationScore(remote, listing('x', 'ReactJS Development', city)).factors
      .find(f => f.name === 'Location Match')!;
    expect(factor('Work from home').score).toBe(100);
    expect(factor('Bengaluru').score).toBe(20);
  });

  it('a profile without a location is neutral on location, not penalised', () => {
    const factor = service.calculateRecommendationScore({ ...profile, location: undefined, preferredLocation: undefined }, listing('x', 'ReactJS Development', 'Chennai')).factors
      .find(f => f.name === 'Location Match')!;
    expect(factor.score).toBe(50);
  });

  it('skills stated on a listing take priority over inferred ones', () => {
    const stated = { ...listing('s', 'ReactJS Development', 'Bengaluru'), skills: ['Python', 'Django'], inferredSkills: undefined };
    const score = service.calculateRecommendationScore(profile, stated);
    expect(score.matchedSkills).toEqual([]);
    expect(score.factors.find(f => f.name === 'Skill Match')!.score).toBe(0);
  });

  it('uses "an" before a vowel in the explanation', () => {
    const text = service.calculateRecommendationScore(profile, listing('x', 'ReactJS Development', 'Bengaluru')).explanation;
    expect(text).toMatch(/is an excellent match/);
  });

  it('scores a few thousand listings quickly', async () => {
    const titles = ['ReactJS Development', 'Digital Marketing', 'Full Stack Development', 'Human Resources (HR)', 'Sales', 'Data Science'];
    const many = Array.from({ length: 3000 }, (_, i) => listing(`l${i}`, titles[i % titles.length], i % 2 ? 'Bengaluru' : 'Mumbai'));
    const start = performance.now();
    const results = await service.getRecommendations(profile, many);
    expect(results).toHaveLength(3000);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});

describe('repair of listings imported with shifted columns', () => {
  const shifted = {
    id: '1', title: 'Node.js Development',
    company: 'https://internshala.com/internship/detail/node-js-development-internship-at-infoware',
    location: 'Infoware', description: 'Ahmedabad, Gandhinagar', stipend: 'Actively hiring', stipendamount: 0,
    duration: 'https://internshala.com/static/images/search/placeholder_logo.svg', skills: null, source: null, posted: null,
  };

  it('puts company, location and apply link back in the right fields', () => {
    const fixed = mapInternship(shifted);
    expect(fixed).toMatchObject({
      title: 'Node.js Development', company: 'Infoware', location: 'Ahmedabad, Gandhinagar',
      duration: null, stipend: null, description: null,
      source: 'https://internshala.com/internship/detail/node-js-development-internship-at-infoware',
    });
    expect(fixed.inferredSkills?.explicit).toEqual(['Node.js']);
  });

  it('"Work from home" in the shifted location becomes a remote listing', () => {
    expect(mapInternship({ ...shifted, description: 'Work from home' }).type).toBe('Remote');
  });

  it('leaves correctly imported rows untouched', () => {
    const good = { id: '2', title: 'Sales Intern', company: 'Acme', location: 'Bengaluru', description: 'Sell things', stipend: '10,000/month', duration: '3 months', skills: ['Sales'] };
    expect(repairShiftedRow(good)).toBe(good);
    const mapped = mapInternship(good);
    expect(mapped).toMatchObject({ company: 'Acme', location: 'Bengaluru', duration: '3 months', skills: ['Sales'] });
    expect(mapped.inferredSkills).toBeUndefined();
  });
});

describe('the match percentage counts only what can be compared', () => {
  const service = new RecommendationService();
  const listing = (title: string, location: string, extra: any = {}) => ({
    ...mapInternship({ id: title + location, title, company: 'Acme', location, skills: [], description: title, stipend: extra.stipend ?? null, duration: '3 months' }),
    companyId: '', source: '', ...extra.fields,
  }) as any;
  const student: any = { id: 'u', name: 'U', email: 'u@example.com', skills: ['React', 'Node.js'], location: 'Bangalore', preferredLocation: 'Bangalore', profileCompletion: 60 };
  const total = (profile: any, l: any) => service.calculateRecommendationScore(profile, l).totalScore;

  it('a perfect match is 100% and a listing with nothing in common is close to 0%', () => {
    expect(total(student, listing('ReactJS Development', 'Bengaluru'))).toBe(100);
    expect(total(student, listing('Human Resources (HR)', 'Chennai'))).toBeLessThanOrEqual(10);
    // The old formula gave these about 85% and 40% or more.
  });

  it('orders the in-between cases sensibly', () => {
    const sameSkillOtherCity = total(student, listing('ReactJS Development', 'Chennai'));
    const sameSkillRemote = total(student, listing('ReactJS Development', 'Work from home'));
    const vagueTitleSameCity = total(student, listing('Intern', 'Bengaluru'));
    const otherFieldSameCity = total(student, listing('Human Resources (HR)', 'Bengaluru'));
    expect(sameSkillRemote).toBeGreaterThan(sameSkillOtherCity);
    expect(sameSkillOtherCity).toBeGreaterThan(vagueTitleSameCity);   // a known skill match beats an unknown one nearby
    expect(vagueTitleSameCity).toBeGreaterThan(otherFieldSameCity);   // unknown beats known-unrelated
    expect(sameSkillRemote).toBeGreaterThanOrEqual(95);
    expect(otherFieldSameCity).toBeLessThan(40);
  });

  it('factors with nothing to compare are marked and add nothing', () => {
    const score = service.calculateRecommendationScore(student, listing('ReactJS Development', 'Bengaluru'));
    const byName = Object.fromEntries(score.factors.map(f => [f.name, f]));
    expect(byName['Skill Match'].applies).toBe(true);
    expect(byName['Location Match'].applies).toBe(true);
    for (const name of ['Stipend Match', 'Work Mode Match', 'Experience Match', 'CGPA Match', 'Profile Completion Bonus']) {
      expect(byName[name].applies, name).toBe(false);
      expect(byName[name].contribution, name).toBe(0);
    }
    // The contributions of the factors that were compared add up to the total.
    const sum = score.factors.reduce((s, f) => s + f.contribution, 0);
    expect(Math.round(sum)).toBe(score.totalScore);
  });

  it('a filled-in profile does not change the percentage by itself', () => {
    const l = listing('ReactJS Development', 'Chennai');
    expect(total({ ...student, profileCompletion: 100 }, l)).toBe(total({ ...student, profileCompletion: 10 }, l));
  });

  it('a work-mode preference counts once the student states one', () => {
    const wantsRemote = { ...student, preferredWorkMode: ['Remote'] };
    const remote = listing('ReactJS Development', 'Work from home');
    const onsite = listing('ReactJS Development', 'Bengaluru');
    const hybrid = listing('ReactJS Development', 'Bengaluru (Hybrid)');
    const mode = (l: any) => service.calculateRecommendationScore(wantsRemote, l).factors.find(f => f.name === 'Work Mode Match')!;
    expect(mode(remote)).toMatchObject({ applies: true, score: 100 });
    expect(mode(onsite)).toMatchObject({ applies: true, score: 30 });
    expect(mode(hybrid)).toMatchObject({ applies: true, score: 60 });
    expect(total(wantsRemote, remote)).toBeGreaterThan(total(wantsRemote, onsite));
    // Without a preference the same two listings are ranked by city alone.
    expect(total(student, onsite)).toBeGreaterThan(total(student, remote));
  });

  it('a minimum stipend counts only for listings that state one', () => {
    const wants15k = { ...student, expectedStipend: '15000' };
    const stipend = (l: any) => service.calculateRecommendationScore(wants15k, l).factors.find(f => f.name === 'Stipend Match')!;
    expect(stipend(listing('ReactJS Development', 'Bengaluru', { stipend: '20,000/month' }))).toMatchObject({ applies: true, score: 100 });
    expect(stipend(listing('ReactJS Development', 'Bengaluru', { stipend: '7,500/month' }))).toMatchObject({ applies: true, score: 50 });
    expect(stipend(listing('ReactJS Development', 'Bengaluru', { stipend: 'Unpaid' }))).toMatchObject({ applies: true, score: 0 });
    const silent = stipend(listing('ReactJS Development', 'Bengaluru'));
    expect(silent.applies).toBe(false);
    expect(silent.details).toMatch(/does not state a stipend/);
    // A listing that pays less than asked ranks below one that says nothing.
    expect(total(wants15k, listing('ReactJS Development', 'Bengaluru', { stipend: '7,500/month' })))
      .toBeLessThan(total(wants15k, listing('ReactJS Development', 'Bengaluru')));
  });

  it('an empty profile gets a neutral 50 and is told what to add', () => {
    const empty: any = { id: 'e', name: 'E', email: 'e@example.com', skills: [], profileCompletion: 0 };
    const score = service.calculateRecommendationScore(empty, listing('ReactJS Development', 'Bengaluru'));
    expect(score.totalScore).toBe(50);
    expect(score.explanation).toMatch(/Add your skills and a location/);
  });

  it('describes a poor match as weak, not moderate', () => {
    expect(service.calculateRecommendationScore(student, listing('Human Resources (HR)', 'Chennai')).explanation).toMatch(/is a weak match/);
  });
});
