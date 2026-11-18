// Real-account backend: Supabase only.
//
// Every function either returns data from the database or throws an Error with
// a message that can be shown to the user. There is no localStorage fallback
// here: if a write did not reach the database, the caller must be told.

import { supabase } from './supabaseClient';
import { normalizeWorkMode } from './dataNormalizer';
import { inferListingSkills } from './listingSkills';
import type { SessionUser } from './mode';

const PAGE_SIZE = 1000;
// Upper bound on listings loaded into the browser for scoring. The whole
// catalogue (about 8,000 rows) is loaded so that the best matches can be found
// wherever they sit; move filtering to the server if it outgrows this.
const MAX_INTERNSHIPS = 12000;

function fail(action: string, error: { message?: string; code?: string } | null): never {
  const detail = error?.message || 'Unknown error';
  console.error(`${action} failed:`, error);
  throw new Error(`${action} failed: ${detail}`);
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error('You are signed out. Please sign in again.');
  return id;
}

/**
 * The listings table has no work-mode column: the mode shown to students is
 * read from the location text ("Work from home", "Pune (Hybrid)"). So when a
 * company picks Remote or Hybrid and the location does not already say so, the
 * choice is added to the location; otherwise it would be lost on save.
 */
export function locationWithWorkMode(location: unknown, type: unknown): string | null {
  const place = typeof location === 'string' ? location.trim() : '';
  if (type !== 'Remote' && type !== 'Hybrid') return place || null;
  if (!place) return type;
  return normalizeWorkMode(place) === type ? place : `${place} (${type})`;
}

const isUrl = (value: unknown) => typeof value === 'string' && /^https?:\/\//i.test(value.trim());

/**
 * About 40% of the imported catalogue was loaded with its columns shifted:
 *
 *   company     holds the apply link        (should be the company name)
 *   location    holds the company name      (should be the city)
 *   description holds the city              (should be a description)
 *   duration    holds a logo image link     (should be the duration)
 *   stipend     holds "Actively hiring"     (not a stipend)
 *
 * Those rows are recognisable by the links, and are put back in order here so
 * the app shows and matches them correctly. Rows that are already in order
 * pass through unchanged.
 */
export function repairShiftedRow(row: any) {
  if (!row || !isUrl(row.company) || !isUrl(row.duration)) return row;
  return {
    ...row,
    company: row.location,
    location: row.description,
    description: null,
    duration: null,
    stipend: /actively hiring/i.test(row.stipend || '') ? null : row.stipend,
    source: row.source || row.company,
  };
}

export function mapInternship(rawRow: any) {
  const row = repairShiftedRow(rawRow);
  const skills: string[] = Array.isArray(row.skills) ? row.skills.filter((s: unknown) => typeof s === 'string' && s.trim()) : [];
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    stipend: row.stipend,
    stipendAmount: row.stipendamount,
    duration: row.duration,
    description: row.description,
    skills,
    // Only when the listing states no skills: likely skills from the title.
    inferredSkills: skills.length === 0 ? inferListingSkills(row.title, row.description) : undefined,
    source: row.source,
    posted: row.posted,
    createdAt: row.created_at,
    companyId: row.company_id || undefined,
    // The table has no work-mode column; derive it from the location text
    // instead of labelling every listing "Remote".
    type: normalizeWorkMode(row.location),
    status: 'Active' as const,
  };
}

function mapApplication(row: any) {
  return {
    id: row.id,
    studentId: row.student_id,
    internshipId: row.internship_id,
    companyId: row.company_id,
    status: row.status,
    studentProfile: row.student_profile || {},
    studentDetails: row.student_details || {},
    appliedAt: row.applied_at,
  };
}

function mapMessage(row: any) {
  return {
    id: row.id,
    from: row.sender,
    to: row.recipient,
    subject: row.subject,
    content: row.content,
    type: row.type,
    internshipId: row.internship_id,
    timestamp: row.timestamp,
    read: !!row.read,
  };
}

/* ============================================================
   AUTH
============================================================ */

