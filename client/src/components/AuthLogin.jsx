import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import FalconIcon from './FalconIcon';

export default function AuthLogin({ systemType, onAuthSuccess }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) onAuthSuccess(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) onAuthSuccess(session);
    });

    return () => subscription.unsubscribe();
  }, [onAuthSuccess]);

  if (session) {
    return null; // Will be handled by parent
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', 
            width: '60px',
            height: '60px',
            borderRadius: '16px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
            color: '#ffffff'
          }}>
            <FalconIcon size={32} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
            {systemType === 'ceo' ? 'CEO Admin Login' : 'Rider Dispatch Login'}
          </h2>
          <p style={{ color: '#64748b', marginTop: '0.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
            Sign in to access your Falcon Delivery dashboard
          </p>
        </div>

        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          theme="light"
        />
      </div>
    </div>
  );
}
