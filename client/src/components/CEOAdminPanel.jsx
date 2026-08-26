import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Send, MapPin, Package, Smartphone, DollarSign, Activity, Users, LayoutDashboard, Map as MapIcon, MousePointerClick } from 'lucide-react';
import { supabase } from '../supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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
      <div className="finance-view">
        <div className="finance-container">
          <div className="flex justify-between align-center mb-4">
            <h1 style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)' }}>Financial Dashboard</h1>
            <div className="flex gap-2">
              <button className="btn btn-outline-dark" onClick={() => setActiveTab('dispatch')}>
                <MapIcon size={18} /> Live Map
              </button>
              <button className="btn btn-primary">
                <LayoutDashboard size={18} /> Finance
              </button>
            </div>
          </div>

          <div className="metric-grid">
            <div className="metric-card" style={{ borderTop: '4px solid var(--secondary)' }}>
              <div className="metric-label">Gross Revenue</div>
              <div className="metric-value">KES {totalEarnings}</div>
            </div>
            <div className="metric-card" style={{ borderTop: '4px solid var(--accent)' }}>
              <div className="metric-label">Total Deliveries</div>
              <div className="metric-value">{totalOrders}</div>
            </div>
            <div className="metric-card" style={{ borderTop: '4px solid var(--warning-color)' }}>
              <div className="metric-label">Active Fleet</div>
              <div className="metric-value">{activeRiders} / 3</div>
            </div>
          </div>

          <div className="chart-grid">
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">Gross Revenue by Rider</div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={riderStats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} tickFormatter={(value) => `KES ${value}`} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                    <Bar dataKey="grossRevenue" fill="var(--secondary)" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">Completed Orders</div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={riderStats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                    <Bar dataKey="orders" fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Historical Transactions</div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Route</th>
                    <th>Rider</th>
                    <th>Fee</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.filter(o => o.status === 'delivered').map(order => (
                    <tr key={order.id}>
                      <td className="font-bold text-muted">{order.order_number}</td>
                      <td className="font-bold">{order.customer_name}</td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{order.pickup_address}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>→ {order.dropoff_address}</div>
                      </td>
                      <td>
                        <span style={{ backgroundColor: '#F1F5F9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600' }}>
                          {riders[order.assigned_rider_id]?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="font-bold text-green">KES {order.fee}</td>
                      <td className="text-muted" style={{ fontSize: '0.85rem' }}>{new Date(order.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {orders.filter(o => o.status === 'delivered').length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No transactions recorded yet.</td></tr>
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
    <div className="dashboard-layout">
      
      <div className="floating-controls">
        <button className="btn-nav active" onClick={() => setActiveTab('dispatch')}>
          <MapIcon size={18} /> Map
        </button>
        <button className="btn-nav" onClick={() => setActiveTab('transactions')}>
          <LayoutDashboard size={18} /> Finance
        </button>
      </div>

      <div className="dashboard-sidebar">
        <div className="sidebar-scrollable">
          <div className="metric-grid">
            <div className="metric-card">
              <Activity className="text-muted" style={{ margin: '0 auto 4px auto' }} size={20} />
              <div className="metric-value" style={{ fontSize: '1.25rem' }}>{totalOrders}</div>
              <div className="metric-label">Orders</div>
            </div>
            <div className="metric-card">
              <DollarSign className="text-green" style={{ margin: '0 auto 4px auto' }} size={20} />
              <div className="metric-value" style={{ fontSize: '1.25rem', color: 'var(--accent)' }}>KES {totalEarnings}</div>
              <div className="metric-label">Revenue</div>
            </div>
          </div>

          <div className="card" style={{ borderTop: '4px solid var(--primary)', padding: '1.25rem' }}>
            <div className="card-header mb-4" style={{ fontSize: '1.05rem', margin: 0, paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
              <Package size={18} /> Dispatch Order
            </div>
            <form onSubmit={handleDispatch}>
              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input type="text" className="form-control" name="customerName" value={formData.customerName} onChange={handleInputChange} required />
              </div>

              <div className="form-group">
                <label className="form-label">Pickup Location</label>
                <div className="input-wrapper">
                  <input type="text" className="form-control" name="pickup" value={formData.pickup} onChange={handleInputChange} required />
                  <button type="button" 
                    className={`btn-icon ${mapClickMode === 'pickup' ? 'btn-primary' : 'btn-outline-dark'}`} 
                    onClick={() => setMapClickMode(mapClickMode === 'pickup' ? null : 'pickup')}
                    title="Click map to set">
                    <MousePointerClick size={18} />
                  </button>
                </div>
                {mapClickMode === 'pickup' && <div className="pulse-text">Click map to set pickup...</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Location</label>
                <div className="input-wrapper">
                  <input type="text" className="form-control" name="dropoff" value={formData.dropoff} onChange={handleInputChange} required />
                  <button type="button" 
                    className={`btn-icon ${mapClickMode === 'dropoff' ? 'btn-primary' : 'btn-outline-dark'}`} 
                    onClick={() => setMapClickMode(mapClickMode === 'dropoff' ? null : 'dropoff')}
                    title="Click map to set">
                    <MousePointerClick size={18} />
                  </button>
                </div>
                {mapClickMode === 'dropoff' && <div className="pulse-text">Click map to set delivery...</div>}
              </div>

              <div className="flex gap-4 mb-4">
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label">Phone</label>
                  <input type="text" className="form-control" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} required placeholder="2547..." />
                </div>
                <div className="form-group w-full" style={{ marginBottom: 0 }}>
                  <label className="form-label">Fee</label>
                  <input type="number" className="form-control" name="fee" value={formData.fee} onChange={handleInputChange} required />
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary w-full">
                  <Send size={16} /> Dispatch
                </button>
                <button type="button" className="btn btn-success w-full" onClick={triggerMpesa}>
                  <Smartphone size={16} /> 
                  {paymentStatus === 'loading' ? '...' : paymentStatus === 'success' ? 'Sent!' : 'M-Pesa'}
                </button>
              </div>
            </form>
          </div>

          <div>
            <div className="card-header" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Active Orders</div>
            {orders.map(order => {
              if (order.status === 'delivered') return null;
              return (
                <div key={order.id} style={{ padding: '1rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '12px', marginBottom: '0.75rem' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold" style={{ fontSize: '0.95rem' }}>{order.customer_name}</span>
                    <span className={`status-badge status-${order.status === 'paid' ? 'online' : 'busy'}`}>
                      {order.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    {order.pickup_address} → {order.dropoff_address}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-green" style={{ fontSize: '0.9rem' }}>KES {order.fee}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--secondary)' }}>{riders[order.assigned_rider_id]?.name || 'Unassigned'}</span>
                  </div>
                </div>
              )
            })}
            {orders.filter(o => o.status !== 'delivered').length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem', border: '1px dashed var(--border-light)', borderRadius: '12px' }}>
                No active orders
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-main">
        <div className="map-wrapper">
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
    </div>
  );
}
