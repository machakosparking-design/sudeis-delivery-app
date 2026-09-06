import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, CheckCircle, Package, DollarSign, ListOrdered, Wallet, Phone, MessageCircle, Copy, Check } from 'lucide-react';
import { supabase } from '../supabase';

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
  const [historicalOrders, setHistoricalOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'earnings'
  const [copiedPhone, setCopiedPhone] = useState(false);
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

    const fetchActiveOrder = async () => {
      // First check if this rider already has an assigned, in-progress order
      const { data: assigned } = await supabase
        .from('orders')
        .select('*')
        .eq('assigned_rider_id', rider.id)
        .neq('status', 'delivered')
        .single();

      if (assigned) {
        setActiveOrder(assigned);
        return;
      }
      // If rider is online and not busy, check if there is a pending order
      // (but DON'T auto-claim here — let the rider tap Accept, which calls the RPC)
      if (isOnline && rider.status !== 'busy') {
        const { data: pending } = await supabase
          .from('orders')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (pending) setActiveOrder(pending);
        else setActiveOrder(null);
      } else {
        setActiveOrder(null);
      }
    };
    fetchActiveOrder();

    const dbChannel = supabase.channel(`rider-${rider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchActiveOrder();
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
    if (!activeOrder || !rider.id) return;

    // Use the atomic RPC to claim the order — this uses FOR UPDATE SKIP LOCKED
    // at the DB level so two riders cannot accept the same order simultaneously.
    const { data, error } = await supabase.rpc('claim_next_order', {
      p_rider_id: rider.id
    });

    if (error) {
      console.error('Failed to claim order:', error.message);
      alert('This order was already taken by another rider. Please wait for the next one.');
      setActiveOrder(null);
    } else if (!data || data.length === 0) {
      // Another rider beat us to it
      alert('This order was already taken. Searching for the next available order...');
      setActiveOrder(null);
    }
    // The realtime subscription will update activeOrder automatically
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
      <div className="rider-app bg-gray-50 flex flex-col h-full">
        <div className="rider-header flex justify-between items-center bg-white shadow-sm pb-4 pt-6 px-6">
          <h2 className="text-xl font-bold">{rider.name} - Finance</h2>
          <button className="btn btn-outline text-sm" onClick={() => setActiveTab('orders')}>
            Back to Orders
          </button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ flex: 1 }}>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card text-center p-6 border-t-4 border-green-500 shadow-sm bg-white">
              <Wallet className="text-green-500 mx-auto mb-2" size={28} />
              <div className="text-3xl font-bold text-gray-800">KES {rider.earnings}</div>
              <div className="text-gray-500 text-sm font-medium mt-1">Total Gross Earnings</div>
            </div>
            <div className="card text-center p-6 border-t-4 border-blue-500 shadow-sm bg-white">
              <ListOrdered className="text-blue-500 mx-auto mb-2" size={28} />
              <div className="text-3xl font-bold text-gray-800">{rider.orders_completed}</div>
              <div className="text-gray-500 text-sm font-medium mt-1">Total Deliveries</div>
            </div>
          </div>

          <h3 className="font-bold text-lg text-gray-700 mb-3 px-1">Delivery History</h3>
          <div className="space-y-3">
            {historicalOrders.map(order => (
              <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <div className="text-xs text-gray-400 font-semibold mb-1">{new Date(order.updated_at).toLocaleDateString()}</div>
                  <div className="font-bold text-gray-800">{order.customer_name}</div>
                  <div className="text-xs text-gray-500 mt-1 max-w-[200px] truncate">{order.pickup_address} → {order.dropoff_address}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 text-lg">KES {order.fee}</div>
                  <div className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-wider font-bold">Delivered</div>
                </div>
              </div>
            ))}
            {historicalOrders.length === 0 && (
              <div className="text-center py-10 text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100">
                You haven't completed any deliveries yet.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rider-app flex flex-col h-full">
      <div className="rider-header pb-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{rider.name}</h2>
          <button className="btn bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={() => setActiveTab('earnings')}>
            <Wallet size={16} className="inline mr-1" /> My Earnings
          </button>
        </div>
        <div className="flex justify-between items-center bg-white" style={{ padding: '1rem', borderRadius: '12px', color: '#1E293B', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div className="font-bold flex items-center gap-2">
            Status: <span className={`status-badge status-${rider.status}`}>{rider.status}</span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={isOnline} onChange={toggleStatus} disabled={rider.status === 'busy'} />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      <div className="p-4" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeOrder ? (
          <div className="card order-card shadow-lg border-2 border-primary-color/20">
            <div className="flex justify-between mb-4 pb-3 border-b border-gray-100">
              <span className="font-bold bg-gray-100 px-3 py-1 rounded-md text-sm text-gray-600">
                {activeOrder.order_number}
              </span>
              <span className="font-bold text-green-600 text-lg">KES {activeOrder.fee}</span>
            </div>
            
            <h3 className="font-bold text-2xl mb-3 text-gray-800">{activeOrder.customer_name}</h3>
            
            {/* Customer Contact Bar (Phone Features for Rider) */}
            {activeOrder.customer_phone && (
              <div className="mb-4 bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-xl flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <Phone size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Customer Phone</div>
                    <div className="font-mono font-bold text-gray-800 text-sm truncate">
                      {activeOrder.customer_phone}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`tel:${activeOrder.customer_phone}`}
                    className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1 font-semibold"
                    title="Direct Phone Call"
                  >
                    <Phone size={13} /> Call
                  </a>
                  <a
                    href={`https://wa.me/${formatKenyanPhone(activeOrder.customer_phone)}?text=${encodeURIComponent(`Hello ${activeOrder.customer_name}, this is ${rider.name} from Falcon Delivery. I am handling your delivery (${activeOrder.order_number}).`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn py-1.5 px-3 text-xs flex items-center gap-1 font-semibold"
                    style={{ backgroundColor: '#25D366', color: 'white' }}
                    title="Chat on WhatsApp"
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeOrder.customer_phone);
                      setCopiedPhone(true);
                      setTimeout(() => setCopiedPhone(false), 2000);
                    }}
                    className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
                    title="Copy phone"
                  >
                    {copiedPhone ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}
            
            <div className="mb-4 flex items-start gap-3 bg-gray-50 p-3 rounded-lg">
              <Package size={20} className="text-gray-500 mt-0.5" />
              <div>
                <div className="font-bold text-xs text-gray-500 tracking-wider mb-1">PICKUP</div>
                <div className="font-medium text-gray-800">{activeOrder.pickup_address}</div>
              </div>
            </div>
            
            <div className="mb-6 flex items-start gap-3 bg-blue-50 p-3 rounded-lg">
              <MapPin size={20} className="text-blue-500 mt-0.5" />
              <div>
                <div className="font-bold text-xs text-blue-500 tracking-wider mb-1">DROPOFF</div>
                <div className="font-medium text-gray-800">{activeOrder.dropoff_address}</div>
              </div>
            </div>

            {activeOrder.status === 'pending' && (
              <button className="btn btn-primary w-full justify-center py-4 text-lg shadow-md hover:shadow-lg transition-all" onClick={handleAccept}>
                Accept Delivery Order
              </button>
            )}
            
            {activeOrder.status === 'accepted' && (
              <button className="btn btn-primary w-full justify-center py-4 text-lg shadow-md hover:shadow-lg transition-all" onClick={() => handleUpdateStatus('picked_up')}>
                <Navigation size={20} className="mr-2" /> Mark as Picked Up
              </button>
            )}
            
            {activeOrder.status === 'picked_up' && (
              <button className="btn btn-success w-full justify-center py-4 text-lg shadow-md hover:shadow-lg transition-all" onClick={() => handleUpdateStatus('delivered')}>
                <CheckCircle size={20} className="mr-2" /> Complete Delivery
              </button>
            )}
          </div>
        ) : (
          <div className="card text-center flex flex-col justify-center items-center h-full border-dashed border-2 border-gray-200">
            <div className="text-gray-300 mb-4 bg-gray-50 p-4 rounded-full">
              <Navigation size={48} />
            </div>
            {isOnline ? (
              <h3 className="font-bold text-2xl text-gray-800">Searching for orders...</h3>
            ) : (
              <h3 className="font-bold text-2xl text-gray-400">You are offline</h3>
            )}
            <p className="text-gray-500 mt-3 max-w-[250px] mx-auto text-sm">
              {isOnline ? "Stay online and keep the app open to receive new delivery requests." : "Toggle your status to online at the top to start receiving orders."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
