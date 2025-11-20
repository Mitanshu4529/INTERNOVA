// src/datastore.ts
// Global data store wired to your Supabase-backed API
import * as api from "../utils/api";

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  type: 'user' | 'company';
  profile?: any;
  isNewUser?: boolean;
}

interface Message {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  content: string;
  type: "message" | "interview" | "acceptance" | "rejection";
  timestamp: Date | string;
  read: boolean;
  internship_id?: string | null;
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


class DataStore {
  private internshipsCache: Internship[] = [];
  private applicationsCache: Application[] = [];
  private savedCache: Map<string, string[]> = new Map();
  private messagesCache: Map<string, Message[]> = new Map();
  private lastFetch: { [key: string]: number } = {};
  private CACHE_TTL = 30_000; // 30 seconds

  constructor() {
    void this.initializeCache();
    this.loadApplicationsFromStorage();
    this.loadSavedInternshipsFromStorage();
  }

  // Load applications from localStorage on init
  private loadApplicationsFromStorage() {
    try {
      const stored = localStorage.getItem('demo_applications');
      if (stored) {
        this.applicationsCache = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load applications from storage');
    }
  }

  // Save applications to localStorage
  private saveApplicationsToStorage() {
    try {
      localStorage.setItem('demo_applications', JSON.stringify(this.applicationsCache));
    } catch (e) {
      console.warn('Failed to save applications to storage');
    }
  }

  // Load saved internships from localStorage on init
  private loadSavedInternshipsFromStorage() {
    try {
      const stored = localStorage.getItem('demo_saved_internships');
      if (stored) {
        const savedData: Record<string, string[]> = JSON.parse(stored);
        Object.entries(savedData).forEach(([studentId, internshipIds]) => {
          this.savedCache.set(studentId, internshipIds);
        });
      }
    } catch (e) {
      console.warn('Failed to load saved internships from storage');
    }
  }

  // Save saved internships to localStorage
  private saveSavedInternshipsToStorage() {
    try {
      const savedData: Record<string, string[]> = {};
      this.savedCache.forEach((internshipIds, studentId) => {
        savedData[studentId] = internshipIds;
      });
      localStorage.setItem('demo_saved_internships', JSON.stringify(savedData));
    } catch (e) {
      console.warn('Failed to save saved internships to storage');
    }
  }

  private async initializeCache() {
    try {
      await this.getInternships();
    } catch (e) {
      console.error("Failed initializing cache:", e);
    }
  }

  private isCacheValid(key: string) {
    const last = this.lastFetch[key];
    if (!last) return false;
    return Date.now() - last < this.CACHE_TTL;
  }

  // ---------------- USER ----------------
  async loginOrRegister(email: string, password: string, name?: string, userType?: 'user'|'company', companyName?: string) {
    // NOTE: implement api.login in utils/supabase/api.ts (sample below)
    try {
      return await api.login(email, password, name, userType, companyName);
    } catch (err) {
      console.error("loginOrRegister error", err);
      return { success: false, error: (err as any)?.message || "Login failed" };
    }
  }

  async updateUserProfile(userId: string, profile: any) {
    await api.updateUserProfile?.(userId, profile);
  }

  // ---------------- INTERNSHIPS ----------------
  async getInternships(): Promise<Internship[]> {
    // Load from localStorage first (primary source)
    try {
      const localInternships = localStorage.getItem('local_internships');
      if (localInternships) {
        const parsed = JSON.parse(localInternships);
        const formatted = parsed.map((r: any) => ({
          id: r.id,
          title: r.title,
          company: r.company,
          location: r.location,
          stipend: r.stipend,
          stipendAmount: r.stipendamount || r.stipendAmount,
          duration: r.duration,
          description: r.description,
          skills: r.skills || [],
          source: r.source,
          posted: r.posted,
          createdAt: r.created_at || r.createdAt,
          type: r.type || "Remote",
          status: r.status || "Active",
          companyId: r.company_id || r.companyId,
        }));
        // Merge with cache
        const existingIds = new Set(this.internshipsCache.map(i => i.id));
        formatted.forEach((i: Internship) => {
          if (!existingIds.has(i.id)) {
            this.internshipsCache.push(i);
          } else {
            const idx = this.internshipsCache.findIndex(c => c.id === i.id);
            if (idx >= 0) this.internshipsCache[idx] = i;
          }
        });
        console.log('Loaded', formatted.length, 'internships from localStorage');
      }
    } catch (err) {
      console.warn("Error loading local internships:", err);
    }

    // If cache has data, return it immediately (don't wait for API)
    if (this.internshipsCache.length > 0) {
      const result = this.internshipsCache.filter(i => i.status !== 'Closed');
      console.log('Returning', result.length, 'internships from cache');
      return result;
    }

    // prefer cache if valid
    if (this.isCacheValid('internships') && this.internshipsCache.length) {
      return this.internshipsCache.filter(i => i.status !== 'Closed');
    }

    // Try API but don't fail if it errors - this is critical to always return something
    try {
      console.log('Fetching internships from API...');
      const internships = await api.getInternships();
      console.log('API returned', internships?.length || 0, 'internships');
      
      if (internships && internships.length > 0) {
        const formatted = (internships || []).map((r: any) => ({
          ...r,
          skills: r.skills || [],
        }));
        // Clear cache and add new data
        this.internshipsCache = formatted;
        this.lastFetch['internships'] = Date.now();
        
        // Also save to localStorage for future use
        try {
          const toSave = formatted.map((i: Internship) => ({
            id: i.id,
            company_id: i.companyId,
            title: i.title,
            company: i.company,
            location: i.location,
            stipend: i.stipend,
            stipendamount: i.stipendAmount,
            duration: i.duration,
            description: i.description,
            skills: i.skills || [],
            source: i.source || 'Internova',
            posted: i.posted || new Date().toISOString(),
            created_at: i.createdAt || new Date().toISOString(),
            type: i.type || "Remote",
            status: i.status || "Active",
          }));
          localStorage.setItem('local_internships', JSON.stringify(toSave));
          console.log('Saved', toSave.length, 'internships to localStorage');
        } catch (saveErr) {
          console.warn('Failed to save internships to localStorage:', saveErr);
        }
      }
    } catch (err) {
      console.warn("API getInternships failed, using localStorage:", err);
    }
    
    // Always return something, even if empty
    const result = this.internshipsCache.filter(i => i.status !== 'Closed');
    console.log('getInternships returning:', result.length, 'internships');
    return result;
  }

  async getInternshipsByCompany(companyId: string) {
    // Get current user to find their company name for flexible matching
    const currentUser = this.getCurrentUser();
    const companyName = currentUser?.profile?.company || currentUser?.name || '';
    
    // Load from localStorage first
    try {
      const localInternships = localStorage.getItem('local_internships');
      if (localInternships) {
        const parsed = JSON.parse(localInternships);
        const formatted = parsed.map((r: any) => ({
          id: r.id,
          title: r.title,
          company: r.company,
          location: r.location,
          stipend: r.stipend,
          stipendAmount: r.stipendamount || r.stipendAmount,
          duration: r.duration,
          description: r.description,
          skills: r.skills || [],
          source: r.source,
          posted: r.posted,
          createdAt: r.created_at || r.createdAt,
          type: r.type || "Remote",
          status: r.status || "Active",
          companyId: r.company_id || r.companyId,
        }));
        
        // Merge with cache
        const existingIds = new Set(this.internshipsCache.map(i => i.id));
        formatted.forEach((i: Internship) => {
          if (!existingIds.has(i.id)) {
            this.internshipsCache.push(i);
          } else {
            const idx = this.internshipsCache.findIndex(c => c.id === i.id);
            if (idx >= 0) this.internshipsCache[idx] = i;
          }
        });
      }
    } catch (err) {
      console.warn("Error loading local internships in getInternshipsByCompany:", err);
    }
    
    // Try API first, but use cache as fallback
    let apiInternships: Internship[] = [];
    try {
      if (api.getInternshipsByCompany) {
        apiInternships = await api.getInternshipsByCompany(companyId);
        // Merge API results with cache
        const existingIds = new Set(this.internshipsCache.map(i => i.id));
        apiInternships.forEach((i: Internship) => {
          if (!existingIds.has(i.id)) {
            this.internshipsCache.push(i);
          } else {
            const idx = this.internshipsCache.findIndex(c => c.id === i.id);
            if (idx >= 0) this.internshipsCache[idx] = i;
          }
        });
      }
    } catch (err) {
      console.warn("API getInternshipsByCompany failed, using cache:", err);
    }
    
    // Filter by companyId OR company name (flexible matching like getApplicationsByCompany)
    const matched = this.internshipsCache.filter(i => {
      // Match by companyId first
      if (i.companyId === companyId) return true;
      
      // Match by company name (flexible matching)
      if (companyName) {
        const iCompany = (i.company || '').toLowerCase().trim();
        const cName = companyName.toLowerCase().trim();
        return iCompany === cName || 
               iCompany.includes(cName) || 
               cName.includes(iCompany) ||
               iCompany.replace(/\s*\([^)]*\)/g, '') === cName.replace(/\s*\([^)]*\)/g, '');
      }
      
      return false;
    });
    