async function loadProfile(authUser: { id: string; email?: string | null; user_metadata?: any }): Promise<SessionUser> {
  // The role and profile come from the server-side `users` row, which the
  // client cannot change the role of. Sign-up metadata is only a fallback for
  // the moment before that row is readable.
  const { data: row } = await supabase.from('users').select('name, type, profile').eq('id', authUser.id).maybeSingle();
  const meta = authUser.user_metadata || {};
  const email = (authUser.email || '').toLowerCase();
  return {
    id: authUser.id,
    email,
    name: row?.name || meta.name || email.split('@')[0],
    type: row?.type === 'company' || (!row && meta.type === 'company') ? 'company' : 'user',
    profile: row?.profile || (meta.company ? { company: meta.company } : {}),
    isDemo: false,
  };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) {
    const message = /confirm/i.test(error?.message || '')
      ? 'Please confirm your email address first. Check your inbox for the confirmation link.'
      : error?.message || 'Sign in failed';
    return { success: false as const, error: message };
  }
  return { success: true as const, user: await loadProfile(data.user) };
}

export async function signUp(input: { email: string; password: string; name: string; type: 'user' | 'company'; company?: string }) {
  if (input.password.length < 8) {
    return { success: false as const, error: 'Password must be at least 8 characters long.' };
  }
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      // Read by the database trigger that creates the profile row.
      data: {
        name: input.name.trim().slice(0, 120),
        type: input.type,
        company: input.type === 'company' ? (input.company || '').trim().slice(0, 200) : undefined,
      },
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  if (error) return { success: false as const, error: error.message };

  // With "Confirm email" enabled there is no session until the link is clicked.
  if (!data.session || !data.user) {
    return {
      success: true as const,
      needsEmailConfirmation: true as const,
      message: `We sent a confirmation link to ${input.email.trim().toLowerCase()}. Open it, then sign in.`,
    };
  }
  return { success: true as const, user: { ...(await loadProfile(data.user)), isNewUser: true } };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Sign-out failed:', error);
}

/** Returns the signed-in user if a valid Supabase session exists, otherwise null. */
export async function restoreSession(): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;
  return loadProfile(data.session.user);
}

export function onSignedOut(callback: () => void) {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') callback();
  });
  return () => data.subscription.unsubscribe();
}

export async function updateUserProfile(userId: string, profile: any) {
  const { error } = await supabase.from('users').update({ profile }).eq('id', userId);
  if (error) fail('Saving your profile', error);
  return { success: true };
}

/* ============================================================
   INTERNSHIPS
============================================================ */

/** Reads the public catalogue (read-only; needs no account). */
export async function getInternships() {
  const rows: any[] = [];
  for (let from = 0; from < MAX_INTERNSHIPS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('internships')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) fail('Loading internships', error);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows.map(mapInternship);
}

export async function getInternshipsByCompany(companyId: string) {
  // Ownership is the account id on the row, never a company-name match.
  const { data, error } = await supabase
    .from('internships')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) fail('Loading your internships', error);
  return (data || []).map(mapInternship);
}

export async function createInternship(input: any) {
  const companyId = await currentUserId();
  const stipendAmount = Number.isFinite(Number(input.stipendAmount)) ? Math.round(Number(input.stipendAmount)) : null;
  const { data, error } = await supabase
    .from('internships')
    .insert({
      company_id: companyId,
      title: String(input.title || '').trim(),
      company: String(input.company || '').trim(),
      location: locationWithWorkMode(input.location, input.type),
      skills: Array.isArray(input.skills) ? input.skills : [],
      duration: input.duration || null,
      stipend: input.stipend || null,
      stipendamount: stipendAmount,
      description: input.description || null,
      source: input.source || 'Internova',
      posted: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) fail('Posting the internship', error);
  return mapInternship(data);
}

export async function updateInternship(id: string, updates: any) {
  // Only real columns are sent; the form's camelCase fields are mapped.
  const patch: Record<string, unknown> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.location !== undefined) patch.location = locationWithWorkMode(updates.location, updates.type);
  if (updates.duration !== undefined) patch.duration = updates.duration;
  if (updates.stipend !== undefined) patch.stipend = updates.stipend;
  if (updates.stipendAmount !== undefined) {
    patch.stipendamount = Number.isFinite(Number(updates.stipendAmount)) ? Math.round(Number(updates.stipendAmount)) : null;
  }
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.skills !== undefined) patch.skills = updates.skills;
  if (Object.keys(patch).length === 0) return true;

  const { data, error } = await supabase.from('internships').update(patch).eq('id', id).select('id');
  if (error) fail('Updating the internship', error);
  if (!data || data.length === 0) throw new Error('Updating the internship failed: it does not exist or is not yours.');
  return true;
}

