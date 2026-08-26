import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, CheckCircle, Package } from 'lucide-react';
import { supabase } from '../supabase';

export default function RiderApp({ riderCode }) {
  const [rider, setRider] = useState({ status: 'offline', orders_completed: 0, earnings: 0 });
  const [activeOrder, setActiveOrder] = useState(null);
  const watchIdRef = useRef(null);
  
  const isOnline = rider.status !== 'offline';

  // 1. Fetch Initial Rider Data
  useEffect(() => {
    const fetchRider = async () => {
      const { data, error } = await supabase.from('riders').select('*').eq('rider_code', riderCode).single();
      if (data) setRider(data);
    };
    fetchRider();
  }, [riderCode]);

  // 2. Watch for Orders & Rider DB Updates
  useEffect(() => {
    if (!rider.id) return;

    const fetchOrders = async () => {
      // Find active assigned order
      const { data: assigned } = await supabase.from('orders').select('*').eq('assigned_rider_id', rider.id).neq('status', 'delivered').single();
      if (assigned) {
        setActiveOrder(assigned);
        return;
      }
      
      // Find pending orders to accept if online and not busy
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
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
            
            // Broadcast high-frequency ping (doesn't hit DB limits)
            gpsChannel.send({
              type: 'broadcast',
              event: 'location_update',
              payload: { riderId: rider.id, lat, lng }
            });

            // Every few updates, we can update DB for persistence if needed, 
            // but broadcast is fine for the CEO map.
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

  return (
    <div className="rider-app">
      <div className="rider-header">
        <h2 className="text-xl font-bold mb-4">{rider.name}</h2>
        <div className="flex justify-between items-center bg-white" style={{ padding: '1rem', borderRadius: '12px', color: '#1E293B' }}>
          <div className="font-bold">
            Status: <span className={`status-badge status-${rider.status}`}>{rider.status}</span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={isOnline} onChange={toggleStatus} disabled={rider.status === 'busy'} />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      <div className="p-4" style={{ flex: 1 }}>
        {activeOrder ? (
          <div className="card order-card">
            <div className="flex justify-between mb-4">
              <span className="font-bold bg-gray-100 px-2 py-1 rounded" style={{ backgroundColor: '#F1F5F9', borderRadius: '4px', fontSize: '0.8rem' }}>
                {activeOrder.order_number}
              </span>
              <span className="font-bold text-accent-color">KES {activeOrder.fee}</span>
            </div>
            
            <h3 className="font-bold text-xl mb-3">{activeOrder.customer_name}</h3>
            
            <div className="mb-3 flex items-start gap-2">
              <Package size={18} className="text-gray mt-1" />
              <div>
                <div className="font-bold" style={{ fontSize: '0.8rem' }}>PICKUP</div>
                <div>{activeOrder.pickup_address}</div>
              </div>
            </div>
            
            <div className="mb-4 flex items-start gap-2">
              <MapPin size={18} className="text-secondary-color mt-1" />
              <div>
                <div className="font-bold text-secondary-color" style={{ fontSize: '0.8rem' }}>DROPOFF</div>
                <div>{activeOrder.dropoff_address}</div>
              </div>
            </div>

            {activeOrder.status === 'pending' && (
              <button className="btn btn-primary w-full justify-center py-3" onClick={handleAccept} style={{ padding: '1rem' }}>
                Accept Delivery Order
              </button>
            )}
            
            {activeOrder.status === 'accepted' && (
              <button className="btn btn-primary w-full justify-center py-3" onClick={() => handleUpdateStatus('picked_up')} style={{ padding: '1rem' }}>
                <Navigation size={18} /> Mark as Picked Up
              </button>
            )}
            
            {activeOrder.status === 'picked_up' && (
              <button className="btn btn-success w-full justify-center py-3" onClick={() => handleUpdateStatus('delivered')} style={{ padding: '1rem' }}>
                <CheckCircle size={18} /> Complete Delivery
              </button>
            )}
          </div>
        ) : (
          <div className="card text-center" style={{ padding: '3rem 1rem' }}>
            <div className="text-gray mb-3" style={{ opacity: 0.5 }}>
              <Navigation size={48} className="mx-auto" />
            </div>
            {isOnline ? (
              <h3 className="font-bold text-xl">Searching for orders...</h3>
            ) : (
              <h3 className="font-bold text-xl text-gray">You are offline</h3>
            )}
            <p className="text-gray mt-2" style={{ fontSize: '0.9rem' }}>
              {isOnline ? "Stay online to receive new delivery requests." : "Toggle your status to online to start receiving orders."}
            </p>
          </div>
        )}

        <div className="grid mt-4 gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div className="card text-center" style={{ padding: '1rem' }}>
            <div className="text-2xl font-bold">{rider.orders_completed}</div>
            <div className="text-gray" style={{ fontSize: '0.8rem' }}>Orders Today</div>
          </div>
          <div className="card text-center" style={{ padding: '1rem' }}>
            <div className="text-2xl font-bold text-accent-color">KES {rider.earnings}</div>
            <div className="text-gray" style={{ fontSize: '0.8rem' }}>Earnings</div>
          </div>
        </div>
      </div>
    </div>
  );
}