    // Combine API results with matched cache results and deduplicate
    const allInternships = [...apiInternships, ...matched];
    const uniqueInternships = Array.from(
      new Map(allInternships.map(i => [i.id, i])).values()
    );
    
    console.log(`getInternshipsByCompany(${companyId}) returning ${uniqueInternships.length} internships for company "${companyName}"`);
    return uniqueInternships;
  }

  async createInternship(companyId: string, internshipData: Partial<Internship>) {
    if (!api.createInternship) throw new Error("api.createInternship not implemented");
    const created = await api.createInternship({ ...internshipData, companyId });
    
    console.log('createInternship: Created internship', created.id, 'for company', created.company, 'companyId:', companyId);
    
    // Ensure company name is set (important for matching)
    if (!created.company && internshipData.company) {
      created.company = internshipData.company;
    }
    if (!created.companyId) {
      created.companyId = companyId;
    }
    
    // Update cache
    const existingIndex = this.internshipsCache.findIndex(i => i.id === created.id);
    if (existingIndex >= 0) {
      this.internshipsCache[existingIndex] = created;
      console.log('createInternship: Updated existing internship in cache');
    } else {
      this.internshipsCache.unshift(created);
      console.log('createInternship: Added new internship to cache, total:', this.internshipsCache.length);
    }
    
    // Save to localStorage
    try {
      const localInternships = localStorage.getItem('local_internships') || '[]';
      const parsed = JSON.parse(localInternships);
      const existingIdx = parsed.findIndex((i: any) => i.id === created.id);
      const internshipForStorage = {
        id: created.id,
        company_id: created.companyId || companyId,
        title: created.title,
        company: created.company || internshipData.company,
        location: created.location,
        stipend: created.stipend,
        stipendamount: created.stipendAmount,
        duration: created.duration,
        description: created.description,
        skills: created.skills || [],
        source: created.source || 'Internova',
        posted: created.posted || new Date().toISOString(),
        created_at: created.createdAt || new Date().toISOString(),
        type: created.type || "Remote",
        status: created.status || "Active",
      };
      if (existingIdx >= 0) {
        parsed[existingIdx] = internshipForStorage;
        console.log('createInternship: Updated existing internship in localStorage');
      } else {
        parsed.unshift(internshipForStorage);
        console.log('createInternship: Added new internship to localStorage, total:', parsed.length);
      }
      localStorage.setItem('local_internships', JSON.stringify(parsed));
      console.log('createInternship: Saved to localStorage successfully');
    } catch (err) {
      console.warn('Failed to save internship to localStorage:', err);
    }
    
    return created;
  }

