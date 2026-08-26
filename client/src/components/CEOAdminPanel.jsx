import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Send, MapPin, Package, Smartphone, DollarSign, Activity, Users, LayoutDashboard, Map as MapIcon, MousePointerClick } from 'lucide-react';
import { supabase } from '../supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

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

function MapInteraction({ mode, setFormData, setMode }) {
  useMapEvents({
    click: async (e) => {
      if (!mode) return; 
      const { lat, lng } = e.latlng;
      
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        const addressName = data.display_name 
          ? data.display_name.split(',').slice(0, 2).join(',') 
          : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        setFormData(prev => ({
          ...prev,
          [mode === 'pickup' ? 'pickup' : 'dropoff']: addressName,
          [mode === 'pickup' ? 'pickupLat' : 'dropoffLat']: lat,
          [mode === 'pickup' ? 'pickupLng' : 'dropoffLng']: lng,
        }));
        
        setMode(null);
      } catch (err) {
        console.error("Geocoding error:", err);
      }
    }
  });
  return null;
}

export default function CEOAdminPanel() {
  const [riders, setRiders] = useState({});
  const [orders, setOrders] = useState([]);
  const [formData, setFormData] = useState({ 
    customerName: '', customerPhone: '', 
    pickup: '', pickupLat: null, pickupLng: null,
    dropoff: '', dropoffLat: null, dropoffLng: null, 
    fee: '' 
  });
  const [paymentStatus, setPaymentStatus] = useState(null);
  
  const [activeTab, setActiveTab] = useState('dispatch'); // 'dispatch' or 'transactions'
  const [mapClickMode, setMapClickMode] = useState(null); // 'pickup', 'dropoff', null

  useEffect(() => {
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
    
    const pickupLat = formData.pickupLat || -1.2921 + (Math.random() * 0.01 - 0.005);
    const pickupLng = formData.pickupLng || 36.8219 + (Math.random() * 0.01 - 0.005);
    const dropoffLat = formData.dropoffLat || -1.2921 + (Math.random() * 0.01 - 0.005);
    const dropoffLng = formData.dropoffLng || 36.8219 + (Math.random() * 0.01 - 0.005);

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
      setFormData({ 
        customerName: '', customerPhone: '', 
        pickup: '', pickupLat: null, pickupLng: null,
        dropoff: '', dropoffLat: null, dropoffLng: null, 
        fee: '' 
      });
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
  const riderStats = Object.values(riders).map(rider => ({
    name: rider.name,
    grossRevenue: Number(rider.earnings || 0),
    orders: rider.orders_completed || 0
  }));

  if (activeTab === 'transactions') {
    return (
      <div className="p-6 bg-gray-50 h-full overflow-y-auto w-full absolute top-0 left-0" style={{ zIndex: 1000, backgroundColor: '#F8FAFC' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-primary-color">Financial Dashboard</h1>
            <div className="flex gap-4">
              <button className="btn btn-outline" onClick={() => setActiveTab('dispatch')}>
                <MapIcon size={18} className="inline mr-2" /> Live Map
              </button>
              <button className="btn btn-primary">
                <LayoutDashboard size={18} className="inline mr-2" /> Finance
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="card p-6 border-l-4" style={{ borderLeftColor: '#2563EB' }}>
              <div className="text-gray mb-1 font-semibold">Total Gross Revenue</div>
              <div className="text-4xl font-bold text-gray-800">KES {totalEarnings}</div>
            </div>
            <div className="card p-6 border-l-4" style={{ borderLeftColor: '#10B981' }}>
              <div className="text-gray mb-1 font-semibold">Total Deliveries</div>
              <div className="text-4xl font-bold text-gray-800">{totalOrders}</div>
            </div>
            <div className="card p-6 border-l-4" style={{ borderLeftColor: '#F59E0B' }}>
              <div className="text-gray mb-1 font-semibold">Active Fleet</div>
              <div className="text-4xl font-bold text-gray-800">{activeRiders} / 3</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="card p-6">
              <h3 className="font-bold text-lg mb-6">Gross Revenue by Rider</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={riderStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `KES ${value}`} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="grossRevenue" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-6">
              <h3 className="font-bold text-lg mb-6">Completed Orders by Rider</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={riderStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="orders" fill="#10B981" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Order History */}
          <div className="card p-6">
            <h3 className="font-bold text-lg mb-4">Historical Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-gray-500">
                    <th className="p-3 font-semibold">Order #</th>
                    <th className="p-3 font-semibold">Customer</th>
                    <th className="p-3 font-semibold">Route</th>
                    <th className="p-3 font-semibold">Rider</th>
                    <th className="p-3 font-semibold">Gross Fee</th>
                    <th className="p-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.filter(o => o.status === 'delivered').map(order => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-medium text-gray-700">{order.order_number}</td>
                      <td className="p-3">{order.customer_name}</td>
                      <td className="p-3 text-sm text-gray-500">
                        <div className="truncate max-w-xs">{order.pickup_address} → {order.dropoff_address}</div>
                      </td>
                      <td className="p-3">
                        <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium">
                          {riders[order.assigned_rider_id]?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-green-600">KES {order.fee}</td>
                      <td className="p-3 text-sm text-gray-400">{new Date(order.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {orders.filter(o => o.status === 'delivered').length === 0 && (
                    <tr><td colSpan="6" className="text-center p-6 text-gray-500">No transactions recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-grid relative">
      {/* Top Navigation Overlay */}
      <div className="absolute top-4 right-4 z-[400] flex gap-2">
        <button className="btn btn-primary shadow-lg" onClick={() => setActiveTab('dispatch')}>
          <MapIcon size={18} className="inline mr-2" /> Live Map
        </button>
        <button className="btn bg-white text-gray-700 shadow-lg border border-gray-200" onClick={() => setActiveTab('transactions')}>
          <LayoutDashboard size={18} className="inline mr-2" /> Finance
        </button>
      </div>

      <div className="sidebar">
        <div className="flex gap-4 mb-4">
          <div className="card w-full text-center p-3">
            <Activity className="text-gray mx-auto mb-1" size={20} />
            <div className="text-xl font-bold">{totalOrders}</div>
          </div>
          <div className="card w-full text-center p-3">
            <DollarSign className="text-gray mx-auto mb-1" size={20} />
            <div className="text-xl font-bold text-accent-color">KES {totalEarnings}</div>
          </div>
        </div>

        <div className="card border-t-4 border-primary-color">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Package size={20} /> Dispatch Order
          </h2>
          <form onSubmit={handleDispatch}>
            <div className="form-group">
              <label>Customer Name</label>
              <input type="text" className="form-control" name="customerName" value={formData.customerName} onChange={handleInputChange} required />
            </div>

            <div className="form-group relative">
              <label>Pickup Location</label>
              <div className="flex gap-2">
                <input type="text" className="form-control flex-1" name="pickup" value={formData.pickup} onChange={handleInputChange} required />
                <button type="button" 
                  className={`btn ${mapClickMode === 'pickup' ? 'btn-primary' : 'bg-gray-100 text-gray-600'}`} 
                  onClick={() => setMapClickMode(mapClickMode === 'pickup' ? null : 'pickup')}
                  title="Click map to set">
                  <MousePointerClick size={18} />
                </button>
              </div>
              {mapClickMode === 'pickup' && <div className="text-xs text-blue-600 mt-1 animate-pulse">Click anywhere on map to set pickup...</div>}
            </div>

            <div className="form-group relative">
              <label>Delivery Location</label>
              <div className="flex gap-2">
                <input type="text" className="form-control flex-1" name="dropoff" value={formData.dropoff} onChange={handleInputChange} required />
                <button type="button" 
                  className={`btn ${mapClickMode === 'dropoff' ? 'btn-primary' : 'bg-gray-100 text-gray-600'}`} 
                  onClick={() => setMapClickMode(mapClickMode === 'dropoff' ? null : 'dropoff')}
                  title="Click map to set">
                  <MousePointerClick size={18} />
                </button>
              </div>
              {mapClickMode === 'dropoff' && <div className="text-xs text-blue-600 mt-1 animate-pulse">Click anywhere on map to set delivery...</div>}
            </div>

            <div className="flex gap-4 mb-4">
              <div className="form-group w-full">
                <label>Phone</label>
                <input type="text" className="form-control" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} required placeholder="2547..." />
              </div>
              <div className="form-group w-full">
                <label>Fee (KES)</label>
                <input type="number" className="form-control" name="fee" value={formData.fee} onChange={handleInputChange} required />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary w-full justify-center">
                <Send size={18} /> Dispatch
              </button>
              <button type="button" className="btn btn-success w-full justify-center" onClick={triggerMpesa}>
                <Smartphone size={18} /> 
                {paymentStatus === 'loading' ? '...' : paymentStatus === 'success' ? 'Sent!' : 'M-Pesa'}
              </button>
            </div>
          </form>
        </div>

        <div className="card mt-4 max-h-[300px] overflow-y-auto">
          <h3 className="font-bold mb-3 text-sm text-gray-500 uppercase tracking-wider">Active Orders</h3>
          {orders.map(order => (
            <div key={order.id} className="p-3 mb-2 border border-gray-100 rounded-lg hover:shadow-sm transition-shadow bg-gray-50">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold">{order.customer_name}</span>
                <span className={`status-badge status-${order.status === 'delivered' ? 'online' : (order.status === 'paid' ? 'online' : 'busy')}`} style={{ fontSize: '0.65rem' }}>
                  {order.status}
                </span>
              </div>
              <div className="text-gray-500 text-xs truncate max-w-full">
                {order.pickup_address} → {order.dropoff_address}
              </div>
              <div className="text-gray-600 mt-1 text-xs font-semibold flex justify-between">
                <span>KES {order.fee}</span>
                <span className="text-primary-color">{riders[order.assigned_rider_id]?.name || 'Unassigned'}</span>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-gray-400 text-center py-4 text-sm">No active orders</div>
          )}
        </div>
      </div>

      <div className="map-container relative z-0">
        <MapContainer center={nairobiCenter} zoom={13} style={{ height: '100%', width: '100%', cursor: mapClickMode ? 'crosshair' : 'grab' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          <MapInteraction mode={mapClickMode} setFormData={setFormData} setMode={setMapClickMode} />

          {formData.pickupLat && (
            <Marker position={[formData.pickupLat, formData.pickupLng]}>
              <Popup>Pickup Location</Popup>
            </Marker>
          )}
          {formData.dropoffLat && (
            <Marker position={[formData.dropoffLat, formData.dropoffLng]}>
              <Popup>Delivery Location</Popup>
            </Marker>
          )}

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