export async function deleteInternship(id: string) {
  const { data, error } = await supabase.from('internships').delete().eq('id', id).select('id');
  if (error) fail('Deleting the internship', error);
  if (!data || data.length === 0) throw new Error('Deleting the internship failed: it does not exist or is not yours.');
  return true;
}

/* ============================================================
   SAVED INTERNSHIPS
============================================================ */

export async function getSavedInternships(studentId: string) {
  const { data, error } = await supabase.from('saved_internships').select('internship_id').eq('student_id', studentId);
  if (error) fail('Loading saved internships', error);
  return (data || []).map((d: any) => d.internship_id as string);
}

export async function saveInternship(studentId: string, internshipId: string) {
  const { error } = await supabase.from('saved_internships').insert({ student_id: studentId, internship_id: internshipId });
  // 23505 = already saved, which is the state the user asked for.
  if (error && error.code !== '23505') fail('Saving the internship', error);
}

export async function unsaveInternship(studentId: string, internshipId: string) {
  const { error } = await supabase
    .from('saved_internships')
    .delete()
    .match({ student_id: studentId, internship_id: internshipId });
  if (error) fail('Removing the saved internship', error);
}

/* ============================================================
   APPLICATIONS
============================================================ */

export async function applyToInternship(body: { studentId: string; internshipId: string; companyId?: string | null; studentProfile: any; studentDetails: any }) {
  // The profile snapshot goes into a JSON column; an embedded photo (a data
  // URL of several hundred KB) is left out of it.
  const { photo: _photo, ...profileSnapshot } = body.studentProfile || {};
  const { data, error } = await supabase
    .from('applications')
    .insert({
      student_id: body.studentId,
      internship_id: body.internshipId,
      company_id: body.companyId || null,
      student_profile: profileSnapshot,
      student_details: body.studentDetails || {},
      status: 'Applied',
    })
    .select()
    .single();
  if (error?.code === '23505') throw new Error('You have already applied to this internship.');
  if (error) fail('Submitting your application', error);
  return mapApplication(data);
}

export async function getApplicationsByStudent(studentId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('student_id', studentId)
    .order('applied_at', { ascending: false });
  if (error) fail('Loading your applications', error);
  return (data || []).map(mapApplication);
}

export async function getApplicationsByCompany(companyId: string) {
  const { data: own, error: ownError } = await supabase.from('internships').select('id').eq('company_id', companyId);
  if (ownError) fail('Loading your internships', ownError);
  const ids = (own || []).map((r: any) => r.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .in('internship_id', ids)
    .order('applied_at', { ascending: false });
  if (error) fail('Loading applications', error);
  return (data || []).map(mapApplication);
}

/** Applications visible to the signed-in user (row level security decides which). */
export async function getAllApplications() {
  const { data, error } = await supabase.from('applications').select('*');
  if (error) fail('Loading applications', error);
  return (data || []).map(mapApplication);
}

export async function updateApplicationStatus(applicationId: string, status: 'Applied' | 'Under Review' | 'Rejected' | 'Accepted') {
  const { data, error } = await supabase.from('applications').update({ status }).eq('id', applicationId).select();
  if (error) fail('Updating the application', error);
  if (!data || data.length === 0) throw new Error('Updating the application failed: it does not exist or is not yours.');
  return mapApplication(data[0]);
}

/* ============================================================
   MESSAGES  (addressed by email: columns `sender` and `recipient`)
============================================================ */

export async function sendMessage(payload: { from: string; to: string; subject: string; content: string; type?: string; internshipId?: string }) {
  const { error } = await supabase.from('messages').insert({
    sender: payload.from.trim().toLowerCase(),
    recipient: payload.to.trim().toLowerCase(),
    subject: payload.subject,
    content: payload.content,
    type: payload.type || 'message',
    internship_id: payload.internshipId || null,
  });
  if (error) fail('Sending the message', error);
}

export async function getMessagesForUser(_email: string) {
  // Row level security already limits this to messages the user sent or received.
  const { data, error } = await supabase.from('messages').select('*').order('timestamp', { ascending: false }).limit(500);
  if (error) fail('Loading messages', error);
  return (data || []).map(mapMessage);
}

export async function markMessageAsRead(messageId: string) {
  const { error } = await supabase.from('messages').update({ read: true }).eq('id', messageId);
  if (error) fail('Marking the message as read', error);
}

export async function getUnreadCount(userEmail: string) {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient', userEmail.trim().toLowerCase())
    .eq('read', false);
  if (error) fail('Counting unread messages', error);
  return { count: count || 0 };
}
