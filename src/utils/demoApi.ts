// Demo backend: everything the user does is kept in this browser's
// localStorage and is never sent to the database. The only network call is a
// read of the public internship catalogue, so the demo has real listings.
//
// Demo accounts have no password. Entering the demo is an explicit choice on
// the sign-in page, and the app shows a banner for as long as it is active.

import { getInternships as loadPublicCatalogue } from './liveApi';
import type { SessionUser } from './mode';

const KEYS = {
  internships: 'demo_internships',
  applications: 'demo_applications',
  saved: 'demo_saved_internships',
  messages: 'demo_messages',
  profiles: 'demo_profiles',
};

// Earlier versions stored every account, including its password in plain text,
// under this key. It is no longer used; remove what is left of it.
try {
  localStorage.removeItem('local_users');
} catch {
  // Storage unavailable: nothing to clean up.
}

function read<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // A full or unavailable store means the demo cannot keep this change.
    throw new Error('Could not save to this browser (storage is full or disabled).');
  }
}

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

/* ============================================================
   DEMO ACCOUNTS
============================================================ */

/** Companies that exist in the public catalogue, so a demo company has listings to manage. */
export const DEMO_COMPANIES: { slug: string; name: string }[] = [
  { slug: 'volopay', name: 'Volopay' },
  { slug: 'doubleticks', name: 'Double Ticks' },
  { slug: 'xiarchbharat', name: 'Xiarch Bharat Pvt. Ltd.' },
  { slug: 'orion', name: 'Orion Educational Society' },
  { slug: 'itlh', name: 'Itlh' },
  { slug: 'ethinos', name: 'Ethinos' },
  { slug: 'landor', name: 'Landor' },
  { slug: 'briskwin', name: 'BriskWin IT (BWIT)' },
  { slug: 'weaddo', name: 'Weaddo' },
  { slug: 'discoverdollar', name: 'Discover Dollar Technologies' },
  { slug: 'getcatalyzed', name: 'Get Catalyzed' },
  { slug: 'brightfuture', name: 'Bright Future' },
  { slug: 'poornatha', name: 'Poornatha' },
  { slug: 'unitedway', name: 'United Way Mumbai' },
  { slug: 'alepo', name: 'Alepo Technologies' },
  { slug: 'forbesadvisor', name: 'Forbes Advisor' },
  { slug: 'conservationaction', name: 'Conservation Action Trust' },
  { slug: 'sarvmai', name: 'SarvM.AI' },
  { slug: 'saksglobal', name: 'Saks Global' },
  { slug: 'crisil', name: 'Crisil' },
];

export function createDemoUser(type: 'user' | 'company', companySlug?: string): SessionUser {
  const profiles = read<Record<string, any>>(KEYS.profiles, {});
  if (type === 'company') {
    const company = DEMO_COMPANIES.find(c => c.slug === companySlug) || DEMO_COMPANIES[0];
    const id = `demo_company_${company.slug}`;
    return {
      id,
      email: `${company.slug}@demo.internova`,
      name: company.name,
      type: 'company',
      profile: { company: company.name, ...(profiles[id] || {}) },
      isDemo: true,
    };
  }
  const id = 'demo_student';
  return {
    id,
    email: 'student@demo.internova',
    name: 'Demo Student',
    type: 'user',
    profile: profiles[id] || {},
    isDemo: true,
  };
}

export async function updateUserProfile(userId: string, profile: any) {
  const profiles = read<Record<string, any>>(KEYS.profiles, {});
  profiles[userId] = { ...(profiles[userId] || {}), ...profile };
  write(KEYS.profiles, profiles);
  return { success: true };
}

/* ============================================================
   INTERNSHIPS
============================================================ */

// Public catalogue (read-only), fetched once per demo session.
let catalogue: any[] | null = null;

/** Forget the cached catalogue, so the next demo session loads a fresh copy. */
export function resetDemoCache() {
  catalogue = null;
}

async function loadCatalogue(): Promise<any[]> {
  if (catalogue) return catalogue;
  try {
    // Same read-only loader as real accounts, so the demo sees the whole catalogue.
    catalogue = await loadPublicCatalogue();
  } catch {
    catalogue = [];
  }
  return catalogue;
}

const localInternships = () => read<any[]>(KEYS.internships, []);

// Demo ownership is by company name, because catalogue listings carry a name
// but not the id of a demo account. Exact match only (ignoring a trailing
// "(…)" suffix): a substring match made a company called "a" own everything.
const companyKey = (name: string | undefined) => (name || '').toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();

export async function getInternships() {
  const deleted = new Set(read<string[]>('demo_deleted_internships', []));
  const local = localInternships();
  const localIds = new Set(local.map(i => i.id));
  const remote = (await loadCatalogue()).filter(i => !localIds.has(i.id));
  return [...local, ...remote].filter(i => !deleted.has(i.id));
}

export async function getInternshipsByCompany(companyId: string, companyName?: string) {
  const key = companyKey(companyName);
  return (await getInternships()).filter(i => i.companyId === companyId || (key && companyKey(i.company) === key));
}

