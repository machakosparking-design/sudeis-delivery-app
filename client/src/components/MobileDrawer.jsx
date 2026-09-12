import React from 'react';
import { 
  X, MapPin, Users, LayoutDashboard, Shield, LogOut, ArrowLeft, 
  Package, Wallet, MessageCircle, Phone, ChevronRight, CheckCircle, ExternalLink 
} from 'lucide-react';
import FalconIcon from './FalconIcon';

export default function MobileDrawer({
  isOpen,
  onClose,
  userRole,
  userRiderProfile,
  session,
  currentRole,
  onSelectRole,
  activeRidersList = [],
  pendingCount = 0,
  activeTab = 'dashboard',
  onSelectTab,
  onSignOut,
  onBackToWebsite
}) {
  if (!isOpen) return null;

  const isManagement = userRole === 'ceo' || userRole === 'superadmin';

  return (
    <div 
      className="mobile-drawer-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'drawerFadeIn 0.2s ease-out'
      }}
    >
      <div 
        className="mobile-drawer-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '85%',
          maxWidth: '340px',
          height: '100%',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 25px rgba(0, 0, 0, 0.4)',
          paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
          animation: 'drawerSlideLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflowY: 'auto'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.25rem 1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF'
            }}>
              <FalconIcon size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>Falcon Delivery</div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                {userRole === 'superadmin' ? 'Super Admin Mode' : userRole === 'ceo' ? 'CEO System' : 'Courier Portal'}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#CBD5E1',
              cursor: 'pointer'
            }}
            aria-label="Close Menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Profile Card */}
        <div style={{
          padding: '1rem 1.25rem',
          margin: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '0.25rem' }}>Logged in as:</div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#FFFFFF', wordBreak: 'break-all' }}>
            {userRiderProfile?.name || session?.user?.email?.split('@')[0] || 'User'}
          </div>
          {session?.user?.email && (
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px', wordBreak: 'break-all' }}>
              {session.user.email}
            </div>
          )}

          <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {userRole === 'superadmin' && (
              <span style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px',
                textTransform: 'uppercase'
              }}>
                ⚡ Super Admin
              </span>
            )}
            {userRole === 'ceo' && (
              <span style={{
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                👔 CEO
              </span>
            )}
            {userRole === 'rider' && (
              <span style={{
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#93C5FD',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                🏍️ {userRiderProfile?.rider_code || 'Courier'}
              </span>
            )}
          </div>
        </div>

        {/* Navigation Section */}
        <div style={{ flex: 1, padding: '0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          
          {/* CEO & Super Admin Views */}
          {isManagement && (
            <>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', padding: '0.5rem 0.5rem 0.25rem', letterSpacing: '0.05em' }}>
                Management
              </div>

              {/* Live Map */}
              <button
                onClick={() => {
                  onSelectRole('ceo');
                  if (onSelectTab) onSelectTab('dashboard');
                  onClose();
                }}
                style={drawerBtnStyle(currentRole === 'ceo' && activeTab === 'dashboard')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <MapPin size={18} color="#38BDF8" />
                  <span>Live Dispatch Map</span>
                </div>
                <ChevronRight size={16} opacity={0.5} />
              </button>

              {/* Rider Management */}
              <button
                onClick={() => {
                  onSelectRole('ceo');
                  if (onSelectTab) onSelectTab('riders');
                  onClose();
                }}
                style={drawerBtnStyle(currentRole === 'ceo' && activeTab === 'riders')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Users size={18} color="#A855F7" />
                  <span>Riders & Approvals</span>
                </div>
                {pendingCount > 0 ? (
                  <span style={{
                    background: '#EF4444',
                    color: 'white',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '10px'
                  }}>
                    {pendingCount} new
                  </span>
                ) : (
                  <ChevronRight size={16} opacity={0.5} />
                )}
              </button>

              {/* Finance Dashboard */}
              <button
                onClick={() => {
                  onSelectRole('ceo');
                  if (onSelectTab) onSelectTab('finance');
                  onClose();
                }}
                style={drawerBtnStyle(currentRole === 'ceo' && activeTab === 'finance')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <LayoutDashboard size={18} color="#10B981" />
                  <span>Finance Dashboard</span>
                </div>
                <ChevronRight size={16} opacity={0.5} />
              </button>

              {/* Superadmin Roles */}
              {userRole === 'superadmin' && (
                <button
                  onClick={() => {
                    onSelectRole('ceo');
                    if (onSelectTab) onSelectTab('roles');
                    onClose();
                  }}
                  style={drawerBtnStyle(currentRole === 'ceo' && activeTab === 'roles')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Shield size={18} color="#F59E0B" />
                    <span>Manage User Roles</span>
                  </div>
                  <ChevronRight size={16} opacity={0.5} />
                </button>
              )}

              {/* Fleet Courier Screen Switcher (for monitoring) */}
              {activeRidersList.length > 0 && (
                <>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', padding: '0.85rem 0.5rem 0.25rem', letterSpacing: '0.05em' }}>
                    Monitor Active Couriers
                  </div>
                  {activeRidersList.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        onSelectRole(r.rider_code);
                        onClose();
                      }}
                      style={drawerBtnStyle(currentRole === r.rider_code)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span>🏍️</span>
                        <span style={{ fontSize: '0.85rem' }}>{r.name}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: r.status === 'online' ? '#34D399' : '#94A3B8' }}>
                        ● {r.status || 'offline'}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}

          {/* Rider-Specific Views */}
          {userRole === 'rider' && (
            <>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', padding: '0.5rem 0.5rem 0.25rem', letterSpacing: '0.05em' }}>
                Courier Menu
              </div>

              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                fontSize: '0.82rem',
                color: '#93C5FD',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <CheckCircle size={16} color="#60A5FA" />
                <span>Authorized Active Courier</span>
              </div>

              <a
                href="https://wa.me/254700000000"
                target="_blank"
                rel="noreferrer"
                style={{
                  ...drawerBtnStyle(false),
                  textDecoration: 'none',
                  color: '#FFFFFF'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <MessageCircle size={18} color="#25D366" />
                  <span>Contact Dispatch (WhatsApp)</span>
                </div>
                <ExternalLink size={14} opacity={0.6} />
              </a>
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => {
              onClose();
              if (onBackToWebsite) onBackToWebsite();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#CBD5E1',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={16} /> Return to Website
          </button>

          <button
            onClick={() => {
              onClose();
              if (onSignOut) onSignOut();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#F87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

const drawerBtnStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '0.75rem 0.85rem',
  background: isActive ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
  border: isActive ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
  borderRadius: '10px',
  color: isActive ? '#60A5FA' : '#F1F5F9',
  fontSize: '0.9rem',
  fontWeight: isActive ? 700 : 500,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.15s ease'
});
