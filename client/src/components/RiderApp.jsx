import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Navigation, 
  CheckCircle, 
  Package, 
  DollarSign, 
  Wallet, 
  Phone, 
  MessageCircle, 
  Copy, 
  Check, 
  FileText, 
  Compass, 
  ExternalLink, 
  ShieldCheck, 
  Banknote, 
  Clock, 
  ArrowRight, 
  RefreshCw, 
  AlertTriangle, 
  ChevronRight, 
  Zap, 
  User, 
  Map, 
  AlertCircle, 
  Radio, 
  Bell, 
  BellOff, 
  ArrowLeft,
  Bike
} from 'lucide-react';
import { supabase } from '../supabase';
import { parseAddressAndNote } from '../utils/orderUtils';

// ── Sound Synthesizer (Zero External Audio File Dependency) ─────────────────────
const playSoundCue = (type = 'offer') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'offer') {
      // 3-tone attention chime (C5 -> E5 -> G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.2);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.22);
      });
    } else if (type === 'accept') {
      // Crisp 2-tone confirmation (A5 -> D6)
      const freqs = [880, 1174.66];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.18);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.2);
      });
    } else if (type === 'complete') {
      // Celebratory arpeggio (E5 -> G#5 -> B5 -> E6)
      const freqs = [659.25, 830.61, 987.77, 1318.51];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.25);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.27);
      });
    }
  } catch (e) {
    console.warn('AudioContext not allowed yet:', e);
  }
};

const triggerHaptic = (pattern = [150, 80, 150]) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignored
    }
  }
};

const formatKenyanPhone = (phone) => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
};

