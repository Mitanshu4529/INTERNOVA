// src/data/dataStore.ts
// Application-facing data store. It holds a short-lived in-memory cache of the
// internship list and delegates everything else to utils/api, which routes each
// call to the real backend (Supabase) or to the browser-only demo.
//
// Writes are never "optimistically kept" here: if the backend rejects a write
// the error propagates to the caller, which shows it to the user.
import * as api from "../utils/api";

export interface User {
  id: string;
  name: string;
  email: string;
  type: 'user' | 'company';
  profile?: any;
  isNewUser?: boolean;
  /** True for the browser-only demo session. */
  isDemo?: boolean;
}

export interface Company extends User {
  type: "company";
  profile: {
    company: string;
    description?: string;
    website?: string;
    location?: string;
  };
}
export interface Student extends User {
  type: "user";
  profile: {
    university?: string;
    course?: string;
    year?: string;
    cgpa?: string;
    bio?: string;
    location?: string;
    skills?: string[];
    experience?: any[];
    projects?: any[];
    photo?: string | null;
    resume?: File | null;
  };
}


export interface Internship {
  id: string;
  companyId?: string;
  title: string;
  company?: string;
  location?: string;
  type?: 'Remote' | 'On-site' | 'Hybrid';
  duration?: string;
  stipend?: string;
  stipendAmount?: number;
  description?: string;
  skills?: string[];
  /** Likely skills derived from the title, present only when `skills` is empty. */
  inferredSkills?: { explicit: string[]; typical: string[]; domain?: string };
  posted?: string;
  status?: 'Active' | 'Closed';
  requirements?: { cgpa?: number; year?: string[]; experience?: string; };
  createdAt?: Date | string;
  source?: string;
  matchScore?: number;
  acceptanceRate?: number;
  applicants?: number;
}

export interface Application {
  id: string;
  studentId: string;
  internshipId: string;
  companyId?: string | null;
  appliedAt: Date | string;
  status: "Applied" | "Under Review" | "Rejected" | "Accepted";
  studentProfile: Student["profile"];
  studentDetails: {
    name: string;
    email: string;
  };
}

const INTERNSHIPS_TTL_MS = 60_000;

class DataStore {
  private internshipsCache: Internship[] = [];
  private internshipsFetchedAt = 0;
  private internshipsRequest: Promise<Internship[]> | null = null;

  // ---------------- SESSION ----------------
  /** Sign in (no name) or sign up (with name) with a real account. */
  async loginOrRegister(email: string, password: string, name?: string, userType?: 'user'|'company', companyName?: string) {
    try {
      const result = await api.login(email, password, name, userType, companyName);
      if (result.success) this.resetCache();
      return result;
    } catch (err) {
      console.error("loginOrRegister error", err);
      return { success: false as const, error: (err as any)?.message || "Login failed" };
    }
  }

  /** Enter the browser-only demo (no password, nothing is written to the database). */
  startDemo(type: 'user' | 'company', companySlug?: string) {
    const result = api.startDemo(type, companySlug);
    this.resetCache();
    return result;
  }

  async logout() {
    await api.logout();
    this.resetCache();
  }

  restoreSession() {
    return api.restoreSession();
  }

  onSignedOut(callback: () => void) {
    return api.onSignedOut(callback);
  }

  async updateUserProfile(userId: string, profile: any) {
    await api.updateUserProfile(userId, profile);
  }

  private resetCache() {
    this.internshipsCache = [];
    this.internshipsFetchedAt = 0;
    this.internshipsRequest = null;
  }

  // ---------------- INTERNSHIPS ----------------
  async getInternships(force = false): Promise<Internship[]> {
    const fresh = Date.now() - this.internshipsFetchedAt < INTERNSHIPS_TTL_MS;
    if (!force && fresh && this.internshipsFetchedAt > 0) {
      return this.internshipsCache.filter(i => i.status !== 'Closed');
    }
    // Share one request between concurrent callers (the dashboards ask several times on load).
    if (!this.internshipsRequest) {
      this.internshipsRequest = (async () => {
        try {
          const internships = (await api.getInternships()) as Internship[];
          this.internshipsCache = internships.map(i => ({ ...i, skills: i.skills || [] }));
          this.internshipsFetchedAt = Date.now();
          return this.internshipsCache;
        } finally {
          this.internshipsRequest = null;
        }
      })();
    }
    const all = await this.internshipsRequest;
    return all.filter(i => i.status !== 'Closed');
  }

