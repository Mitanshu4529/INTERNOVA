// utils/api.ts
// REMOVED: import { createClient } from "@supabase/supabase-js";

// USE THE SHARED CLIENT (Crucial for Auth)
import { supabase } from "./supabaseClient";

/* ============================================================
   GET ALL INTERNSHIPS
============================================================ */
export async function getInternships() {
  const { data, error } = await supabase
    .from("internships")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase getInternships error:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    stipend: row.stipend,
    stipendAmount: row.stipendamount,
    duration: row.duration,
    description: row.description,
    skills: row.skills || [],
    source: row.source,
    posted: row.posted,
    createdAt: row.created_at,
    type: "Remote", 
    status: "Active", 
  }));
}

/* ============================================================
   GET RECOMMENDED INTERNSHIPS (AI MATCHING)
============================================================ */
export async function getRecommendedInternships(userSkills: string[]) {
  if (!userSkills || userSkills.length === 0) {
    return getInternships();
  }

  const { data, error } = await supabase
    .rpc('get_recommendations', { 
      user_skills: userSkills,
      match_threshold: 1, 
      limit_count: 50
    });

  if (error) {
    console.error("Recommendation error:", error);
    return getInternships();
  }

  return data.map((row: any) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    stipend: row.stipend,
    stipendAmount: row.stipendamount,
    duration: row.duration,
    description: row.description,
    skills: row.skills || [],
    source: row.source,
    posted: row.posted,
    createdAt: row.created_at,
    matchScore: row.match_score,
    type: "Remote", 
    status: "Active",
  }));
}

/* ============================================================
   GET BY COMPANY
============================================================ */
export async function getInternshipsByCompany(companyName: string) {
  const { data, error } = await supabase
    .from("internships")
    .select("*")
    .eq("company", companyName);

  if (error) return [];
  return data;
}

/* ============================================================
   SAVED INTERNSHIPS
============================================================ */
export async function getSavedInternships(studentId: string) {
  const { data, error } = await supabase
    .from("saved_internships")
    .select("internship_id")
    .eq("student_id", studentId);

  if (error) {
    console.error("getSavedInternships error:", error);
    return [];
  }
  return (data || []).map((d) => d.internship_id);
}

export async function saveInternship(studentId: string, internshipId: string) {
  const { data, error } = await supabase
    .from("saved_internships")
    .insert({
      student_id: studentId,
      internship_id: internshipId,
    })
    .select()
    .single();

  // If it's a duplicate key error, that's okay - it's already saved
  if (error && error.code !== '23505') {
    console.error("saveInternship error:", error);
    throw error;
  }
  
  return { data, error: null };
}

export async function unsaveInternship(studentId: string, internshipId: string) {
  return supabase
    .from("saved_internships")
    .delete()
    .match({ student_id: studentId, internship_id: internshipId });
}