export default function RiderApp({ riderCode }) {
  const [rider, setRider] = useState({ status: 'offline', orders_completed: 0, earnings: 0 });
  const [activeOrder, setActiveOrder] = useState(null);
  const [isAssignedToMe, setIsAssignedToMe] = useState(false);
  const [historicalOrders, setHistoricalOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'earnings'
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('falcon_rider_sound') !== 'false';
  });
  const [copiedField, setCopiedField] = useState(null);
  const [isCompletingModal, setIsCompletingModal] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'today'

  const watchIdRef = useRef(null);
  const prevActiveOrderIdRef = useRef(null);

  const isOnline = rider.status !== 'offline';
  const isBusy = rider.status === 'busy';

  // Toggle Sound Preference
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('falcon_rider_sound', String(next));
      return next;
    });
  };

  // 1. Fetch Initial Rider Profile & Historical Orders
  const fetchRiderData = async () => {
    const { data: riderData } = await supabase
      .from('riders')
      .select('*')
      .eq('rider_code', riderCode)
      .maybeSingle();

    if (riderData) {
      setRider(riderData);
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('assigned_rider_id', riderData.id)
        .eq('status', 'delivered')
        .order('updated_at', { ascending: false });

      if (ordersData) setHistoricalOrders(ordersData);
    }
  };

  useEffect(() => {
    fetchRiderData();
  }, [riderCode]);

  // 2. Fetch Active Order (Either Assigned In-Progress OR Unassigned Pending Offer)
  const fetchActiveOrder = async () => {
    if (!rider.id) return;

    // Step A: Check if this rider already has an active, assigned order
    const { data: assigned } = await supabase
      .from('orders')
      .select('*')
      .eq('assigned_rider_id', rider.id)
      .neq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assigned) {
      setActiveOrder(assigned);
      setIsAssignedToMe(true);
      return;
    }

    // Step B: If rider is online and NOT busy, check for available pending offers
    if (isOnline && rider.status !== 'busy') {
      const { data: pending } = await supabase
        .from('orders')
        .select('*')
        .is('assigned_rider_id', null)
        .in('status', ['pending', 'paid'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pending) {
        // If a new offer just appeared, trigger audio/haptic alert
        if (prevActiveOrderIdRef.current !== pending.id && soundEnabled) {
          playSoundCue('offer');
          triggerHaptic([200, 100, 200]);
        }
        prevActiveOrderIdRef.current = pending.id;
        setActiveOrder(pending);
        setIsAssignedToMe(false);
      } else {
        prevActiveOrderIdRef.current = null;
        setActiveOrder(null);
        setIsAssignedToMe(false);
      }
    } else {
      setActiveOrder(null);
      setIsAssignedToMe(false);
    }
  };

  // 3. Realtime Watch for Orders & Rider Changes
  useEffect(() => {
    if (!rider.id) return;

    fetchActiveOrder();

    const dbChannel = supabase.channel(`rider-app-${rider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchActiveOrder();
        // If order delivered by this rider, update history
        if (payload.eventType === 'UPDATE' && payload.new.status === 'delivered' && payload.new.assigned_rider_id === rider.id) {
          setHistoricalOrders(prev => [payload.new, ...prev.filter(o => o.id !== payload.new.id)]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders', filter: `id=eq.${rider.id}` }, (payload) => {
        setRider(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
    };
  }, [rider.id, isOnline, rider.status, soundEnabled]);

  // 4. HTML5 GPS Tracking via Supabase Broadcast to 'rider-gps'
  useEffect(() => {
    if (!rider.id) return;
    const gpsChannel = supabase.channel('rider-gps');

    const startTracking = () => {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setCurrentCoords({ lat, lng });

            gpsChannel.send({
              type: 'broadcast',
              event: 'location_update',
              payload: { riderId: rider.id, lat, lng }
            });
          },
          (error) => console.warn('Rider GPS Warning:', error.message),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      }
    };

    const stopTracking = () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    if (isOnline) {
      gpsChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') startTracking();
      });
    } else {
      stopTracking();
      supabase.removeChannel(gpsChannel);
    }

    return () => {
      stopTracking();
      supabase.removeChannel(gpsChannel);
    };
  }, [isOnline, rider.id]);

  // ── Action Handlers ─────────────────────────────────────────────────────────

  const handleToggleOnline = async (e) => {
    const newStatus = e.target.checked ? 'online' : 'offline';
    await supabase.from('riders').update({ status: newStatus }).eq('id', rider.id);
    setRider(prev => ({ ...prev, status: newStatus }));
  };

  const handleAcceptOrder = async () => {
    if (!activeOrder || !rider.id) return;
    setIsProcessingAction(true);

    try {
      // 1. First attempt atomic RPC claiming (locks row with FOR UPDATE SKIP LOCKED)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('claim_next_order', {
        p_rider_id: rider.id
      });

      if (!rpcErr && rpcData && rpcData.length > 0) {
        if (soundEnabled) playSoundCue('accept');
        triggerHaptic([100, 50, 100]);
        await fetchActiveOrder();
        setIsProcessingAction(false);
        return;
      }

      // 2. Fallback claim: if the RPC missed (e.g. order had status 'paid' or specific ID target)
      const { data: directClaim, error: directErr } = await supabase
        .from('orders')
        .update({
          assigned_rider_id: rider.id,
          status: activeOrder.status === 'paid' ? 'paid' : 'accepted'
        })
        .eq('id', activeOrder.id)
        .is('assigned_rider_id', null)
        .select();

      if (directErr || !directClaim || directClaim.length === 0) {
        alert('This delivery was just taken by another rider. Waiting for the next order...');
        setActiveOrder(null);
      } else {
        await supabase.from('riders').update({ status: 'busy' }).eq('id', rider.id);
        if (soundEnabled) playSoundCue('accept');
        triggerHaptic([100, 50, 100]);
        await fetchActiveOrder();
      }
    } catch (err) {
      console.error('Failed to claim order:', err);
      alert('Network error while claiming order. Please try again.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleMarkPickedUp = async () => {
    if (!activeOrder) return;
    setIsProcessingAction(true);
    try {
      await supabase.from('orders').update({ status: 'picked_up' }).eq('id', activeOrder.id);
      if (soundEnabled) playSoundCue('accept');
      triggerHaptic([80, 40, 80]);
      await fetchActiveOrder();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmDelivered = async () => {
    if (!activeOrder) return;
    setIsProcessingAction(true);
    try {
      await supabase.from('orders').update({ status: 'delivered' }).eq('id', activeOrder.id);
      
      const newCount = (rider.orders_completed || 0) + 1;
      const newEarnings = Number(rider.earnings || 0) + Number(activeOrder.fee || 0);

      await supabase.from('riders').update({
        status: 'online',
        orders_completed: newCount,
        earnings: newEarnings
      }).eq('id', rider.id);

      setRider(prev => ({
        ...prev,
        status: 'online',
        orders_completed: newCount,
        earnings: newEarnings
      }));

      if (soundEnabled) playSoundCue('complete');
      triggerHaptic([100, 50, 100, 50, 200]);

      setIsCompletingModal(false);
      setActiveOrder(null);
      setIsAssignedToMe(false);
      await fetchRiderData();
    } catch (e) {
      console.error(e);
      alert('Could not update order status. Please check your internet connection.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Google Maps Turn-by-Turn URL Generator
  const getGoogleMapsUrl = (address, lat, lng) => {
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || '')}`;
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Parse Dropoff Address & Personal Delivery Note
  const dropoffInfo = activeOrder ? parseAddressAndNote(activeOrder.dropoff_address) : { address: '', note: null };
  const isPrepaid = activeOrder && (activeOrder.status === 'paid' || !!activeOrder.mpesa_receipt);

  // Filter Historical Orders
  const filteredHistory = historicalOrders.filter(order => {
    if (historyFilter === 'today') {
      const orderDate = new Date(order.updated_at || order.created_at).toDateString();
      const todayDate = new Date().toDateString();
      return orderDate === todayDate;
    }
    return true;
  });

  // Calculate Today's Earnings
  const todayEarnings = historicalOrders
    .filter(order => new Date(order.updated_at || order.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, o) => sum + Number(o.fee || 0), 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Finance & Trip History Screen
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeTab === 'earnings') {
    return (
      <div className="rider-app-wrapper">
        {/* Top Header */}
        <header className="rider-top-header">
          <div className="rider-top-bar">
            <div className="rider-identity">
              <button 
                onClick={() => setActiveTab('orders')}
                className="rider-icon-btn"
                title="Back to Orders"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="rider-name-title">{rider.name || 'Courier'}</h1>
                <span className="rider-code-tag">Earnings & History</span>
              </div>
            </div>
            <div className="rider-header-actions">
              <button 
                onClick={fetchRiderData}
                className="rider-icon-btn"
                title="Refresh Records"
              >
                <RefreshCw size={17} />
              </button>
            </div>
          </div>
        </header>

        {/* Tab Switcher */}
        <nav className="rider-nav-tabs">
          <button 
            className="rider-tab-btn" 
            onClick={() => setActiveTab('orders')}
          >
            <Package size={17} /> Active Deliveries
            {activeOrder && <span className="rider-tab-badge">1</span>}
          </button>
          <button 
            className="rider-tab-btn active" 
            onClick={() => setActiveTab('earnings')}
          >
            <Wallet size={17} /> My Earnings
          </button>
        </nav>

        {/* Earnings Content */}
        <div className="rider-body-content">
          {/* Finance Hero Card */}
          <div className="earnings-hero-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Gross Earnings
              </span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                Verified
              </span>
            </div>
            <div className="earnings-total-val">
              KES {Number(rider.earnings || 0).toLocaleString()}
            </div>
            
            <div className="earnings-stat-row">
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Total Trips</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                  {rider.orders_completed || historicalOrders.length}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Today's Revenue</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38BDF8', marginTop: '2px' }}>
                  KES {todayEarnings.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Delivery History Section */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1E293B' }}>Delivery Receipts</h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button 
                onClick={() => setHistoryFilter('all')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: historyFilter === 'all' ? '#0F172A' : '#E2E8F0',
                  color: historyFilter === 'all' ? '#FFFFFF' : '#64748B'
                }}
              >
                All ({historicalOrders.length})
              </button>
              <button 
                onClick={() => setHistoryFilter('today')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: historyFilter === 'today' ? '#0F172A' : '#E2E8F0',
                  color: historyFilter === 'today' ? '#FFFFFF' : '#64748B'
                }}
              >
                Today
              </button>
            </div>
          </div>

          {/* Receipts List */}
          <div className="earnings-history-list">
            {filteredHistory.map(order => (
              <div key={order.id} className="trip-receipt-card">
                <div className="receipt-top-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                      {order.order_number || `#${order.id.slice(0, 8)}`}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>•</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      {new Date(order.updated_at || order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="receipt-fee">
                    + KES {order.fee}
                  </div>
                </div>

                <div style={{ fontWeight: 700, color: '#1E293B', fontSize: '0.95rem' }}>
                  {order.customer_name}
                </div>

                <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: '#059669', fontWeight: 600 }}>{order.pickup_address}</span>
                  <ArrowRight size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                  <span style={{ color: '#2563EB', fontWeight: 600 }}>{parseAddressAndNote(order.dropoff_address).address}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #F1F5F9' }}>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                    {new Date(order.updated_at || order.created_at).toLocaleDateString()}
                  </span>
                  {order.mpesa_receipt ? (
                    <span style={{ fontSize: '0.7rem', background: '#ECFDF5', color: '#059669', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                      M-Pesa: {order.mpesa_receipt}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                      Cash on Delivery
                    </span>
                  )}
                </div>
              </div>
            ))}

            {filteredHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1', color: '#94A3B8' }}>
                <Clock size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, color: '#64748B', fontSize: '0.95rem' }}>No deliveries found</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Completed trips will appear here with receipts.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Orders & Active Mission Screen
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="rider-app-wrapper">
      {/* 1. Driver Top Header */}
      <header className="rider-top-header">
        <div className="rider-top-bar">
          <div className="rider-identity">
            <div className="rider-avatar-badge">
              <Bike size={22} />
            </div>
            <div>
              <h1 className="rider-name-title">{rider.name || 'Falcon Rider'}</h1>
              <span className="rider-code-tag">
                {rider.rider_code ? rider.rider_code.toUpperCase().replace('_', ' ') : 'COURIER #1'}
              </span>
            </div>
          </div>

          <div className="rider-header-actions">
            {/* Audio / Mute Toggle */}
            <button 
              onClick={toggleSound}
              className={`rider-icon-btn ${soundEnabled ? 'active' : ''}`}
              title={soundEnabled ? 'Order Alerts: Sound ON' : 'Order Alerts: Muted'}
            >
              {soundEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
            
            {/* Manual Sync */}
            <button 
              onClick={() => { fetchRiderData(); fetchActiveOrder(); }}
              className="rider-icon-btn"
              title="Sync Orders"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </div>

        {/* Online / Offline Status Toggle Bar */}
        <div className="rider-status-bar">
          <div className="rider-status-indicator">
            <div className={`rider-pulse-dot ${isBusy ? 'busy' : isOnline ? 'online' : 'offline'}`} />
            <div>
              <div className="rider-status-text">
                {isBusy ? 'ON DELIVERY MISSION' : isOnline ? 'ONLINE & AVAILABLE' : 'OFFLINE'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '1px' }}>
                {isBusy ? 'Active trip in progress' : isOnline ? 'Receiving delivery dispatches' : 'Toggle switch to go online'}
              </div>
            </div>
          </div>

          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={isOnline} 
              onChange={handleToggleOnline}
              disabled={isBusy}
            />
            <span className="slider"></span>
          </label>
        </div>

        {/* Quick Daily Stats Strip */}
        <div className="rider-stats-strip">
          <div className="rider-stat-box">
            <div className="rider-stat-val">{rider.orders_completed || 0}</div>
            <div className="rider-stat-label">Trips Done</div>
          </div>
          <div className="rider-stat-box">
            <div className="rider-stat-val" style={{ color: '#34D399' }}>
              KES {rider.earnings || 0}
            </div>
            <div className="rider-stat-label">Gross KES</div>
          </div>
          <div className="rider-stat-box">
            <div className="rider-stat-val" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#60A5FA' }}>
              <Radio size={14} style={{ animation: isOnline ? 'spin 3s linear infinite' : 'none' }} />
              {isOnline ? 'LIVE' : 'IDLE'}
            </div>
            <div className="rider-stat-label">GPS Channel</div>
          </div>
        </div>
      </header>

      {/* Segmented Navigation Tab Switcher */}
      <nav className="rider-nav-tabs">
        <button 
          className="rider-tab-btn active" 
          onClick={() => setActiveTab('orders')}
        >
          <Package size={17} /> Active Deliveries
          {activeOrder && <span className="rider-tab-badge">1</span>}
        </button>
        <button 
          className="rider-tab-btn" 
          onClick={() => setActiveTab('earnings')}
        >
          <Wallet size={17} /> My Earnings
        </button>
      </nav>

      {/* Main Body Screen */}
      <main className="rider-body-content">
        {/* CASE A: INCOMING DELIVERY OFFER (Unassigned pending order available to accept) */}
        {activeOrder && !isAssignedToMe && (
          <div className="incoming-offer-card">
            <div className="offer-header-banner">
              <div className="offer-alert-pill">
                <Zap size={14} /> NEW DELIVERY OFFER
              </div>
              <div className="offer-fee-highlight">
                <div className="offer-fee-number">KES {activeOrder.fee}</div>
                <div className="offer-fee-caption">Guaranteed Payout</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>
                Order {activeOrder.order_number || `#${activeOrder.id.slice(0, 8)}`}
              </span>
              {isPrepaid ? (
                <span style={{ fontSize: '0.72rem', background: '#ECFDF5', color: '#059669', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  Prepaid M-Pesa
                </span>
              ) : (
                <span style={{ fontSize: '0.72rem', background: '#FFFBEB', color: '#D97706', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  Cash on Delivery
                </span>
              )}
            </div>

            {/* Route Timeline */}
            <div className="route-timeline-card">
              <div className="route-stop-item">
                <div className="stop-marker-dot pickup">
                  <Package size={13} />
                </div>
                <div className="stop-details">
                  <div className="stop-tag pickup">Pickup Location</div>
                  <div className="stop-address">{activeOrder.pickup_address}</div>
                </div>
              </div>

              <div className="route-stop-item">
                <div className="stop-marker-dot dropoff">
                  <MapPin size={13} />
                </div>
                <div className="stop-details">
                  <div className="stop-tag dropoff">Customer Destination</div>
                  <div className="stop-address">{dropoffInfo.address}</div>
                </div>
              </div>
            </div>

            {/* Note Preview if present */}
            {dropoffInfo.note && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '10px', padding: '0.6rem 0.8rem', marginBottom: '1rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <FileText size={15} style={{ color: '#B45309', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', color: '#78350F', fontWeight: 600 }}>
                  Note: {dropoffInfo.note}
                </span>
              </div>
            )}

            {/* Big Tactile Accept Button */}
            <button 
              onClick={handleAcceptOrder}
              disabled={isProcessingAction}
              className="btn-accept-order"
            >
              {isProcessingAction ? (
                <>Securing Delivery...</>
              ) : (
                <>
                  <CheckCircle size={22} /> ACCEPT ORDER (KES {activeOrder.fee})
                </>
              )}
            </button>
          </div>
        )}

        {/* CASE B: ACTIVE IN-PROGRESS TRIP (Claimed and Assigned to This Rider) */}
        {activeOrder && isAssignedToMe && (
          <div className="rider-trip-card">
            {/* Top Order Badge & Fee */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.6rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>ACTIVE TRIP</span>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                  {activeOrder.order_number || `#${activeOrder.id.slice(0, 8)}`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>DELIVERY FEE</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
                  KES {activeOrder.fee}
                </div>
              </div>
            </div>

            {/* 4-Step Order Lifecycle Stepper */}
            <div className="rider-trip-stepper">
              <div className="stepper-step completed">
                <div className="stepper-bubble">
                  <Check size={14} />
                </div>
                <div className="stepper-label">Accepted</div>
              </div>

              <div className={`stepper-step ${activeOrder.status === 'accepted' ? 'active' : 'completed'}`}>
                <div className="stepper-bubble">
                  {activeOrder.status === 'accepted' ? '2' : <Check size={14} />}
                </div>
                <div className="stepper-label">At Pickup</div>
              </div>

              <div className={`stepper-step ${activeOrder.status === 'picked_up' ? 'active' : ''}`}>
                <div className="stepper-bubble">
                  3
                </div>
                <div className="stepper-label">In Transit</div>
              </div>

              <div className="stepper-step">
                <div className="stepper-bubble">
                  4
                </div>
                <div className="stepper-label">Delivered</div>
              </div>
            </div>

            {/* Current Phase Mission Banner with 1-Tap Google Maps Navigation */}
            {activeOrder.status === 'accepted' ? (
              <div className="mission-action-banner">
                <div className="mission-top-row">
                  <span className="mission-phase-badge">MISSION STEP 1: PICKUP</span>
                  <span style={{ fontSize: '0.75rem', color: '#93C5FD', fontWeight: 600 }}>Collect Package</span>
                </div>
                <div className="mission-target-address">
                  {activeOrder.pickup_address}
                </div>
                <a
                  href={getGoogleMapsUrl(activeOrder.pickup_address, activeOrder.pickup_lat, activeOrder.pickup_lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-nav-launch"
                  title="Open GPS Navigation in Google Maps"
                >
                  <Navigation size={18} /> OPEN GOOGLE MAPS TO PICKUP
                </a>
              </div>
            ) : (
              <div className="mission-action-banner">
                <div className="mission-top-row">
                  <span className="mission-phase-badge" style={{ background: '#10B981' }}>
                    MISSION STEP 2: DELIVER
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#A7F3D0', fontWeight: 600 }}>Head to Customer</span>
                </div>
                <div className="mission-target-address">
                  {dropoffInfo.address}
                </div>
                <a
                  href={getGoogleMapsUrl(dropoffInfo.address, activeOrder.dropoff_lat, activeOrder.dropoff_lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-nav-launch"
                  style={{ background: '#059669' }}
                  title="Open GPS Navigation in Google Maps"
                >
                  <Navigation size={18} /> OPEN GOOGLE MAPS TO CUSTOMER
                </a>
              </div>
            )}

            {/* Customer Contact & Communication Strip */}
            {activeOrder.customer_name && (
              <div className="customer-comm-strip">
                <div className="comm-cust-info">
                  <div className="comm-cust-name">{activeOrder.customer_name}</div>
                  <div className="comm-cust-phone">
                    {activeOrder.customer_phone || 'No phone number'}
                  </div>
                </div>

                {activeOrder.customer_phone && (
                  <div className="comm-action-buttons">
                    <a 
                      href={`tel:${activeOrder.customer_phone}`} 
                      className="comm-btn comm-btn-call"
                      title="Direct Phone Call"
                    >
                      <Phone size={14} /> Call
                    </a>
                    
                    <a
                      href={`https://wa.me/${formatKenyanPhone(activeOrder.customer_phone)}?text=${encodeURIComponent(
                        `Hello ${activeOrder.customer_name}, this is ${rider.name || 'your courier'} from Falcon Delivery. I am handling your delivery order #${activeOrder.order_number || activeOrder.id.slice(0, 8)}.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="comm-btn comm-btn-wa"
                      title="WhatsApp Customer"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeOrder.customer_phone, 'phone')}
                      className="comm-btn comm-btn-copy"
                      title="Copy customer phone"
                    >
                      {copiedField === 'phone' ? <Check size={14} style={{ color: '#059669' }} /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Route Details Card */}
            <div className="route-timeline-card">
              <div className="route-stop-item">
                <div className="stop-marker-dot pickup">
                  <Package size={13} />
                </div>
                <div className="stop-details">
                  <div className="stop-tag pickup">Pickup Location</div>
                  <div className="stop-address">{activeOrder.pickup_address}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(activeOrder.pickup_address, 'pickup')}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                  title="Copy pickup address"
                >
                  {copiedField === 'pickup' ? <Check size={14} style={{ color: '#059669' }} /> : <Copy size={14} />}
                </button>
              </div>

              <div className="route-stop-item">
                <div className="stop-marker-dot dropoff">
                  <MapPin size={13} />
                </div>
                <div className="stop-details">
                  <div className="stop-tag dropoff">Dropoff Location</div>
                  <div className="stop-address">{dropoffInfo.address}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(dropoffInfo.address, 'dropoff')}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                  title="Copy destination address"
                >
                  {copiedField === 'dropoff' ? <Check size={14} style={{ color: '#059669' }} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* CEO Personal Delivery Note (If added during dispatch) */}
            {dropoffInfo.note && (
              <div className="rider-instruction-card">
                <FileText size={20} style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                    Delivery Instructions / Note
                  </div>
                  <div className="instruction-text">
                    "{dropoffInfo.note}"
                  </div>
                </div>
              </div>
            )}

            {/* Payment Responsibility Notice (HIGH VISIBILITY FOR KENYAN RIDERS) */}
            {isPrepaid ? (
              <div className="rider-payment-box paid">
                <ShieldCheck size={24} style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div className="payment-box-title">
                    ✅ PREPAID VIA M-PESA — DO NOT COLLECT CASH
                  </div>
                  <div className="payment-box-sub">
                    Customer has already completed payment. Hand over the items without asking for payment.
                  </div>
                  {activeOrder.mpesa_receipt && (
                    <div style={{ marginTop: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#047857' }}>
                      Receipt: {activeOrder.mpesa_receipt}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rider-payment-box unpaid">
                <Banknote size={24} style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div className="payment-box-title">
                    💵 CASH ON DELIVERY — COLLECT KES {activeOrder.fee}
                  </div>
                  <div className="payment-box-sub">
                    Payment is UNPAID. Collect KES {activeOrder.fee} in cash or via customer's M-Pesa before handing over the parcel.
                  </div>
                </div>
              </div>
            )}

            {/* Primary Bottom Lifecycle Action Button */}
            {activeOrder.status === 'accepted' && (
              <button 
                onClick={handleMarkPickedUp}
                disabled={isProcessingAction}
                className="btn-trip-lifecycle pickup"
              >
                <Package size={22} /> CONFIRM PACKAGE PICKED UP
              </button>
            )}

            {activeOrder.status === 'picked_up' && (
              <button 
                onClick={() => setIsCompletingModal(true)}
                disabled={isProcessingAction}
                className="btn-trip-lifecycle delivered"
              >
                <CheckCircle size={22} /> COMPLETE DELIVERY TRIP
              </button>
            )}
          </div>
        )}

        {/* CASE C: IDLE RADAR SEARCHING (Online, No Active Order) */}
        {!activeOrder && isOnline && (
          <div className="radar-searching-wrapper">
            <div className="radar-graphic-box">
              <div className="radar-ring" />
              <div className="radar-ring" />
              <div className="radar-ring" />
              <div className="radar-center-beacon">
                <Compass size={28} />
              </div>
            </div>

            <h3 className="radar-status-title">Searching for orders...</h3>
            <p className="radar-status-sub">
              You are online and visible to Falcon Dispatch. New delivery requests will ring on your phone automatically.
            </p>

            <div className="radar-gps-badge">
              <Radio size={14} />
              <span>
                {currentCoords ? `GPS Live (${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)})` : 'GPS Connected & Broadcasting'}
              </span>
            </div>

            <div style={{ marginTop: '2.5rem', width: '100%', maxWidth: '340px', background: '#FFFFFF', padding: '1rem', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'left' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} style={{ color: '#F59E0B' }} /> Pro-Rider Tips:
              </div>
              <ul style={{ fontSize: '0.78rem', color: '#64748B', paddingLeft: '1.2rem', lineHeight: 1.5 }}>
                <li>Keep screen active while on the road.</li>
                <li>Ensure phone volume is up for audio chimes.</li>
                <li>Always confirm cash collection before completing COD trips.</li>
              </ul>
            </div>
          </div>
        )}

        {/* CASE D: OFFLINE STATE */}
        {!activeOrder && !isOnline && (
          <div className="rider-offline-box">
            <div className="offline-icon-circle">
              <Bike size={38} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.5rem' }}>
              You are currently Offline
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#64748B', maxWidth: '300px', lineHeight: 1.4, marginBottom: '1.5rem' }}>
              Switch to Online mode to receive new delivery orders and track your earnings.
            </p>

            <button 
              onClick={() => handleToggleOnline({ target: { checked: true } })}
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                padding: '0.9rem 2rem',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '1rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Zap size={18} style={{ color: '#10B981' }} /> GO ONLINE NOW
            </button>
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────────────────
          CONFIRMATION MODAL: Complete Delivery
          Prevents accidental pocket taps when on motorbikes
         ───────────────────────────────────────────────────────────────────────── */}
      {isCompletingModal && activeOrder && (
        <div className="rider-modal-backdrop" onClick={() => setIsCompletingModal(false)}>
          <div className="rider-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                Complete Delivery Trip?
              </h3>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, background: '#F1F5F9', color: '#475569', padding: '3px 8px', borderRadius: '6px' }}>
                {activeOrder.order_number || `#${activeOrder.id.slice(0, 8)}`}
              </span>
            </div>

            <div style={{ background: '#F8FAFC', borderRadius: '14px', padding: '1rem', marginBottom: '1rem', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Recipient:</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.5rem' }}>
                {activeOrder.customer_name}
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Destination:</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                {dropoffInfo.address}
              </div>
            </div>

            {/* Payment Check Before Finishing */}
            {isPrepaid ? (
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <ShieldCheck size={20} style={{ color: '#059669', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', color: '#065F46', fontWeight: 600 }}>
                  Prepaid Order: Payment already received via M-Pesa.
                </span>
              </div>
            ) : (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Banknote size={20} style={{ color: '#D97706', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', color: '#92400E', fontWeight: 700 }}>
                  Ensure you collected KES {activeOrder.fee} cash from the customer!
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.75rem' }}>
              <button 
                onClick={() => setIsCompletingModal(false)}
                style={{
                  padding: '0.9rem',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button 
                onClick={handleConfirmDelivered}
                disabled={isProcessingAction}
                style={{
                  padding: '0.9rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                {isProcessingAction ? 'Finishing...' : 'Yes, Order Delivered'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
