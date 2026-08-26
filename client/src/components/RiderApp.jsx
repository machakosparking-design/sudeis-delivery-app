import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, CheckCircle, Package, DollarSign, ListOrdered, Wallet } from 'lucide-react';
import { supabase } from '../supabase';

export default function RiderApp({ riderCode }) {
  const [rider, setRider] = useState({ status: 'offline', orders_completed: 0, earnings: 0 });
  const [activeOrder, setActiveOrder] = useState(null);
  const [historicalOrders, setHistoricalOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'earnings'
  const watchIdRef = useRef(null);
  
  const isOnline = rider.status !== 'offline';

  // 1. Fetch Initial Rider Data & Historical Orders
  useEffect(() => {
    const fetchData = async () => {
      const { data: riderData } = await supabase.from('riders').select('*').eq('rider_code', riderCode).single();
      if (riderData) {
        setRider(riderData);
        const { data: ordersData } = await supabase.from('orders')
          .select('*')
          .eq('assigned_rider_id', riderData.id)
          .eq('status', 'delivered')
          .order('updated_at', { ascending: false });
        if (ordersData) setHistoricalOrders(ordersData);
      }
    };
    fetchData();
  }, [riderCode]);

  // 2. Watch for Orders & Rider DB Updates
  useEffect(() => {
    if (!rider.id) return;

    const fetchOrders = async () => {
      const { data: assigned } = await supabase.from('orders').select('*').eq('assigned_rider_id', rider.id).neq('status', 'delivered').single();
      if (assigned) {
        setActiveOrder(assigned);
        return;
      }
      
      if (isOnline && rider.status !== 'busy') {
        const { data: pending } = await supabase.from('orders').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(1).single();
        if (pending) setActiveOrder(pending);
        else setActiveOrder(null);
      } else {
        setActiveOrder(null);
      }
    };
    fetchOrders();

    const dbChannel = supabase.channel(`rider-${rider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        // Update historical orders if a new one is delivered
        if (payload.eventType === 'UPDATE' && payload.new.status === 'delivered' && payload.new.assigned_rider_id === rider.id) {
          setHistoricalOrders(prev => [payload.new, ...prev.filter(o => o.id !== payload.new.id)]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders', filter: `id=eq.${rider.id}` }, payload => setRider(payload.new))
      .subscribe();

    return () => supabase.removeChannel(dbChannel);
  }, [rider.id, isOnline, rider.status]);

  // 3. Handle HTML5 GPS Tracking via Supabase Broadcast
  useEffect(() => {
    if (!rider.id) return;
    const gpsChannel = supabase.channel('rider-gps');

    const startTracking = () => {
      if ("geolocation" in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            gpsChannel.send({
              type: 'broadcast',
              event: 'location_update',
              payload: { riderId: rider.id, lat, lng }
            });
          },
          (error) => console.error("GPS Error:", error),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }
    };

    const stopTracking = () => {
      if (watchIdRef.current !== null && "geolocation" in navigator) {
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

  const toggleStatus = async (e) => {
    const newStatus = e.target.checked ? 'online' : 'offline';
    await supabase.from('riders').update({ status: newStatus }).eq('id', rider.id);
  };

  const handleAccept = async () => {
    if (activeOrder && rider.id) {
      await supabase.from('orders').update({ status: 'accepted', assigned_rider_id: rider.id }).eq('id', activeOrder.id);
      await supabase.from('riders').update({ status: 'busy' }).eq('id', rider.id);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (activeOrder) {
      await supabase.from('orders').update({ status }).eq('id', activeOrder.id);
      
      if (status === 'delivered') {
        const newOrdersCount = (rider.orders_completed || 0) + 1;
        const newEarnings = Number(rider.earnings || 0) + Number(activeOrder.fee || 0);
        await supabase.from('riders').update({ 
          status: 'online', 
          orders_completed: newOrdersCount, 
          earnings: newEarnings 
        }).eq('id', rider.id);
      }
    }
  };

  if (activeTab === 'earnings') {
    return (
      <div className="rider-app">
        <div className="rider-header flex justify-between align-center">
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{rider.name}</h2>
          <button className="btn btn-outline" onClick={() => setActiveTab('orders')} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            Back to Orders
          </button>
        </div>

        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
          <div className="metric-grid">
            <div className="metric-card" style={{ borderTop: '4px solid var(--accent)' }}>
              <Wallet className="text-green" style={{ margin: '0 auto 8px auto' }} size={24} />
              <div className="metric-value">KES {rider.earnings}</div>
              <div className="metric-label">Total Earnings</div>
            </div>
            <div className="metric-card" style={{ borderTop: '4px solid var(--secondary)' }}>
              <ListOrdered className="text-blue" style={{ margin: '0 auto 8px auto' }} size={24} />
              <div className="metric-value">{rider.orders_completed}</div>
              <div className="metric-label">Total Deliveries</div>
            </div>
          </div>

          <div className="card-header" style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Delivery History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {historicalOrders.map(order => (
              <div key={order.id} style={{ backgroundColor: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <div className="flex justify-between" style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{new Date(order.updated_at).toLocaleDateString()}</div>
                  <div style={{ fontSize: '0.75rem', backgroundColor: '#D1FAE5', color: '#047857', padding: '2px 8px', borderRadius: '99px', fontWeight: '700' }}>DELIVERED</div>
                </div>
                <div className="font-bold" style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>{order.customer_name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{order.pickup_address} → {order.dropoff_address}</div>
                <div className="font-bold text-green" style={{ fontSize: '1.1rem' }}>KES {order.fee}</div>
              </div>
            ))}
            {historicalOrders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border-light)' }}>
                You haven't completed any deliveries yet.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rider-app">
      <div className="rider-header">
        <div className="flex justify-between align-center mb-4">
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{rider.name}</h2>
          <button className="btn" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => setActiveTab('earnings')}>
            <Wallet size={16} /> Earnings
          </button>
        </div>
        <div className="flex justify-between align-center" style={{ backgroundColor: 'white', padding: '1rem 1.25rem', borderRadius: '12px', color: 'var(--text-main)', boxShadow: 'var(--shadow-md)' }}>
          <div className="font-bold flex align-center gap-2">
            Status: <span className={`status-badge status-${rider.status}`}>{rider.status}</span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={isOnline} onChange={toggleStatus} disabled={rider.status === 'busy'} />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeOrder ? (
          <div className="card order-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between align-center mb-4" style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ backgroundColor: 'var(--bg-main)', padding: '4px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                {activeOrder.order_number}
              </span>
              <span className="font-bold text-green" style={{ fontSize: '1.25rem' }}>KES {activeOrder.fee}</span>
            </div>
            
            <h3 className="font-bold mb-4" style={{ fontSize: '1.5rem' }}>{activeOrder.customer_name}</h3>
            
            <div className="mb-4 flex align-center" style={{ gap: '1rem', backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '12px' }}>
              <Package size={24} className="text-muted" />
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>PICKUP</div>
                <div style={{ fontWeight: '500' }}>{activeOrder.pickup_address}</div>
              </div>
            </div>
            
            <div className="mb-4 flex align-center" style={{ gap: '1rem', backgroundColor: '#EFF6FF', padding: '1rem', borderRadius: '12px' }}>
              <MapPin size={24} className="text-blue" />
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--secondary)', letterSpacing: '0.05em' }}>DROPOFF</div>
                <div style={{ fontWeight: '500' }}>{activeOrder.dropoff_address}</div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
              {activeOrder.status === 'pending' && (
                <button className="btn btn-primary w-full" style={{ padding: '1rem', fontSize: '1.1rem' }} onClick={handleAccept}>
                  Accept Delivery
                </button>
              )}
              
              {activeOrder.status === 'accepted' && (
                <button className="btn btn-primary w-full" style={{ padding: '1rem', fontSize: '1.1rem' }} onClick={() => handleUpdateStatus('picked_up')}>
                  <Navigation size={20} /> Mark Picked Up
                </button>
              )}
              
              {activeOrder.status === 'picked_up' && (
                <button className="btn btn-success w-full" style={{ padding: '1rem', fontSize: '1.1rem' }} onClick={() => handleUpdateStatus('delivered')}>
                  <CheckCircle size={20} /> Complete Delivery
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '2rem', border: '2px dashed var(--border-light)', borderRadius: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
              <Navigation size={48} className={isOnline ? "text-blue" : "text-muted"} />
            </div>
            <h3 className="font-bold mb-2" style={{ fontSize: '1.5rem', color: isOnline ? 'var(--text-main)' : 'var(--text-muted)' }}>
              {isOnline ? "Searching for orders..." : "You are offline"}
            </h3>
            <p className="text-muted" style={{ fontSize: '0.95rem', maxWidth: '250px', lineHeight: '1.5' }}>
              {isOnline ? "Stay online to receive new delivery requests." : "Toggle your status to online at the top to start receiving orders."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
