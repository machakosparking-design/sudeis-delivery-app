import React, { useState } from 'react';
import { supabase } from '../supabase';
import FalconIcon from './FalconIcon';
import { User, Phone, Calendar, Users, ChevronRight, Loader2 } from 'lucide-react';

export default function RiderOnboarding({ session, onComplete }) {
  const [form, setForm] = useState({
    name: '',
    gender: '',
    age: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('Full name is required.');
    if (!form.gender) return setError('Please select your gender.');
    if (!form.age || isNaN(form.age) || Number(form.age) < 18 || Number(form.age) > 70)
      return setError('Please enter a valid age (18–70).');
    if (!form.phone.trim()) return setError('Phone number is required.');

    setLoading(true);
    try {
      // Generate clean unique rider code from name (satisfies NOT NULL and UNIQUE constraint)
      const cleanName = form.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').substring(0, 16);
      const autoCode = `${cleanName || 'rider'}_${Math.floor(100 + Math.random() * 900)}`;

      const { error: insertError } = await supabase.from('riders').insert({
        auth_user_id: session.user.id,
        name: form.name.trim(),
        gender: form.gender,
        age: Number(form.age),
        phone: form.phone.trim(),
        role: 'rider',
        approval_status: 'pending_approval',
        status: 'offline',
        rider_code: autoCode,
        orders_completed: 0,
        earnings: 0,
      });

      if (insertError) {
        console.error('Onboarding insert error:', insertError);
        setError(insertError.message || 'Failed to submit application. Please try again.');
      } else {
        onComplete();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100dvh',
      backgroundColor: '#f8fafc',
      padding: 'max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom))',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'white',
        padding: '1.75rem 1.25rem',
        borderRadius: '16px',
        boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08)',
        width: '100%',
        maxWidth: '440px',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
          }}>
            <FalconIcon size={34} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            Rider Application
          </h2>
          <p style={{ color: '#64748b', marginTop: '0.5rem', textAlign: 'center', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Complete your profile to apply as a Falcon Delivery rider. Your application will be reviewed by the CEO.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
              <User size={14} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} />
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. John Kamau"
              required
              style={inputStyle}
            />
          </div>

          {/* Gender */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
              <Users size={14} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} />
              Gender *
            </label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              required
              style={inputStyle}
            >
              <option value="">Select gender...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other / Prefer not to say</option>
            </select>
          </div>

          {/* Age */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
              <Calendar size={14} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} />
              Age *
            </label>
            <input
              type="number"
              name="age"
              value={form.age}
              onChange={handleChange}
              placeholder="e.g. 24"
              min="18"
              max="70"
              required
              style={inputStyle}
            />
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
              <Phone size={14} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} />
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="e.g. 0712 345 678"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              color: '#dc2626',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.875rem 1.5rem',
              background: loading ? '#93C5FD' : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.2s',
              marginTop: '0.5rem',
            }}
          >
            {loading ? (
              <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</>
            ) : (
              <>Submit Application <ChevronRight size={18} /></>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', marginTop: '1.5rem' }}>
          Signed in as {session?.user?.email}
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '0.7rem 0.9rem',
  border: '1.5px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '0.95rem',
  color: '#1e293b',
  backgroundColor: '#f8fafc',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};
