import React, { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { UserDashboard } from './components/UserDashboard';
import { CompanyDashboard } from './components/CompanyDashboard';
import { DataImportManager } from './components/DataImportManager';
import { dataStore, type User } from './data/dataStore';

type Page = 'landing' | 'auth' | 'user-dashboard' | 'company-dashboard' | 'data-import';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    // Check URL for admin mode
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === 'import' ? 'data-import' : 'landing';
  });
  const [user, setUser] = useState<User | null>(null);
  const [suggestedUserType, setSuggestedUserType] = useState<'user' | 'company' | null>(null);

  const handleLogin = async (email: string, password: string, name?: string, userType?: 'user' | 'company', companyName?: string) => {
    const result = await dataStore.loginOrRegister(email, password, name, userType, companyName);
    
    if (result.success && result.user) {
      setUser(result.user);
      
      // Navigate based on user type
      if (result.user.type === 'user') {
        setCurrentPage('user-dashboard');
      } else {
        setCurrentPage('company-dashboard');
      }
    }
    
    return result;
  };

  const handleLogout = () => {
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

  const navigateToLanding = () => {
    setCurrentPage('landing');
  };

  const navigateBack = () => {
    if (currentPage === 'auth') {
      setCurrentPage('landing');
    } else if (currentPage === 'user-dashboard' || currentPage === 'company-dashboard') {
      setCurrentPage('landing');
    } else if (currentPage === 'data-import') {
      setCurrentPage('landing');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {currentPage === 'landing' && (
        <LandingPage onGetStarted={navigateToAuth} />
      )}
      
      {currentPage === 'auth' && (
        <AuthPage 
          onLogin={handleLogin} 
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
      
      {currentPage === 'data-import' && (
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
    </div>
  );
}