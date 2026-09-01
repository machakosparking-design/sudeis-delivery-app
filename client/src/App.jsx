import React, { useState, useEffect, lazy, Suspense } from 'react';
import LandingPage from './components/LandingPage';
import './index.css';
import { Truck, ArrowLeft, Loader2 } from 'lucide-react';

// Lazy-load heavy components so landing page visitors download 0 extra weight!
const CEOAdminPanel = lazy(() => import('./components/CEOAdminPanel'));
const RiderApp = lazy(() => import('./components/RiderApp'));

export default function App() {
  // Check if user is visiting via app subdomain or /app path
  const isAppDomainOrPath = () => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    // Subdomains: app.falcondelivery.co.ke or system.falcondelivery.co.ke
    if (hostname.startsWith('app.') || hostname.startsWith('system.')) {
      return true;
    }
    // Path / Hash: /app, /system, #/app
    if (pathname.startsWith('/app') || pathname.startsWith('/system') || hash.includes('/app') || hash.includes('/system')) {
      return true;
    }
    return false;
  };

  const [currentView, setCurrentView] = useState(() => isAppDomainOrPath() ? 'app' : 'landing');
  const [currentRole, setCurrentRole] = useState('ceo'); // 'ceo', 'rider_1', 'rider_2', 'rider_3'

  // Listen to popstate / browser history navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(isAppDomainOrPath() ? 'app' : 'landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleGoToApp = () => {
    // If in production on falcondelivery.co.ke and app subdomain is configured:
    const hostname = window.location.hostname;
    if (hostname === 'falcondelivery.co.ke' || hostname === 'www.falcondelivery.co.ke') {
      window.location.href = `https://app.falcondelivery.co.ke`;
      return;
    }
    
    // Otherwise (local dev or fallback), switch view and push state
    if (window.location.pathname !== '/app') {
      window.history.pushState({}, '', '/app');
    }
    setCurrentView('app');
    window.scrollTo(0, 0);
  };

  const handleBackToWebsite = () => {
    const hostname = window.location.hostname;
    if (hostname.startsWith('app.') || hostname.startsWith('system.')) {
      window.location.href = `https://falcondelivery.co.ke`;
      return;
    }
    
    window.history.pushState({}, '', '/');
    setCurrentView('landing');
    window.scrollTo(0, 0);
  };

  // If on landing page view, render the LandingPage component
  if (currentView === 'landing') {
    return <LandingPage onGoToApp={handleGoToApp} />;
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
            <Truck /> Falcon Delivery Operations
          </div>
        </div>

        <div className="role-selector">
          <button 
            className={`btn ${currentRole === 'ceo' ? 'btn-outline' : ''}`}
            onClick={() => setCurrentRole('ceo')}
            style={currentRole !== 'ceo' ? { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', border: 'none' } : {}}
          >
            CEO Admin
          </button>
          {['rider_1', 'rider_2', 'rider_3'].map(riderId => (
            <button 
              key={riderId}
              className={`btn ${currentRole === riderId ? 'btn-outline' : ''}`}
              onClick={() => setCurrentRole(riderId)}
              style={currentRole !== riderId ? { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', border: 'none' } : {}}
            >
              {riderId === 'rider_1' ? 'Rider 1' : riderId === 'rider_2' ? 'Rider 2' : 'Rider 3'}
            </button>
          ))}
        </div>
      </header>

      {/* Main System Content with Suspense Loading */}
      <Suspense fallback={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: '#64748B' }}>
          <Loader2 className="animate-spin" size={36} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ fontWeight: 500 }}>Loading Falcon Delivery System...</p>
        </div>
      }>
        {currentRole === 'ceo' ? (
          <CEOAdminPanel />
        ) : (
          <RiderApp riderCode={currentRole} />
        )}
      </Suspense>
    </div>
  );
}
