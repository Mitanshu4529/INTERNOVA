import React, { Suspense, lazy, useEffect, useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
// The dashboards and the import page are loaded on demand, so the landing and
// sign-in pages do not download them.
const UserDashboard = lazy(() => import('./components/UserDashboard').then(m => ({ default: m.UserDashboard })));
const CompanyDashboard = lazy(() => import('./components/CompanyDashboard').then(m => ({ default: m.CompanyDashboard })));
const DataImportManager = lazy(() => import('./components/DataImportManager').then(m => ({ default: m.DataImportManager })));

const PageLoading = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground" role="status" aria-live="polite">
    Loading…
  </div>
);
import { dataStore, type User } from './data/dataStore';
import { Toaster } from './components/ui/sonner';

type Page = 'landing' | 'auth' | 'user-dashboard' | 'company-dashboard' | 'data-import';

const dashboardFor = (user: User): Page => (user.type === 'user' ? 'user-dashboard' : 'company-dashboard');

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    // Check URL for admin mode
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === 'import' ? 'data-import' : 'landing';
  });
  const [user, setUser] = useState<User | null>(null);
  // True until the stored session has been checked, so a signed-in user does not
  // see the landing page flash before their dashboard.
  const [restoring, setRestoring] = useState(true);
  const [suggestedUserType, setSuggestedUserType] = useState<'user' | 'company' | null>(null);

  // Restore the session on startup: a real account is only restored if Supabase
  // still holds a valid session for it; a demo session comes from this tab.
  useEffect(() => {
    let cancelled = false;
    dataStore.restoreSession()
      .then(restored => {
        if (cancelled || !restored) return;
        setUser(restored);
        setCurrentPage(page => (page === 'data-import' ? page : dashboardFor(restored)));
      })
      .catch(err => console.error('Could not restore the session:', err))
      .finally(() => { if (!cancelled) setRestoring(false); });

    // If the Supabase session ends (sign-out in another tab, expired refresh
    // token), leave the dashboard instead of showing data that can no longer load.
    const unsubscribe = dataStore.onSignedOut(() => {
      setUser(current => {
        if (current && !current.isDemo) {
          setCurrentPage('landing');
          return null;
        }
        return current;
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const enterApp = (signedIn: User) => {
    setUser(signedIn);
    setCurrentPage(dashboardFor(signedIn));
  };

  const handleLogin = async (email: string, password: string, name?: string, userType?: 'user' | 'company', companyName?: string) => {
    const result = await dataStore.loginOrRegister(email, password, name, userType, companyName);
    // A sign-up that still needs email confirmation succeeds without a user.
    if (result.success && 'user' in result && result.user) enterApp(result.user);
    return result;
  };

  const handleStartDemo = (type: 'user' | 'company', companySlug?: string) => {
    const result = dataStore.startDemo(type, companySlug);
    if (result.success && result.user) enterApp(result.user);
  };

  const handleLogout = () => {
    dataStore.logout().catch(err => console.error('Sign-out failed:', err));
    setUser(null);
    setCurrentPage('landing');
  };

  const navigateToAuth = (userType?: 'student' | 'company') => {
    if (userType === 'student') {
      setSuggestedUserType('user');
    } else if (userType === 'company') {
      setSuggestedUserType('company');
    } else {
      setSuggestedUserType(null);
    }
    setCurrentPage('auth');
  };

  const navigateBack = () => {
    setCurrentPage('landing');
  };

  if (restoring) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground" role="status">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {user?.isDemo && currentPage !== 'landing' && currentPage !== 'auth' && (
        <div role="status" className="demo-banner">
          <span>
            <strong>Demo mode.</strong> Nothing you do here is saved to Internova; it stays in this browser.
          </span>
          <button type="button" onClick={handleLogout} className="demo-banner-action">
            Exit demo
          </button>
        </div>
      )}

      {/* In-page notices (see utils/notify) */}
      <Toaster position="top-center" richColors closeButton />
      <Suspense fallback={<PageLoading />}>
      {currentPage === 'landing' && (
        <LandingPage onGetStarted={navigateToAuth} />
      )}

      {currentPage === 'auth' && (
        <AuthPage
          onLogin={handleLogin}
          onStartDemo={handleStartDemo}
          onBack={navigateBack}
          dataStore={dataStore}
          suggestedUserType={suggestedUserType}
        />
      )}

      {currentPage === 'user-dashboard' && user && (
        <UserDashboard
          key={user.id} // Force re-render when user changes
          user={user}
          onLogout={handleLogout}
          onBack={navigateBack}
          dataStore={dataStore}
        />
      )}

      {currentPage === 'company-dashboard' && user && (
        <CompanyDashboard
          key={user.id} // Force re-render when user changes
          user={user}
          onLogout={handleLogout}
          onBack={navigateBack}
          dataStore={dataStore}
        />
      )}

      {currentPage === 'data-import' && !restoring && !(user && user.type === 'company' && !(user as any).isDemo) && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">Company account required</h1>
          <p className="text-muted-foreground">Importing listings is only available to a signed-in company account.</p>
          <button onClick={navigateBack} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">← Back to Home</button>
        </div>
      )}

      {currentPage === 'data-import' && user && user.type === 'company' && !(user as any).isDemo && (
        <div>
          <button
            onClick={navigateBack}
            className="fixed top-4 left-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            ← Back to Home
          </button>
          <DataImportManager />
        </div>
      )}
      </Suspense>
    </div>
  );
}
