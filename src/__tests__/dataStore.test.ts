import { describe, it, expect, beforeEach, vi } from 'vitest';
import dataStore from '../data/dataStore';
import { getStoredUser, isDemoMode } from '../utils/mode';
import { extractSkillsByKeyword, parseResumeWithAI } from '../utils/resumeParser';
import { supabaseMock } from './setup';

const STUDENT = { id: '00000000-0000-0000-0000-00000000000a', email: 'alice@example.com' };
const COMPANY = { id: '00000000-0000-0000-0000-00000000000c', email: 'hr@acme.example' };

const internshipRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'i-1', title: 'Frontend Intern', company: 'Acme Corp', location: 'Remote', stipend: '₹20,000 / month',
  stipendamount: 20000, duration: '3 months', description: 'Build UI', skills: ['React'], source: 'Internova',
  posted: '2026-11-01', created_at: '2026-11-01T00:00:00Z', company_id: COMPANY.id, ...overrides,
});

/** Signs in a real (mocked Supabase) account and returns the session user. */
async function signInAs(account: { id: string; email: string }, type: 'user' | 'company', profile: Record<string, unknown> = {}) {
  supabaseMock.auth.signIn = async () => {
    supabaseMock.auth.session = { user: { id: account.id, email: account.email, user_metadata: {} } };
    return { data: { user: supabaseMock.auth.session.user, session: supabaseMock.auth.session }, error: null };
  };
  supabaseMock.onQuery = ({ table }) =>
    table === 'users' ? { data: { name: 'Test User', type, profile }, error: null } : undefined;
  const result = await dataStore.loginOrRegister(account.email, 'correct horse battery');
  supabaseMock.onQuery = null;
  supabaseMock.queries = [];
  return result;
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  supabaseMock.reset();
  await dataStore.logout();
  supabaseMock.reset();
});

