import React, { useState } from 'react';
import { ShieldOff, LogOut, Copy, Check } from 'lucide-react';
import { supabase } from '../supabase';

/**
 * Shown when an authenticated user tries to access a section
 * they do not have permission for (e.g., a rider opening /system, or unlinked role).
 */
export default function UnauthorizedScreen({ userRole, requestedContext, session }) {
  const [copied, setCopied] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const handleCopyId = () => {
    if (userId) {
      navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
        padding: '2.5rem 2rem',
        borderRadius: '16px',
        boxShadow: '0 4px 24px -4px rgba(0,0,0,0.12)',
        maxWidth: '460px',
        width: '100%'
      }}>
        <div style={{
          background: '#fef2f2',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem'
        }}>
          <ShieldOff size={32} color="#ef4444" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.5rem' }}>
          Access Denied
        </h2>

        <p style={{ color: '#64748b', fontSize: '0.925rem', lineHeight: 1.5, margin: '0 0 1rem' }}>
          Your account <strong>(role: {userRole || 'unknown'})</strong> does not have permission
          to access the <strong>{requestedContext === 'ceo' ? 'CEO Admin Panel' : 'Rider App'}</strong>.
        </p>

        {userEmail && (
          <div style={{
            background: '#f1f5f9',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '1.25rem',
            textAlign: 'left',
            fontSize: '0.825rem'
          }}>
            <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Logged in as:</div>
            <div style={{ fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>{userEmail}</div>
            
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                UID: {userId ? `${userId.substring(0, 18)}...` : ''}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                style={{
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: '#334155'
                }}
              >
                {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy UID'}
              </button>
            </div>
          </div>
        )}

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