/* ============================================================
   APPLICATIONS
============================================================ */
export async function applyToInternship(body: any) {
  const payload = {
    student_id: body.studentId,
    internship_id: body.internshipId,
    company_id: body.companyId || null,
    student_profile: body.studentProfile || {},
    student_details: body.studentDetails || {},
    status: "Applied",
    applied_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("applications")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getApplicationsByStudent(studentId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("student_id", studentId)
    .order("applied_at", { ascending: false });

  if (error) {
    console.error("getApplicationsByStudent error:", error);
    return [];
  }

  // Map snake_case to camelCase for consistency
  return (data || []).map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    internshipId: row.internship_id,
    companyId: row.company_id,
    status: row.status,
    studentProfile: row.student_profile || {},
    studentDetails: row.student_details || {},
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getApplicationsByCompany(companyId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("company_id", companyId)
    .order("applied_at", { ascending: false });

  if (error) {
    console.error("getApplicationsByCompany error:", error);
    return [];
  }

  // Map snake_case to camelCase for consistency
  return (data || []).map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    internshipId: row.internship_id,
    companyId: row.company_id,
    status: row.status,
    studentProfile: row.student_profile || {},
    studentDetails: row.student_details || {},
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getAllApplications() {
  const { data, error } = await supabase
    .from("applications")
    .select("*");

  if (error) {
    console.error("getAllApplications error:", error);
    return [];
  }

  // Map snake_case to camelCase for consistency
  return (data || []).map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    internshipId: row.internship_id,
    companyId: row.company_id,
    status: row.status,
    studentProfile: row.student_profile || {},
    studentDetails: row.student_details || {},
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function updateApplicationStatus(applicationId: string, status: 'Applied' | 'Under Review' | 'Rejected' | 'Accepted') {
  // Try Supabase update but don't fail if it errors
  try {
    const { data, error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", applicationId)
      .select()
      .single();

    if (error) {
      console.error("updateApplicationStatus error:", error);
      // Don't throw - allow fallback to localStorage
      return null;
    }

    // Map snake_case to camelCase for consistency
    return {
      id: data.id,
      studentId: data.student_id,
      internshipId: data.internship_id,
      companyId: data.company_id,
      status: data.status,
      studentProfile: data.student_profile || {},
      studentDetails: data.student_details || {},
      appliedAt: data.applied_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.warn("Supabase updateApplicationStatus failed, using localStorage:", err);
    return null;
  }
}

/* ============================================================
   MESSAGES
============================================================ */
export async function sendMessage(payload: any) {
  // Save to localStorage first
  try {
    const stored = localStorage.getItem('local_messages') || '[]';
    const messages: any[] = JSON.parse(stored);
    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from_email: payload.from,
      to_email: payload.to,
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      content: payload.content,
      type: payload.type || "message",
      internship_id: payload.internshipId || null,
      internshipId: payload.internshipId || null,
      timestamp: new Date().toISOString(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    messages.push(newMessage);
    localStorage.setItem('local_messages', JSON.stringify(messages));
  } catch (err) {
    console.warn('Failed to save message to localStorage:', err);
  }

  // Try Supabase but don't fail if it errors
  try {
    const { data, error } = await supabase.from("messages").insert({
      from_email: payload.from,
      to_email: payload.to,
      subject: payload.subject,
      content: payload.content,
      type: payload.type || "message",
      internship_id: payload.internshipId || null,
      timestamp: new Date().toISOString(),
      read: false,
    });

    if (error) {
      console.warn("Supabase sendMessage error (using localStorage):", error);
    }
    return data;
  } catch (err) {
    console.warn("Supabase sendMessage failed (using localStorage):", err);
    return null;
  }
}

export async function getMessagesForUser(email: string) {
  // Load from localStorage first
  let localMessages: any[] = [];
  try {
    const stored = localStorage.getItem('local_messages');
    if (stored) {
      localMessages = JSON.parse(stored).filter((msg: any) => 
        (msg.to_email || msg.to) === email || (msg.from_email || msg.from) === email
      );
    }
  } catch (err) {
    console.warn('Failed to load messages from localStorage:', err);
  }

  // Try Supabase but use localStorage as fallback
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`to_email.eq.${email},from_email.eq.${email}`)
      .order("timestamp", { ascending: false });

    if (!error && data) {
      // Merge Supabase messages with localStorage messages
      const supabaseMessages = (data || []).map((row: any) => ({
        id: row.id,
        from: row.from_email,
        to: row.to_email,
        subject: row.subject,
        content: row.content,
        type: row.type,
        internshipId: row.internship_id,
        timestamp: row.timestamp,
        read: row.read,
        createdAt: row.created_at,
      }));
      
      // Combine and deduplicate
      const allMessages = [...supabaseMessages, ...localMessages];
      const uniqueMessages = Array.from(
        new Map(allMessages.map(msg => [msg.id, msg])).values()
      );
      return uniqueMessages.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }
  } catch (err) {
    console.warn("Supabase getMessagesForUser failed (using localStorage):", err);
  }

  // Return localStorage messages
  return localMessages.sort((a, b) => 
    new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime()
  );
}

export async function markMessageAsRead(messageId: string) {
  await supabase
    .from("messages")
    .update({ read: true })
    .eq("id", messageId);
}

export async function getUnreadCount(userEmail: string) {
  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("to_email", userEmail)
    .eq("read", false);

  if (error) {
    console.error("getUnreadCount error:", error);
    return { count: 0 };
  }

  return { count: count || 0 };
}

/* ============================================================
   LOGIN & REGISTRATION
============================================================ */
// Demo company credentials - 20 companies from database
const DEMO_COMPANIES_CREDENTIALS: Record<string, { name: string; company: string }> = {
  'volopay@demo.com': { name: 'Volopay', company: 'Volopay' },
  'doubleticks@demo.com': { name: 'Double Ticks', company: 'Double Ticks' },
  'xiarchbharat@demo.com': { name: 'Xiarch Bharat Pvt. Ltd.', company: 'Xiarch Bharat Pvt. Ltd.' },
  'orion@demo.com': { name: 'Orion Educational Society', company: 'Orion Educational Society' },
  'itlh@demo.com': { name: 'Itlh', company: 'Itlh' },
  'ethinos@demo.com': { name: 'Ethinos', company: 'Ethinos' },
  'landor@demo.com': { name: 'Landor', company: 'Landor' },
  'briskwin@demo.com': { name: 'BriskWin IT (BWIT)', company: 'BriskWin IT (BWIT)' },
  'weaddo@demo.com': { name: 'Weaddo', company: 'Weaddo' },
  'discoverdollar@demo.com': { name: 'Discover Dollar Technologies', company: 'Discover Dollar Technologies' },
  'getcatalyzed@demo.com': { name: 'Get Catalyzed', company: 'Get Catalyzed' },
  'brightfuture@demo.com': { name: 'Bright Future', company: 'Bright Future' },
  'poornatha@demo.com': { name: 'Poornatha', company: 'Poornatha' },
  'unitedway@demo.com': { name: 'United Way Mumbai', company: 'United Way Mumbai' },
  'alepo@demo.com': { name: 'Alepo Technologies', company: 'Alepo Technologies' },
  'forbesadvisor@demo.com': { name: 'Forbes Advisor', company: 'Forbes Advisor' },
  'conservationaction@demo.com': { name: 'Conservation Action Trust', company: 'Conservation Action Trust' },
  'sarvmai@demo.com': { name: 'SarvM.AI', company: 'SarvM.AI' },
  'saksglobal@demo.com': { name: 'Saks Global', company: 'Saks Global' },
  'crisil@demo.com': { name: 'Crisil', company: 'Crisil' },
};

// Store current user in session for demo mode
function storeCurrentUser(user: any) {
  try {
    sessionStorage.setItem('current_user', JSON.stringify(user));
  } catch (e) {
    // Ignore storage errors
  }
}

// LocalStorage-based user management
function getLocalUsers(): Record<string, { password: string; user: any }> {
  try {
    const stored = localStorage.getItem('local_users');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveLocalUser(email: string, password: string, user: any) {
  const users = getLocalUsers();
  users[email.toLowerCase().trim()] = { password, user };
  localStorage.setItem('local_users', JSON.stringify(users));
}

function getLocalUser(email: string, password: string): any | null {
  const users = getLocalUsers();
  const normalizedEmail = email.toLowerCase().trim();
  const userData = users[normalizedEmail];
  if (userData && userData.password === password) {
    return userData.user;
  }
  return null;
}

export async function login(email: string, password: string, name?: string, userType?: string, companyName?: string) {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check if this is a demo company login
  if (normalizedEmail.endsWith('@demo.com') && password === 'password123') {
    const demoCompany = DEMO_COMPANIES_CREDENTIALS[normalizedEmail];
    if (demoCompany) {
      // Create demo user without Supabase auth
      const demoUserId = `demo_${normalizedEmail.replace('@demo.com', '').replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
      const demoUser = {
        success: true,
        user: {
          id: demoUserId,
          email: normalizedEmail,
          name: demoCompany.name,
          type: 'company' as const,
          profile: { company: demoCompany.company },
          isNewUser: false,
        },
      };
      storeCurrentUser(demoUser.user);
      // Also save to localStorage for persistence
      saveLocalUser(normalizedEmail, password, demoUser.user);
      return demoUser;
    }
  }
  
  // Registration flow - save to localStorage
  if (name) {
    const userId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newUser = {
      success: true,
      user: {
        id: userId,
        email: normalizedEmail,
        name: name,
        type: userType || 'user',
        profile: companyName ? { company: companyName } : {},
        isNewUser: true,
      }
    };
    // Save to localStorage
    saveLocalUser(normalizedEmail, password, newUser.user);
    storeCurrentUser(newUser.user);
    return newUser;
  }

  // Login flow - check localStorage first
  const localUser = getLocalUser(normalizedEmail, password);
  if (localUser) {
    storeCurrentUser(localUser);
    return { success: true, user: localUser };
  }

  // Fallback to Supabase if not in localStorage
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const loggedInUser = {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: userData?.name || data.user.user_metadata?.name || email.split('@')[0],
        type: userData?.type || data.user.user_metadata?.type || 'user',
        profile: userData?.profile || {},
        isNewUser: false,
      },
    };
    
    // Also save to localStorage for future logins
    saveLocalUser(normalizedEmail, password, loggedInUser.user);
    
    return loggedInUser;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Login failed' };
  }
}

export async function updateUserProfile(userId: string, profile: any) {
  // Update localStorage user profile (PRIMARY SOURCE)
  try {
    const users = getLocalUsers();
    let updated = false;
    for (const email in users) {
      if (users[email].user.id === userId) {
        users[email].user.profile = { ...users[email].user.profile, ...profile };
        localStorage.setItem('local_users', JSON.stringify(users));
        // Also update sessionStorage
        try {
          const currentUser = sessionStorage.getItem('current_user');
          if (currentUser) {
            const userObj = JSON.parse(currentUser);
            userObj.profile = { ...userObj.profile, ...profile };
            sessionStorage.setItem('current_user', JSON.stringify(userObj));
          }
        } catch (e) {
          console.warn('Failed to update sessionStorage:', e);
        }
        updated = true;
        break;
      }
    }
    if (!updated) {
      console.warn('User not found in localStorage for profile update');
    }
  } catch (err) {
    console.warn('Failed to update localStorage profile:', err);
  }

  // Try Supabase update but don't fail if it errors
  try {
    const { data, error } = await supabase
      .from("users")
      .update({ profile: profile })
      .eq("id", userId); 

    if (error) {
      console.warn("Supabase profile update failed (using localStorage):", error);
      // Don't fail - localStorage update succeeded
    }
  } catch (err) {
    console.warn('Supabase profile update failed, using localStorage:', err);
  }
  
  return { success: true };
}

/* ============================================================
   CREATE / UPDATE / DELETE INTERNSHIP
============================================================ */
export async function createInternship(data: any) {
  const internshipId = `local_int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newInternship = {
    id: internshipId,
    company_id: data.companyId || null,
    title: data.title,
    company: data.company,
    location: data.location,
    type: data.type || 'Remote',
    skills: Array.isArray(data.skills) ? data.skills : (data.skills ? data.skills.split(',').map((s: string) => s.trim()) : []),
    duration: data.duration || null,
    stipend: data.stipend || null,
    stipendamount: data.stipendAmount || null,
    description: data.description || null,
    source: data.source || null,
    posted: new Date().toISOString(),
    created_at: new Date().toISOString(),
    status: 'Active',
  };

  // Save to localStorage first
  try {
    const localInternships = localStorage.getItem('local_internships') || '[]';
    const parsed = JSON.parse(localInternships);
    parsed.unshift(newInternship);
    localStorage.setItem('local_internships', JSON.stringify(parsed));
  } catch (err) {
    console.warn('Failed to save internship to localStorage:', err);
  }

  // Try Supabase but don't fail if it errors
  try {
    const payload = {
      title: data.title,
      company: data.company,
      location: data.location,
      skills: data.skills || [],
      duration: data.duration || null,
      stipend: data.stipend || null,
      stipendamount: data.stipendAmount || null,
      description: data.description || null,
      source: data.source || null,
      posted: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from("internships")
      .insert(payload)
      .select()
      .single();

    if (!error && inserted) {
      // Update localStorage with real ID if Supabase succeeded
      try {
        const localInternships = localStorage.getItem('local_internships') || '[]';
        const parsed = JSON.parse(localInternships);
        const idx = parsed.findIndex((i: any) => i.id === internshipId);
        if (idx >= 0) {
          parsed[idx] = { ...newInternship, id: inserted.id };
          localStorage.setItem('local_internships', JSON.stringify(parsed));
        }
      } catch (err) {
        console.warn('Failed to update localStorage with Supabase ID:', err);
      }
      return {
        id: inserted.id,
        title: inserted.title,
        company: inserted.company,
        location: inserted.location,
        stipend: inserted.stipend,
        stipendAmount: inserted.stipendamount,
        duration: inserted.duration,
        description: inserted.description,
        skills: inserted.skills || [],
        source: inserted.source,
        posted: inserted.posted,
        createdAt: inserted.created_at,
        type: inserted.type || "Remote",
        status: inserted.status || "Active",
        companyId: inserted.company_id,
      };
    }
  } catch (err) {
    console.warn("Supabase createInternship failed, using localStorage:", err);
  }
  
  return {
    id: newInternship.id,
    title: newInternship.title,
    company: newInternship.company,
    location: newInternship.location,
    stipend: newInternship.stipend,
    stipendAmount: newInternship.stipendamount,
    duration: newInternship.duration,
    description: newInternship.description,
    skills: newInternship.skills || [],
    source: newInternship.source,
    posted: newInternship.posted,
    createdAt: newInternship.created_at,
    type: newInternship.type || "Remote",
    status: newInternship.status || "Active",
    companyId: newInternship.company_id,
  };
}

export async function updateInternship(id: string, updates: any) {
  // Update localStorage first
  try {
    const localInternships = localStorage.getItem('local_internships') || '[]';
    const parsed = JSON.parse(localInternships);
    const idx = parsed.findIndex((i: any) => i.id === id);
    if (idx >= 0) {
      parsed[idx] = { ...parsed[idx], ...updates };
      if (updates.stipendAmount !== undefined) {
        parsed[idx].stipendamount = updates.stipendAmount;
      }
      if (updates.companyId !== undefined) {
        parsed[idx].company_id = updates.companyId;
      }
      localStorage.setItem('local_internships', JSON.stringify(parsed));
    }
  } catch (err) {
    console.warn('Failed to update internship in localStorage:', err);
  }

  // Try Supabase but don't fail if it errors
  try {
    const { error } = await supabase
      .from("internships")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.warn("Supabase updateInternship error (using localStorage):", error);
    }
  } catch (err) {
    console.warn("Supabase updateInternship failed (using localStorage):", err);
  }
  
  return true;
}

export async function deleteInternship(id: string) {
  const { error } = await supabase
    .from("internships")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
}