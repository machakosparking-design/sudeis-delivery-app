import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Send, MapPin, Package, Smartphone, DollarSign, Activity, Users } from 'lucide-react';
import { supabase } from '../supabase';

// Fix Leaflet default icon path issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createRiderIcon = (status) => {
  const color = status === 'online' ? '#10B981' : status === 'busy' ? '#F59E0B' : '#64748B';
  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

export default function CEOAdminPanel() {
  const [riders, setRiders] = useState({});
  const [orders, setOrders] = useState([]);
  const [formData, setFormData] = useState({ customerName: '', customerPhone: '', pickup: '', dropoff: '', fee: '' });
  const [paymentStatus, setPaymentStatus] = useState(null);

  useEffect(() => {
    // 1. Fetch Initial Data
    const fetchInitialData = async () => {
      const { data: ridersData } = await supabase.from('riders').select('*');
      const { data: ordersData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      
      if (ridersData) {
        const rMap = {};
        ridersData.forEach(r => rMap[r.id] = r);
        setRiders(rMap);
      }
      if (ordersData) setOrders(ordersData);
    };
    fetchInitialData();

    // 2. Listen to Database Changes (Orders & Rider Statuses)
    const dbChannel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setRiders(prev => ({ ...prev, [payload.new.id]: { ...prev[payload.new.id], ...payload.new } }));
        }
      })
      .subscribe();

    // 3. Listen to Realtime Broadcasts (High-frequency GPS Pings)
    const gpsChannel = supabase.channel('rider-gps')
      .on('broadcast', { event: 'location_update' }, ({ payload }) => {
        setRiders(prev => {
          if (!prev[payload.riderId]) return prev;
          return {
            ...prev,
            [payload.riderId]: { ...prev[payload.riderId], current_lat: payload.lat, current_lng: payload.lng }
          };
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(gpsChannel);
    };
  }, []);

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!formData.customerName || !formData.fee) return;
    
    // Generate dummy coordinates for Nairobi testing
    const pickupLat = -1.2921 + (Math.random() * 0.01 - 0.005);
    const pickupLng = 36.8219 + (Math.random() * 0.01 - 0.005);
    const dropoffLat = -1.2921 + (Math.random() * 0.01 - 0.005);
    const dropoffLng = 36.8219 + (Math.random() * 0.01 - 0.005);

    const { data, error } = await supabase.from('orders').insert([{
      order_number: `ORD-${Date.now()}`,
      customer_name: formData.customerName,
      customer_phone: formData.customerPhone,
      pickup_address: formData.pickup,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_address: formData.dropoff,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
      fee: parseFloat(formData.fee)
    }]);

    if (!error) {
      setFormData({ customerName: '', customerPhone: '', pickup: '', dropoff: '', fee: '' });
      alert("Order dispatched to riders!");
    } else {
      alert("Error dispatching order: " + error.message);
    }
  };

  const triggerMpesa = async () => {
    if (!formData.customerPhone || !formData.fee) {
      alert("Please enter customer phone and fee to trigger M-Pesa");
      return;
    }
    
    setPaymentStatus('loading');
    try {
      // Call Supabase Edge Function to trigger Daraja STK Push
      const { data, error } = await supabase.functions.invoke('mpesa-stk', {
        body: { phone: formData.customerPhone, amount: formData.fee }
      });
      
      if (error) throw error;
      setPaymentStatus('success');
      setTimeout(() => setPaymentStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setPaymentStatus('error');
      alert("M-Pesa Trigger Failed");
    }
  };

  const totalOrders = orders.filter(o => o.status === 'delivered').length;
  const totalEarnings = Object.values(riders).reduce((acc, rider) => acc + Number(rider.earnings || 0), 0);
  const activeRiders = Object.values(riders).filter(r => r.status === 'online' || r.status === 'busy').length;

  const nairobiCenter = [-1.2921, 36.8219];

  return (
    <div className="dashboard-grid">
      <div className="sidebar">
        {/* Metrics Cards */}
        <div className="flex gap-4 mb-4">
          <div className="card w-full text-center" style={{ padding: '1rem' }}>
            <Activity className="text-gray mx-auto mb-2" size={24} />
            <div className="text-2xl font-bold">{totalOrders}</div>
            <div className="text-gray" style={{ fontSize: '0.8rem' }}>Orders Today</div>
          </div>
          <div className="card w-full text-center" style={{ padding: '1rem' }}>
            <DollarSign className="text-gray mx-auto mb-2" size={24} />
            <div className="text-2xl font-bold text-accent-color">KES {totalEarnings}</div>
            <div className="text-gray" style={{ fontSize: '0.8rem' }}>Revenue</div>
          </div>
          <div className="card w-full text-center" style={{ padding: '1rem' }}>
            <Users className="text-gray mx-auto mb-2" size={24} />
            <div className="text-2xl font-bold">{activeRiders}/3</div>
            <div className="text-gray" style={{ fontSize: '0.8rem' }}>Online</div>
          </div>
        </div>

        {/* Dispatch Form */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Package size={20} /> Create & Dispatch Order
          </h2>
          <form onSubmit={handleDispatch}>
            <div className="form-group">
              <label>Customer Name</label>
              <input type="text" className="form-control" name="customerName" value={formData.customerName} onChange={handleInputChange} required placeholder="e.g. John Doe" />
            </div>
            <div className="form-group">
              <label>Pickup Location</label>
              <input type="text" className="form-control" name="pickup" value={formData.pickup} onChange={handleInputChange} required placeholder="e.g. Westlands" />
            </div>
            <div className="form-group">
              <label>Delivery Location</label>
              <input type="text" className="form-control" name="dropoff" value={formData.dropoff} onChange={handleInputChange} required placeholder="e.g. Kilimani" />
            </div>
            <div className="flex gap-4 mb-4">
              <div className="form-group w-full">
                <label>Phone (M-Pesa)</label>
                <input type="text" className="form-control" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} required placeholder="2547..." />
              </div>
              <div className="form-group w-full">
                <label>Delivery Fee (KES)</label>
                <input type="number" className="form-control" name="fee" value={formData.fee} onChange={handleInputChange} required placeholder="Amount" />
              </div>
            </div>
            <div className="flex gap-4">
              <button type="submit" className="btn btn-primary w-full justify-center">
                <Send size={18} /> Dispatch to Riders
              </button>
              <button type="button" className="btn btn-success w-full justify-center" onClick={triggerMpesa}>
                <Smartphone size={18} /> 
                {paymentStatus === 'loading' ? 'Pushing...' : paymentStatus === 'success' ? 'Sent!' : 'STK Push'}
              </button>
            </div>
          </form>
        </div>

        {/* Active Orders List */}
        <div className="card" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <h3 className="font-bold mb-3">Recent Orders</h3>
          {orders.map(order => (
            <div key={order.id} className="p-3 mb-2 border-radius-8" style={{ border: '1px solid #E2E8F0', borderRadius: '8px' }}>
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold">{order.customer_name}</span>
                <span className={`status-badge status-${order.status === 'delivered' ? 'online' : (order.status === 'paid' ? 'online' : 'busy')}`} style={{ fontSize: '0.7rem' }}>
                  {order.status}
                </span>
              </div>
              <div className="text-gray" style={{ fontSize: '0.85rem' }}>
                <MapPin size={14} className="inline mr-1" /> {order.pickup_address} → {order.dropoff_address}
              </div>
              <div className="text-gray mt-1" style={{ fontSize: '0.85rem' }}>
                Fee: KES {order.fee} | Rider: {order.assigned_rider_id ? riders[order.assigned_rider_id]?.name : 'Unassigned'}
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-gray text-center py-4">No orders today yet.</div>
          )}
        </div>
      </div>

      <div className="map-container relative z-0">
        <MapContainer center={nairobiCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {Object.values(riders).map((rider) => {
            if (rider.status !== 'offline' && rider.current_lat) {
              return (
                <Marker key={rider.id} position={[rider.current_lat, rider.current_lng]} icon={createRiderIcon(rider.status)}>
                  <Popup>
                    <strong>{rider.name}</strong><br/>
                    Status: <span style={{textTransform: 'capitalize'}}>{rider.status}</span><br/>
                    Orders Today: {rider.orders_completed}
                  </Popup>
                </Marker>
              );
            }
            return null;
          })}

          {orders.filter(o => o.status !== 'delivered').map((order) => (
            <React.Fragment key={order.id}>
              {order.pickup_lat && (
                <Marker position={[order.pickup_lat, order.pickup_lng]}>
                  <Popup>Pickup: {order.customer_name}</Popup>
                </Marker>
              )}
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
