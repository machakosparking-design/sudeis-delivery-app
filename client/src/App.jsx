import React, { useState, useEffect, lazy, Suspense } from 'react';
import LandingPage from './components/LandingPage';
import AuthLogin from './components/AuthLogin';
import UnauthorizedScreen from './components/UnauthorizedScreen';
import './index.css';
import { Truck, ArrowLeft, Loader2, LogOut } from 'lucide-react';
import { supabase } from './supabase';

// Lazy-load heavy components so landing page visitors download 0 extra weight!
const CEOAdminPanel = lazy(() => import('./components/CEOAdminPanel'));
const RiderApp = lazy(() => import('./components/RiderApp'));

export default function App() {
  // Determine the context based on subdomain or path
  const getDomainContext = () => {
    if (typeof window === 'undefined') return { view: 'landing', systemType: null };
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    // CEO Admin - system.falcondelivery.co.ke
    if (hostname.startsWith('system.') || pathname.startsWith('/system') || hash.includes('/system')) {
      return { view: 'app', systemType: 'ceo' };
    }
    
    // Rider App - app.falcondelivery.co.ke
    if (hostname.startsWith('app.') || pathname.startsWith('/app') || hash.includes('/app')) {
      return { view: 'app', systemType: 'rider' };
    }
    
    return { view: 'landing', systemType: null };
  };

  const initContext = getDomainContext();
  const [currentView, setCurrentView] = useState(initContext.view);
  const [systemType, setSystemType] = useState(initContext.systemType);
  const [currentRole, setCurrentRole] = useState(initContext.systemType === 'ceo' ? 'ceo' : 'rider_1');
  const [session, setSession] = useState(null);
  // userRole is the role stored in the DB for the logged-in user ('ceo' or 'rider')
  const [userRole, setUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Reset role on sign out
      if (!session) setUserRole(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch the user's role from the riders table once they are logged in
  useEffect(() => {
    if (!session?.user?.id) {
      setUserRole(null);
      return;
    }
    const fetchUserRole = async () => {
      setRoleLoading(true);
      const { data, error } = await supabase
        .from('riders')
        .select('role')
        .eq('auth_user_id', session.user.id)
        .single();

      if (error || !data) {
        // If the user has no rider row at all, treat as unauthorized
        console.warn('No rider profile found for user:', session.user.id);
        setUserRole('unknown');
      } else {
        setUserRole(data.role);
      }
      setRoleLoading(false);
    };
    fetchUserRole();
  }, [session?.user?.id]);

  // Listen to popstate / browser history navigation
  useEffect(() => {
    const handlePopState = () => {
      const ctx = getDomainContext();
      setCurrentView(ctx.view);
      setSystemType(ctx.systemType);
      
      // Update role automatically if switching contexts via history
      if (ctx.systemType === 'ceo') {
        setCurrentRole('ceo');
      } else if (ctx.systemType === 'rider' && currentRole === 'ceo') {
        setCurrentRole('rider_1');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentRole]);

  const handleGoToApp = (targetRole = 'rider') => {
    const hostname = window.location.hostname;
    
    // If in production, route to appropriate subdomain
    if (hostname.includes('falcondelivery.co.ke') || hostname.includes('falcon.co.ke')) {
      if (targetRole === 'ceo') {
        window.location.href = `https://system.falcondelivery.co.ke`;
      } else {
        window.location.href = `https://app.falcondelivery.co.ke`;
      }
      return;
    }
    
    // Otherwise (local dev or fallback), switch view and push state
    if (targetRole === 'ceo') {
      if (window.location.pathname !== '/system') {
        window.history.pushState({}, '', '/system');
      }
      setSystemType('ceo');
      setCurrentRole('ceo');
    } else {
      if (window.location.pathname !== '/app') {
        window.history.pushState({}, '', '/app');
      }
      setSystemType('rider');
      setCurrentRole('rider_1');
    }
    setCurrentView('app');
    window.scrollTo(0, 0);
  };

  const handleBackToWebsite = () => {
    const hostname = window.location.hostname;
    // If on a dedicated subdomain, return to the main website
    if (hostname.startsWith('app.') || hostname.startsWith('system.')) {
      // Use the root domain without subdomains (this also supports falcon.co.ke if configured)
      const rootDomain = hostname.replace('app.', '').replace('system.', '');
      window.location.href = `https://${rootDomain}`;
      return;
    }
    
    // Local dev fallback
    window.history.pushState({}, '', '/');
    setCurrentView('landing');
    setSystemType(null);
    window.scrollTo(0, 0);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // If on landing page view, render the LandingPage component
  if (currentView === 'landing') {
    return <LandingPage onGoToApp={handleGoToApp} />;
  }

  // Delivery System View - Requires Auth
  if (!session) {
    return <AuthLogin systemType={systemType} onAuthSuccess={(sess) => setSession(sess)} />;
  }

  // While we fetch the user's role from the DB, show a spinner
  if (roleLoading || userRole === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', color: '#64748B' }}>
        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontWeight: 500 }}>Verifying access...</p>
      </div>
    );
  }

  // ── RBAC Gate ──────────────────────────────────────────────────────────────
  // Block riders from accessing the CEO panel and unknown users from anything
  if (userRole === 'unknown') {
    return <UnauthorizedScreen userRole={userRole} requestedContext={systemType} />;
  }
  if (systemType === 'ceo' && userRole !== 'ceo') {
    return <UnauthorizedScreen userRole={userRole} requestedContext="ceo" />;
  }
  if (systemType === 'rider' && userRole === 'ceo') {
    // CEOs navigating to the rider app: allow (they may want to monitor)
    // but ensure the tab switcher doesn't show CEO options on rider subdomain
  }

  // Delivery System View (CEO Admin & Rider App)
  return (
    <div className="app-container">
      {/* Top Navigation / Role Switcher */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={handleBackToWebsite}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            title="Return to Falcon Delivery Website"
          >
            <ArrowLeft size={16} /> Website
          </button>

          <div className="flex items-center gap-2 text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck /> Falcon Delivery {systemType === 'ceo' ? 'System' : systemType === 'rider' ? 'App' : 'Operations'}
          </div>
        </div>

        <div className="role-selector" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* CEO Admin tab — only shown to users with role 'ceo' */}
          {userRole === 'ceo' && (!systemType || systemType === 'ceo') && (
            <button 
              className={`btn ${currentRole === 'ceo' ? 'btn-outline' : ''}`}
              onClick={() => setCurrentRole('ceo')}
              style={currentRole !== 'ceo' ? { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', border: 'none' } : {}}
            >
              CEO Admin
            </button>
          )}
          
          {(!systemType || systemType === 'rider') && ['rider_1', 'rider_2', 'rider_3'].map(riderId => (
            <button 
              key={riderId}
              className={`btn ${currentRole === riderId ? 'btn-outline' : ''}`}
              onClick={() => setCurrentRole(riderId)}
              style={currentRole !== riderId ? { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', border: 'none' } : {}}
            >
              {riderId === 'rider_1' ? 'Rider 1' : riderId === 'rider_2' ? 'Rider 2' : 'Rider 3'}
            </button>
          ))}
          
          <button 
            onClick={handleSignOut}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', marginLeft: 'auto', backgroundColor: 'transparent', color: '#f87171', border: '1px solid #f87171' }}
            title="Sign Out"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </header>

      {/* Main System Content with Suspense Loading */}
      <Suspense fallback={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748B' }}>
          <Loader2 className="animate-spin" size={36} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ fontWeight: 500 }}>Loading Falcon Delivery System...</p>
        </div>
      }>
        {currentRole === 'ceo' && userRole === 'ceo' ? (
          <CEOAdminPanel />
        ) : (
          <RiderApp riderCode={currentRole} />
        )}
      </Suspense>
    </div>
  );
}

