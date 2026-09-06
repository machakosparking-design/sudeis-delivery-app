import React from 'react';
import { ShieldOff, LogOut } from 'lucide-react';
import { supabase } from '../supabase';

/**
 * Shown when an authenticated user tries to access a section
 * they do not have permission for (e.g., a rider opening /system).
 */
export default function UnauthorizedScreen({ userRole, requestedContext }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem 2rem',
        borderRadius: '16px',
        boxShadow: '0 4px 24px -4px rgba(0,0,0,0.12)',
        maxWidth: '420px',
        width: '100%'
      }}>
        <div style={{
          background: '#fef2f2',
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem'
        }}>
          <ShieldOff size={36} color="#ef4444" />
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.75rem' }}>
          Access Denied
        </h2>

        <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 0.5rem' }}>
          Your account <strong>(role: {userRole || 'unknown'})</strong> does not have permission
          to access the <strong>{requestedContext === 'ceo' ? 'CEO Admin Panel' : 'Rider App'}</strong>.
        </p>

        <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0 0 2rem' }}>
          If you believe this is an error, contact your system administrator.
        </p>

        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            justifyContent: 'center',
            width: '100%',
            padding: '0.75rem 1.5rem',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </div>
  );
}