  /** Scoring happens in the browser (services/recommendationService), so this is the full list. */
  async getRecommendedInternships(_userSkills: string[]): Promise<Internship[]> {
    return this.getInternships();
  }

  async getInternshipsByCompany(companyId: string) {
    const internships = (await api.getInternshipsByCompany(companyId)) as Internship[];
    // Keep them findable by id for the company dashboard (titles in messages, applicant lists).
    for (const internship of internships) this.upsertCached(internship);
    return internships;
  }

  private upsertCached(internship: Internship) {
    const idx = this.internshipsCache.findIndex(i => i.id === internship.id);
    if (idx >= 0) this.internshipsCache[idx] = { ...this.internshipsCache[idx], ...internship };
    else this.internshipsCache.unshift(internship);
  }

  // Event notification helpers for cross-dashboard updates within the same tab
  notifyInternshipCreated(internship: Internship) {
    window.dispatchEvent(new CustomEvent('internova:internship-created', { detail: internship }));
  }

  notifyApplicationUpdated(applicationId: string, status: string) {
    window.dispatchEvent(new CustomEvent('internova:application-status-changed', { detail: { applicationId, status } }));
  }

  async createInternship(companyId: string, internshipData: Partial<Internship>) {
    const created = (await api.createInternship({ ...internshipData, companyId })) as Internship;
    this.upsertCached(created);
    this.notifyInternshipCreated(created);
    return created;
  }

  async updateInternship(internshipId: string, updates: Partial<Internship>) {
    await api.updateInternship(internshipId, updates);
    const idx = this.internshipsCache.findIndex(i => i.id === internshipId);
    if (idx !== -1) this.internshipsCache[idx] = { ...this.internshipsCache[idx], ...updates };
    return true;
  }

  async deleteInternship(internshipId: string) {
    await api.deleteInternship(internshipId);
    this.internshipsCache = this.internshipsCache.filter(i => i.id !== internshipId);
  }

  getInternshipById(internshipId: string) {
    return this.internshipsCache.find(i => i.id === internshipId);
  }

  // ---------------- APPLICATIONS ----------------
  async applyToInternship(studentId: string, internshipId: string, studentProfile: Student['profile'], studentDetails: {name:string;email:string}) {
    // The owning company (if the listing has one) is recorded on the application.
    const companyId = this.getInternshipById(internshipId)?.companyId || null;
    return (await api.applyToInternship({ studentId, internshipId, companyId, studentProfile, studentDetails })) as Application;
  }

  async getApplicationsByStudent(studentId: string) {
    return (await api.getApplicationsByStudent(studentId)) as Application[];
  }

  async getApplicationsByCompany(companyId: string) {
    return (await api.getApplicationsByCompany(companyId)) as Application[];
  }

  /** Applications the current user is allowed to see. */
  async getAllApplications() {
    return (await api.getAllApplications()) as Application[];
  }

  async updateApplicationStatus(applicationId: string, status: 'Applied' | 'Under Review' | 'Rejected' | 'Accepted') {
    const updated = (await api.updateApplicationStatus(applicationId, status)) as Application;
    this.notifyApplicationUpdated(applicationId, status);
    return updated;
  }

  // ---------------- SAVED ----------------
  async saveInternship(studentId: string, internshipId: string) {
    await api.saveInternship(studentId, internshipId);
  }

  async unsaveInternship(studentId: string, internshipId: string) {
    await api.unsaveInternship(studentId, internshipId);
  }

  async getSavedInternships(studentId: string) {
    return api.getSavedInternships(studentId);
  }

  // ---------------- MESSAGES ----------------
  async sendMessage(from: string, to: string, subject: string, content: string, type: 'message'|'interview'|'acceptance'|'rejection'='message', internshipId?: string) {
    await api.sendMessage({ from, to, subject, content, type, internshipId });
  }

  async getMessagesForUser(userEmail: string) {
    return api.getMessagesForUser(userEmail);
  }

  async markMessageAsRead(messageId: string) {
    await api.markMessageAsRead(messageId);
  }

  async getUnreadCount(userEmail: string) {
    return (await api.getUnreadCount(userEmail)).count || 0;
  }
}

export const dataStore = new DataStore();
export default dataStore;