  async updateInternship(internshipId: string, updates: Partial<Internship>) {
    // Update cache first
    const idx = this.internshipsCache.findIndex(i => i.id === internshipId);
    if (idx !== -1) {
      this.internshipsCache[idx] = { ...this.internshipsCache[idx], ...updates };
      
      // Save to localStorage
      try {
        const localInternships = localStorage.getItem('local_internships') || '[]';
        const parsed = JSON.parse(localInternships);
        const localIdx = parsed.findIndex((i: any) => i.id === internshipId);
        if (localIdx >= 0) {
          parsed[localIdx] = {
            ...parsed[localIdx],
            ...updates,
            stipendamount: updates.stipendAmount || parsed[localIdx].stipendamount,
            company_id: updates.companyId || parsed[localIdx].company_id,
          };
          localStorage.setItem('local_internships', JSON.stringify(parsed));
        }
      } catch (err) {
        console.warn('Failed to update internship in localStorage:', err);
      }
    }
    
    // Try API but don't fail if it errors
    try {
      if (api.updateInternship) {
        await api.updateInternship(internshipId, updates);
      }
    } catch (err) {
      console.warn("API updateInternship failed, using localStorage:", err);
    }
    
    return idx !== -1;
  }

  async deleteInternship(internshipId: string) {
    if (api.deleteInternship) await api.deleteInternship(internshipId);
    this.internshipsCache = this.internshipsCache.filter(i => i.id !== internshipId);
  }

  getInternshipById(internshipId: string) {
    return this.internshipsCache.find(i => i.id === internshipId);
  }