export async function createInternship(input: any) {
  const created = {
    id: newId('demo_int'),
    companyId: input.companyId,
    title: String(input.title || '').trim(),
    company: input.company,
    location: input.location,
    type: input.type || 'Remote',
    skills: Array.isArray(input.skills) ? input.skills : [],
    duration: input.duration,
    stipend: input.stipend,
    stipendAmount: Number.isFinite(Number(input.stipendAmount)) ? Number(input.stipendAmount) : undefined,
    description: input.description,
    source: input.source || 'Internova (demo)',
    posted: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    status: 'Active' as const,
  };
  write(KEYS.internships, [created, ...localInternships()]);
  return created;
}

export async function updateInternship(id: string, updates: any) {
  const local = localInternships();
  const idx = local.findIndex(i => i.id === id);
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...updates };
  } else {
    // Editing a catalogue listing in the demo: keep an edited copy locally.
    const original = (await loadCatalogue()).find(i => i.id === id);
    if (!original) throw new Error('Internship not found.');
    local.unshift({ ...original, ...updates });
  }
  write(KEYS.internships, local);
  return true;
}

export async function deleteInternship(id: string) {
  write(KEYS.internships, localInternships().filter(i => i.id !== id));
  // Catalogue listings cannot be deleted from the database by the demo; hide them locally.
  const deleted = new Set(read<string[]>('demo_deleted_internships', []));
  deleted.add(id);
  write('demo_deleted_internships', [...deleted]);
  return true;
}

/* ============================================================
   SAVED INTERNSHIPS
============================================================ */

export async function getSavedInternships(studentId: string) {
  return read<Record<string, string[]>>(KEYS.saved, {})[studentId] || [];
}

export async function saveInternship(studentId: string, internshipId: string) {
  const all = read<Record<string, string[]>>(KEYS.saved, {});
  const mine = new Set(all[studentId] || []);
  mine.add(internshipId);
  all[studentId] = [...mine];
  write(KEYS.saved, all);
}

export async function unsaveInternship(studentId: string, internshipId: string) {
  const all = read<Record<string, string[]>>(KEYS.saved, {});
  all[studentId] = (all[studentId] || []).filter(id => id !== internshipId);
  write(KEYS.saved, all);
}

/* ============================================================
   APPLICATIONS
============================================================ */

const applications = () => read<any[]>(KEYS.applications, []);

export async function applyToInternship(body: { studentId: string; internshipId: string; companyId?: string | null; studentProfile: any; studentDetails: any }) {
  const all = applications();
  if (all.some(a => a.studentId === body.studentId && a.internshipId === body.internshipId)) {
    throw new Error('You have already applied to this internship.');
  }
  const { photo: _photo, ...profileSnapshot } = body.studentProfile || {};
  const application = {
    id: newId('demo_app'),
    studentId: body.studentId,
    internshipId: body.internshipId,
    companyId: body.companyId || null,
    appliedAt: new Date().toISOString(),
    status: 'Applied' as const,
    studentProfile: profileSnapshot,
    studentDetails: body.studentDetails || {},
  };
  write(KEYS.applications, [...all, application]);
  return application;
}

export async function getApplicationsByStudent(studentId: string) {
  return applications().filter(a => a.studentId === studentId);
}

export async function getApplicationsByCompany(companyId: string, companyName?: string) {
  const ownIds = new Set((await getInternshipsByCompany(companyId, companyName)).map(i => i.id));
  return applications().filter(a => ownIds.has(a.internshipId));
}

export async function getAllApplications() {
  return applications();
}

export async function updateApplicationStatus(applicationId: string, status: 'Applied' | 'Under Review' | 'Rejected' | 'Accepted') {
  const all = applications();
  const app = all.find(a => a.id === applicationId);
  if (!app) throw new Error('Application not found.');
  app.status = status;
  write(KEYS.applications, all);
  return app;
}

/* ============================================================
   MESSAGES
============================================================ */

const messages = () => read<any[]>(KEYS.messages, []);

export async function sendMessage(payload: { from: string; to: string; subject: string; content: string; type?: string; internshipId?: string }) {
  write(KEYS.messages, [
    ...messages(),
    {
      id: newId('demo_msg'),
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      content: payload.content,
      type: payload.type || 'message',
      internshipId: payload.internshipId || null,
      timestamp: new Date().toISOString(),
      read: false,
    },
  ]);
}

export async function getMessagesForUser(email: string) {
  return messages()
    .filter(m => m.to === email || m.from === email)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function markMessageAsRead(messageId: string) {
  const all = messages();
  const message = all.find(m => m.id === messageId);
  if (message) {
    message.read = true;
    write(KEYS.messages, all);
  }
}

export async function getUnreadCount(userEmail: string) {
  return { count: messages().filter(m => m.to === userEmail && !m.read).length };
}

/** Removes everything the demo has stored in this browser. */
export function clearDemoData() {
  for (const key of [...Object.values(KEYS), 'demo_deleted_internships']) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
