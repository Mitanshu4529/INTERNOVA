// Single entry point for data access. Each call is routed to exactly one
// backend, chosen by the current session (see ./mode):
//
//   signed-in account -> ./liveApi  (Supabase, authorised by row level security)
//   demo session      -> ./demoApi  (this browser's localStorage only)
//
// There is deliberately no "try the database, fall back to localStorage" path.
// That pattern used to report success for writes that never left the browser.

import * as live from './liveApi';
import * as demo from './demoApi';
import { getStoredUser, isDemoMode, storeUser, type SessionUser } from './mode';

export { DEMO_COMPANIES } from './demoApi';
export type { SessionUser } from './mode';

/* ============================================================
   SESSION
============================================================ */

export type AuthResult =
  | { success: true; user: SessionUser; needsEmailConfirmation?: false }
  | { success: true; needsEmailConfirmation: true; message: string; user?: undefined }
  | { success: false; error: string };

/** Sign in (no `name`) or sign up (with `name`) with a real account. */
export async function login(email: string, password: string, name?: string, userType?: string, companyName?: string): Promise<AuthResult> {
  if (name) {
    const result = await live.signUp({
      email,
      password,
      name,
      type: userType === 'company' ? 'company' : 'user',
      company: companyName,
    });
    if (result.success && 'user' in result && result.user) storeUser(result.user);
    return result as AuthResult;
  }
  const result = await live.signIn(email, password);
  if (result.success) storeUser(result.user);
  return result as AuthResult;
}

/** Enter the browser-only demo. No password, no database writes. */
export function startDemo(type: 'user' | 'company', companySlug?: string): AuthResult {
  const user = demo.createDemoUser(type, companySlug);
  demo.resetDemoCache();
  storeUser(user);
  return { success: true, user };
}

export async function logout() {
  const wasDemo = isDemoMode();
  storeUser(null);
  if (!wasDemo) await live.signOut();
}

/**
 * Called once on startup. A demo session is restored from this tab's storage;
 * a real session is only trusted if Supabase still has a valid session for it.
 */
export async function restoreSession(): Promise<SessionUser | null> {
  const stored = getStoredUser();
  if (stored?.isDemo) return stored;

  const user = await live.restoreSession();
  storeUser(user);
  return user;
}

export const onSignedOut = live.onSignedOut;

export async function updateUserProfile(userId: string, profile: any) {
  const result = isDemoMode() ? await demo.updateUserProfile(userId, profile) : await live.updateUserProfile(userId, profile);
  // Keep the stored session copy in step so a refresh shows the saved profile.
  const stored = getStoredUser();
  if (stored && stored.id === userId) storeUser({ ...stored, profile: { ...(stored.profile || {}), ...profile } });
  return result;
}

/* ============================================================
   DATA (same function in both backends)
============================================================ */

const backend = () => (isDemoMode() ? demo : live);
const companyName = () => {
  const user = getStoredUser();
  return user?.profile?.company || user?.name || '';
};

export const getInternships = () => backend().getInternships();
export const getInternshipsByCompany = (companyId: string) =>
  isDemoMode() ? demo.getInternshipsByCompany(companyId, companyName()) : live.getInternshipsByCompany(companyId);
export const createInternship = (data: any) => backend().createInternship(data);
export const updateInternship = (id: string, updates: any) => backend().updateInternship(id, updates);
export const deleteInternship = (id: string) => backend().deleteInternship(id);

export const getSavedInternships = (studentId: string) => backend().getSavedInternships(studentId);
export const saveInternship = (studentId: string, internshipId: string) => backend().saveInternship(studentId, internshipId);
export const unsaveInternship = (studentId: string, internshipId: string) => backend().unsaveInternship(studentId, internshipId);

export const applyToInternship = (body: { studentId: string; internshipId: string; companyId?: string | null; studentProfile: any; studentDetails: any }) =>
  backend().applyToInternship(body);
export const getApplicationsByStudent = (studentId: string) => backend().getApplicationsByStudent(studentId);
export const getApplicationsByCompany = (companyId: string) =>
  isDemoMode() ? demo.getApplicationsByCompany(companyId, companyName()) : live.getApplicationsByCompany(companyId);
export const getAllApplications = () => backend().getAllApplications();
export const updateApplicationStatus = (applicationId: string, status: 'Applied' | 'Under Review' | 'Rejected' | 'Accepted') =>
  backend().updateApplicationStatus(applicationId, status);

export const sendMessage = (payload: { from: string; to: string; subject: string; content: string; type?: string; internshipId?: string }) =>
  backend().sendMessage(payload);
export const getMessagesForUser = (email: string) => backend().getMessagesForUser(email);
export const markMessageAsRead = (messageId: string) => backend().markMessageAsRead(messageId);
export const getUnreadCount = (userEmail: string) => backend().getUnreadCount(userEmail);