  // ---------------- APPLICATIONS ----------------
  async applyToInternship(studentId: string, internshipId: string, studentProfile: Student['profile'], studentDetails: {name:string;email:string}) {
    // Create application object
    const application: Application = {
      id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      studentId,
      internshipId,
      companyId: null,
      appliedAt: new Date().toISOString(),
      status: "Applied",
      studentProfile,
      studentDetails,
    };

    // Store in cache
    this.applicationsCache.push(application);
    this.saveApplicationsToStorage();

    // Try API call but don't fail if it errors
    try {
      if (api.applyToInternship) {
        await api.applyToInternship({ studentId, internshipId, studentProfile, studentDetails });
      }
    } catch (err) {
      // Silently continue - using local cache
    }

    return application;
  }

  async getApplicationsByStudent(studentId: string) {
    // Always load from localStorage first (primary source)
    this.loadApplicationsFromStorage();
    
    // Get from cache (which is loaded from localStorage)
    const cachedApps = this.applicationsCache.filter(a => a.studentId === studentId);
    
    // Try API to sync, but don't fail if it errors
    if (api.getApplicationsByStudent) {
      try {
        const applications = await api.getApplicationsByStudent(studentId);
        // Update cache with API data if available
        if (applications && applications.length > 0) {
          // Merge API data with cache
          const existingIds = new Set(cachedApps.map(a => a.id));
          applications.forEach((app: Application) => {
            if (!existingIds.has(app.id)) {
              this.applicationsCache.push(app);
            } else {
              const idx = this.applicationsCache.findIndex(a => a.id === app.id);
              if (idx >= 0) this.applicationsCache[idx] = app;
            }
          });
          this.saveApplicationsToStorage();
          return applications;
        }
      } catch (error) {
        // Silently continue - using localStorage
        console.warn("API getApplicationsByStudent failed, using localStorage:", error);
      }
    }
    
    // Return from cache (loaded from localStorage)
    return cachedApps;
  }

