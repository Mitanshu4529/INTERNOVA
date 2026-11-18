// Which backend the app is talking to.
//
//  - 'live': a real Supabase account. Every read and write goes to the database
//            and is authorised there by row level security. Failures are shown
//            to the user; nothing is silently kept in the browser instead.
//  - 'demo': an explicitly chosen, clearly labelled trial. Everything the user
//            does is stored in this browser only and is never sent to the
//            database. (The public internship catalogue is still read, so the
//            demo has real listings to browse.)
//
// The two never mix: a demo user has no Supabase session, and a signed-in user
// never reads or writes the demo storage.

export type AppMode = 'live' | 'demo';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  type: 'user' | 'company';
  profile?: any;
  isNewUser?: boolean;
  isDemo?: boolean;
}

const USER_KEY = 'current_user';

export function getStoredUser(): SessionUser | null {
  try {
    const stored = sessionStorage.getItem(USER_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed.id === 'string' && (parsed.type === 'user' || parsed.type === 'company')) {
      return parsed as SessionUser;
    }
  } catch {
    // Unreadable entry: treat as signed out.
  }
  return null;
}

export function storeUser(user: SessionUser | null) {
  try {
    if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(USER_KEY);
  } catch {
    // Storage unavailable (private mode, quota): the session simply won't survive a refresh.
  }
}

/** The mode follows the current user: demo users are flagged, everyone else is live. */
export function getMode(): AppMode {
  return getStoredUser()?.isDemo ? 'demo' : 'live';
}

export function isDemoMode(): boolean {
  return getMode() === 'demo';
}