describe('real accounts: authentication', () => {
  it('signs in through Supabase and takes the account type from the server', async () => {
    const result = await signInAs(COMPANY, 'company', { company: 'Acme Corp' });
    expect(result.success).toBe(true);
    expect(result.success && 'user' in result && result.user).toMatchObject({
      id: COMPANY.id, email: COMPANY.email, type: 'company', isDemo: false, profile: { company: 'Acme Corp' },
    });
    expect(isDemoMode()).toBe(false);
  });

  it('rejects wrong credentials and stores nothing', async () => {
    const result = await dataStore.loginOrRegister('alice@example.com', 'wrong');
    expect(result).toEqual({ success: false, error: 'Invalid login credentials' });
    expect(getStoredUser()).toBeNull();
  });

  it('never keeps a password in browser storage', async () => {
    await signInAs(STUDENT, 'user');
    const everything = JSON.stringify({ ...localStorage, ...sessionStorage }) +
      Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i)!)).join('') +
      Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.getItem(sessionStorage.key(i)!)).join('');
    expect(everything).not.toContain('correct horse battery');
    expect(localStorage.getItem('local_users')).toBeNull();
  });

  it('sign-up sends name and type as metadata and waits for email confirmation', async () => {
    let received: any;
    supabaseMock.auth.signUp = async (input) => {
      received = input;
      return { data: { user: { id: 'new' }, session: null }, error: null };
    };
    const result = await dataStore.loginOrRegister('New@Example.com ', 'long-enough-password', 'New Person', 'company', 'New Co');
    expect(received.email).toBe('new@example.com');
    expect(received.options.data).toEqual({ name: 'New Person', type: 'company', company: 'New Co' });
    expect(result).toMatchObject({ success: true, needsEmailConfirmation: true });
    // Not signed in until the emailed link is opened.
    expect(getStoredUser()).toBeNull();
  });

  it('sign-up rejects short passwords before contacting the server', async () => {
    let called = false;
    supabaseMock.auth.signUp = async () => { called = true; return { data: {}, error: null }; };
    const result = await dataStore.loginOrRegister('a@example.com', 'short', 'A', 'user');
    expect(result.success).toBe(false);
    expect(called).toBe(false);
  });

  it('restores a session only when Supabase still has one', async () => {
    await signInAs(STUDENT, 'user');
    supabaseMock.onQuery = ({ table }) => (table === 'users' ? { data: { name: 'Alice', type: 'user', profile: {} }, error: null } : undefined);
    expect(await dataStore.restoreSession()).toMatchObject({ id: STUDENT.id, type: 'user' });

    // The Supabase session is gone (expired / signed out elsewhere): a leftover
    // copy of the user in this tab must not be trusted.
    supabaseMock.auth.session = null;
    expect(await dataStore.restoreSession()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('logout ends the Supabase session and clears the stored user', async () => {
    await signInAs(STUDENT, 'user');
    await dataStore.logout();
    expect(supabaseMock.auth.signOutCalls).toBe(1);
    expect(getStoredUser()).toBeNull();
  });
});

describe('real accounts: data goes to the database or fails loudly', () => {
  it('a rejected application is reported, not kept locally as a success', async () => {
    await signInAs(STUDENT, 'user');
    supabaseMock.onQuery = () => ({ data: null, error: { message: 'new row violates row-level security policy', code: '42501' } });

    await expect(
      dataStore.applyToInternship(STUDENT.id, 'i-1', { skills: ['React'] }, { name: 'Alice', email: STUDENT.email })
    ).rejects.toThrow(/Submitting your application failed/);

    expect(localStorage.getItem('demo_applications')).toBeNull();
  });

  it('applies with the listing owner as company_id and without the profile photo', async () => {
    await signInAs(STUDENT, 'user');
    supabaseMock.onQuery = ({ table, method }) => {
      if (table === 'internships') return { data: [internshipRow()], error: null };
      if (table === 'applications' && method === 'insert') {
        return { data: { id: 'app-1', student_id: STUDENT.id, internship_id: 'i-1', company_id: COMPANY.id, status: 'Applied', student_profile: {}, student_details: {} }, error: null };
      }
      return undefined;
    };
    await dataStore.getInternships(true);
    const application = await dataStore.applyToInternship(
      STUDENT.id, 'i-1', { skills: ['React'], photo: 'data:image/png;base64,AAAA' }, { name: 'Alice', email: STUDENT.email }
    );
    expect(application).toMatchObject({ id: 'app-1', status: 'Applied', companyId: COMPANY.id });

    const insert = supabaseMock.queries.find(q => q.table === 'applications' && q.method === 'insert')!;
    expect(insert.args[0]).toMatchObject({ student_id: STUDENT.id, internship_id: 'i-1', company_id: COMPANY.id, status: 'Applied' });
    expect((insert.args[0] as any).student_profile).toEqual({ skills: ['React'] });
  });

  it('a duplicate application gets a clear message', async () => {
    await signInAs(STUDENT, 'user');
    supabaseMock.onQuery = () => ({ data: null, error: { message: 'duplicate key', code: '23505' } });
    await expect(dataStore.applyToInternship(STUDENT.id, 'i-1', {}, { name: 'A', email: STUDENT.email }))
      .rejects.toThrow('You have already applied to this internship.');
  });

  it('messages use the real column names and lower-cased addresses', async () => {
    await signInAs(COMPANY, 'company');
    supabaseMock.onQuery = () => ({ data: null, error: null });
    await dataStore.sendMessage('HR@Acme.example', 'Alice@Example.com', 'Hello', 'Welcome', 'acceptance', 'i-1');
    const insert = supabaseMock.queries.find(q => q.table === 'messages' && q.method === 'insert')!;
    expect(insert.args[0]).toEqual({
      sender: 'hr@acme.example', recipient: 'alice@example.com', subject: 'Hello', content: 'Welcome', type: 'acceptance', internship_id: 'i-1',
    });
  });

  it('a failed message is an error for the caller', async () => {
    await signInAs(COMPANY, 'company');
    supabaseMock.onQuery = () => ({ data: null, error: { message: 'permission denied for table messages' } });
    await expect(dataStore.sendMessage(COMPANY.email, STUDENT.email, 's', 'c')).rejects.toThrow(/Sending the message failed/);
    expect(localStorage.getItem('demo_messages')).toBeNull();
  });

  it("company listings are selected by the account id, never by company name", async () => {
    await signInAs(COMPANY, 'company', { company: 'a' });
    supabaseMock.onQuery = ({ table }) => (table === 'internships' ? { data: [internshipRow()], error: null } : undefined);
    const mine = await dataStore.getInternshipsByCompany(COMPANY.id);
    expect(mine).toHaveLength(1);
    const query = supabaseMock.queries.find(q => q.table === 'internships')!;
    expect(query.calls).toContainEqual({ method: 'eq', args: ['company_id', COMPANY.id] });
    expect(query.calls.some(c => c.args.includes('company'))).toBe(false);
  });

  it('posting a listing sets the owner from the session and maps form fields to real columns', async () => {
    await signInAs(COMPANY, 'company', { company: 'Acme Corp' });
    supabaseMock.onQuery = ({ method }) => (method === 'insert' ? { data: internshipRow({ id: 'i-9' }), error: null } : undefined);
    const created = await dataStore.createInternship('someone-else', {
      title: 'Backend Intern', company: 'Acme Corp', location: 'Pune', stipendAmount: 15000, skills: ['Node.js'], type: 'On-site',
    });
    expect(created.id).toBe('i-9');
    const payload = supabaseMock.queries.find(q => q.method === 'insert')!.args[0] as any;
    expect(payload.company_id).toBe(COMPANY.id);          // not the id passed by the caller
    expect(payload.stipendamount).toBe(15000);
    expect(payload).not.toHaveProperty('type');           // no such column
    expect(payload).not.toHaveProperty('stipendAmount');
  });

  it('editing a listing that is not yours is reported as a failure', async () => {
    await signInAs(COMPANY, 'company');
    supabaseMock.onQuery = () => ({ data: [], error: null });   // RLS matched no row
    await expect(dataStore.updateInternship('i-1', { title: 'Hijacked' })).rejects.toThrow(/not yours/);
  });

  it('work mode is derived from the listing instead of always "Remote"', async () => {
    await signInAs(STUDENT, 'user');
    supabaseMock.onQuery = () => ({ data: [internshipRow({ id: 'a', location: 'Work from home' }), internshipRow({ id: 'b', location: 'Pune' })], error: null });
    const listings = await dataStore.getInternships(true);
    expect(listings.find(l => l.id === 'a')?.type).toBe('Remote');
    expect(listings.find(l => l.id === 'b')?.type).toBe('On-site');
  });

  it('a failed profile save is an error', async () => {
    await signInAs(STUDENT, 'user');
    supabaseMock.onQuery = () => ({ data: null, error: { message: 'permission denied' } });
    await expect(dataStore.updateUserProfile(STUDENT.id, { bio: 'x' })).rejects.toThrow(/Saving your profile failed/);
  });
});

describe('demo mode: browser only', () => {
  const writes = () => supabaseMock.queries.filter(q => ['insert', 'update', 'delete', 'upsert'].includes(q.method));

  it('starts without a password and is flagged as a demo', () => {
    const result = dataStore.startDemo('company', 'crisil');
    expect(result.success && result.user).toMatchObject({ type: 'company', name: 'Crisil', isDemo: true, profile: { company: 'Crisil' } });
    expect(isDemoMode()).toBe(true);
    expect(JSON.stringify(getStoredUser())).not.toMatch(/password/i);
  });

  it('a demo session is restored without asking Supabase for a session', async () => {
    dataStore.startDemo('user');
    expect(await dataStore.restoreSession()).toMatchObject({ id: 'demo_student', isDemo: true });
  });

  it('full student flow works and never writes to the database', async () => {
    const student = dataStore.startDemo('user');
    const id = student.success && student.user ? student.user.id : '';

    await dataStore.saveInternship(id, 'i-1');
    expect(await dataStore.getSavedInternships(id)).toEqual(['i-1']);
    await dataStore.unsaveInternship(id, 'i-1');
    expect(await dataStore.getSavedInternships(id)).toEqual([]);

    const application = await dataStore.applyToInternship(id, 'i-1', { skills: ['React'] }, { name: 'Demo', email: 'student@demo.internova' });
    expect(application.status).toBe('Applied');
    await expect(dataStore.applyToInternship(id, 'i-1', {}, { name: 'Demo', email: 'x' })).rejects.toThrow(/already applied/);
    expect(await dataStore.getApplicationsByStudent(id)).toHaveLength(1);

    await dataStore.updateUserProfile(id, { bio: 'hello' });
    expect(getStoredUser()?.profile).toMatchObject({ bio: 'hello' });

    expect(writes()).toEqual([]);
  });

  it('full company flow works and never writes to the database', async () => {
    const company = dataStore.startDemo('company', 'volopay');
    const id = company.success && company.user ? company.user.id : '';

    const created = await dataStore.createInternship(id, { title: 'Demo Intern', company: 'Volopay', location: 'Remote', skills: ['SQL'] });
    expect((await dataStore.getInternshipsByCompany(id)).map(i => i.id)).toContain(created.id);

    // A demo student applies in the same browser; the company sees and accepts it.
    dataStore.startDemo('user');
    const application = await dataStore.applyToInternship('demo_student', created.id, {}, { name: 'Demo', email: 'student@demo.internova' });
    dataStore.startDemo('company', 'volopay');
    expect((await dataStore.getApplicationsByCompany(id)).map(a => a.id)).toEqual([application.id]);
    expect((await dataStore.updateApplicationStatus(application.id, 'Accepted')).status).toBe('Accepted');

    await dataStore.sendMessage('volopay@demo.internova', 'student@demo.internova', 'Hi', 'Welcome', 'acceptance', created.id);
    expect(await dataStore.getUnreadCount('student@demo.internova')).toBe(1);

    await dataStore.deleteInternship(created.id);
    expect((await dataStore.getInternshipsByCompany(id)).map(i => i.id)).not.toContain(created.id);

    expect(writes()).toEqual([]);
  });

  it('a demo company only owns listings with exactly its name', async () => {
    supabaseMock.onQuery = ({ table }) => (table === 'internships'
      ? { data: [internshipRow({ id: 'x', company: 'Volopay', company_id: null }), internshipRow({ id: 'y', company: 'Volopay Partners', company_id: null }), internshipRow({ id: 'z', company: '', company_id: null })], error: null }
      : undefined);
    dataStore.startDemo('company', 'volopay');
    const mine = await dataStore.getInternshipsByCompany('demo_company_volopay');
    expect(mine.map(i => i.id)).toEqual(['x']);
  });

  it('leaving the demo does not sign out of Supabase and clears the session', async () => {
    dataStore.startDemo('user');
    await dataStore.logout();
    expect(supabaseMock.auth.signOutCalls).toBe(0);
    expect(getStoredUser()).toBeNull();
  });

  it('removes the old plain-text account store if it is still in the browser', async () => {
    localStorage.setItem('local_users', JSON.stringify({ 'a@b.c': { password: 'hunter2' } }));
    vi.resetModules();
    await import('../utils/demoApi');
    expect(localStorage.getItem('local_users')).toBeNull();
  });
});

describe('resume skills', () => {
  it('matches whole terms only', () => {
    const found = extractSkillsByKeyword('Worked at Google on digital excellence. Email me. Used JavaScript and Git daily.');
    expect(found).toContain('JavaScript');
    expect(found).toContain('Git');
    expect(found).not.toContain('Go');
    expect(found).not.toContain('Java');
  });

  it('returns nothing when no skills are found, instead of inventing some', async () => {
    dataStore.startDemo('user');
    expect(await parseResumeWithAI('I enjoy long walks on the beach.')).toEqual([]);
  });

  it('the demo never calls the paid AI function', async () => {
    dataStore.startDemo('user');
    await parseResumeWithAI('Python and React developer');
    expect(supabaseMock.functionsInvoked).toEqual([]);
  });

  it('a signed-in user gets AI skills, validated as short strings', async () => {
    await signInAs(STUDENT, 'user');
    supabaseMock.onInvoke = () => ({ data: { skills: ['Rust', 'rust', 42, '', 'x'.repeat(200)] }, error: null });
    const skills = await parseResumeWithAI('resume text');
    expect(skills).toEqual(['Rust', 'x'.repeat(60)]);
    expect(supabaseMock.functionsInvoked[0].name).toBe('parse-resume');
  });
});