  async getApplicationsByCompany(companyId: string) {
    // Get current user to find their company name
    const currentUser = this.getCurrentUser();
    const companyName = currentUser?.profile?.company || currentUser?.name || '';
    
    // Try API first, but use cache as fallback
    let apiApps: Application[] = [];
    try {
      if (api.getApplicationsByCompany) {
        apiApps = await api.getApplicationsByCompany(companyId);
      }
    } catch (err) {
      // Use cache if API fails
    }

    // Get all internships for this company (match by company name)
    const companyInternships = this.internshipsCache.filter(i => {
      if (i.companyId === companyId) return true;
      if (!companyName) return false;
      const iCompany = (i.company || '').toLowerCase().trim();
      const cName = companyName.toLowerCase().trim();
      return iCompany === cName || 
             iCompany.includes(cName) || 
             cName.includes(iCompany) ||
             iCompany.replace(/\s*\([^)]*\)/g, '') === cName.replace(/\s*\([^)]*\)/g, '');
    });
    const internshipIds = companyInternships.map(i => i.id);

    // Filter applications by internship IDs or company name match
    const cachedApps = this.applicationsCache.filter(a => {
      // Match by internship ID
      if (internshipIds.includes(a.internshipId)) return true;
      
      // Match by company name
      if (companyName) {
        const appInternship = this.getInternshipById(a.internshipId);
        if (appInternship) {
          const appCompany = (appInternship.company || '').toLowerCase().trim();
          const cName = companyName.toLowerCase().trim();
          return appCompany === cName || 
                 appCompany.includes(cName) || 
                 cName.includes(appCompany) ||
                 appCompany.replace(/\s*\([^)]*\)/g, '') === cName.replace(/\s*\([^)]*\)/g, '');
        }
      }
      return false;
    });

    // Combine and deduplicate
    const allApps = [...apiApps, ...cachedApps];
    const uniqueApps = Array.from(
      new Map(allApps.map(app => [app.id, app])).values()
    );

    // Update cache
    uniqueApps.forEach(app => {
      const idx = this.applicationsCache.findIndex(a => a.id === app.id);
      if (idx >= 0) {
        this.applicationsCache[idx] = app;
      } else {
        this.applicationsCache.push(app);
      }
    });
    this.saveApplicationsToStorage();

    return uniqueApps;
  }

  // Helper to get current user (stored in session)
  private getCurrentUser(): User | null {
    try {
      const stored = sessionStorage.getItem('current_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  async getAllApplications() {
    if (this.isCacheValid('applications') && this.applicationsCache.length) return this.applicationsCache;
    if (api.getAllApplications) {
      const apps = await api.getAllApplications();
      this.applicationsCache = apps;
      this.lastFetch['applications'] = Date.now();
      return apps;
    }
    return this.applicationsCache;
  }

  async updateApplicationStatus(applicationId: string, status: 'Applied' | 'Under Review' | 'Rejected' | 'Accepted') {
    try {
      // Update cache first
      const app = this.applicationsCache.find(a => a.id === applicationId);
      if (app) {
        app.status = status;
        // Save to localStorage
        this.saveApplicationsToStorage();
      }

      // Try API update but don't fail if it errors
      if (api.updateApplicationStatus) {
        try {
          const updated = await api.updateApplicationStatus(applicationId, status);
          // Update cache with API response
          if (updated) {
            const idx = this.applicationsCache.findIndex(a => a.id === applicationId);
            if (idx !== -1) {
              this.applicationsCache[idx] = updated;
            } else {
              this.applicationsCache.push(updated);
            }
            // Save to localStorage again after API update
            this.saveApplicationsToStorage();
            return updated;
          }
        } catch (apiError) {
          console.warn("API update failed, using local cache:", apiError);
          // Continue with local update
        }
      }
      
      return app!;
    } catch (error) {
      console.error("Error updating application status:", error);
      throw error;
    }
  }

  // ---------------- SAVED ----------------
  async saveInternship(studentId: string, internshipId: string) {
    // Update cache first
    const saved = this.savedCache.get(studentId) || [];
    if (!saved.includes(internshipId)) {
      saved.push(internshipId);
      this.savedCache.set(studentId, saved);
      // Save to localStorage
      this.saveSavedInternshipsToStorage();
    }

    // Try API but don't fail if it errors
    try {
      if (api.saveInternship) {
        await api.saveInternship(studentId, internshipId);
      }
    } catch (error) {
      console.warn("API save failed, using localStorage:", error);
    }
  }

  async unsaveInternship(studentId: string, internshipId: string) {
    // Update cache first
    const saved = this.savedCache.get(studentId) || [];
    this.savedCache.set(studentId, saved.filter(id => id !== internshipId));
    // Save to localStorage
    this.saveSavedInternshipsToStorage();

    // Try API but don't fail if it errors
    try {
      if (api.unsaveInternship) {
        await api.unsaveInternship(studentId, internshipId);
      }
    } catch (error) {
      console.warn("API unsave failed, using localStorage:", error);
    }
  }

  async getSavedInternships(studentId: string) {
    // Always load from localStorage first (primary source)
    this.loadSavedInternshipsFromStorage();
    
    // Get from cache (which is loaded from localStorage)
    const cachedSaved = this.savedCache.get(studentId) || [];
    
    // Try API to sync, but don't fail if it errors
    if (api.getSavedInternships) {
      try {
        const saved = await api.getSavedInternships(studentId);
        // Update cache with API data if available
        if (saved && saved.length > 0) {
          this.savedCache.set(studentId, saved);
          this.saveSavedInternshipsToStorage();
          return saved;
        }
      } catch (error) {
        // Silently continue - using localStorage
        console.warn("API getSavedInternships failed, using localStorage:", error);
      }
    }
    
    // Return from cache (loaded from localStorage)
    return cachedSaved;
  }

  async getRecommendedInternships(userSkills: string[]): Promise<Internship[]> {
    if (!userSkills || userSkills.length === 0) {
      return this.getInternships();
    }
    
    try {
      if (api.getRecommendedInternships) {
        const recommended = await api.getRecommendedInternships(userSkills);
        if (recommended && recommended.length > 0) {
          return recommended;
        }
      }
    } catch (err) {
      console.warn('getRecommendedInternships failed, falling back to all internships:', err);
    }
    
    // Fallback to regular internships if recommendation function not available
    return this.getInternships();
  }

  // ---------------- MESSAGES ----------------
  async sendMessage(from: string, to: string, subject: string, content: string, type: 'message'|'interview'|'acceptance'|'rejection'='message', internshipId?: string) {
    if (api.sendMessage) await api.sendMessage({ from, to, subject, content, type, internshipId });
    this.messagesCache.delete(to);
  }

  async getMessagesForUser(userEmail: string) {
    if (api.getMessagesForUser) {
      const messages = await api.getMessagesForUser(userEmail);
      this.messagesCache.set(userEmail, messages);
      return messages;
    }
    return this.messagesCache.get(userEmail) || [];
  }

  async markMessageAsRead(messageId: string) {
    if (api.markMessageAsRead) await api.markMessageAsRead(messageId);
    for (const msgs of this.messagesCache.values()) {
      const m = msgs.find(x => x.id === messageId);
      if (m) m.read = true;
    }
  }

  async getUnreadCount(userEmail: string) {
    if (api.getUnreadCount) return (await api.getUnreadCount(userEmail)).count || 0;
    const msgs = this.messagesCache.get(userEmail) || [];
    return msgs.filter(m => !m.read).length;
  }
}

export const dataStore = new DataStore();
export default dataStore;
