import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  Send, MapPin, Package, Smartphone, DollarSign, Activity, Users, 
  LayoutDashboard, Map as MapIcon, MousePointerClick, Plus, Trash2, 
  Layers, Phone, MessageCircle, Copy, Check, ArrowRight
} from 'lucide-react';
import { supabase } from '../supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// Format phone for Kenya (wa.me and display)
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

function MapInteraction({ mode, setFormData, setBatchPickupData, dispatchMode, setMode }) {
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
        
        if (dispatchMode === 'batch' && mode === 'pickup') {
          setBatchPickupData(prev => ({
            ...prev,
            pickup: addressName,
            pickupLat: lat,
            pickupLng: lng
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            [mode === 'pickup' ? 'pickup' : 'dropoff']: addressName,
            [mode === 'pickup' ? 'pickupLat' : 'dropoffLat']: lat,
            [mode === 'pickup' ? 'pickupLng' : 'dropoffLng']: lng,
          }));
        }
        
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
  
  // Single Order Form State
  const [formData, setFormData] = useState({ 
    customerName: '', customerPhone: '', 
    pickup: '', pickupLat: null, pickupLng: null,
    dropoff: '', dropoffLat: null, dropoffLng: null, 
    fee: '' 
  });

  // Batch Multi-Order State
  const [dispatchMode, setDispatchMode] = useState('single'); // 'single' or 'batch'
  const [batchMerchant, setBatchMerchant] = useState('Hannan');
  const [batchPickupData, setBatchPickupData] = useState({
    pickup: 'Nairobi CBD',
    pickupLat: null,
    pickupLng: null
  });
  const [batchItems, setBatchItems] = useState([
    { id: 1, customerName: 'Fatma', dropoff: 'Majengo', customerPhone: '0712345678', fee: '200', description: '' },
    { id: 2, customerName: 'Erick', dropoff: 'NRB - Puscar', customerPhone: '0798765432', fee: '600', description: '' }
  ]);
  const [newBatchItem, setNewBatchItem] = useState({
    customerName: '',
    dropoff: '',
    customerPhone: '',
    fee: '',
    description: ''
  });

  const [paymentStatus, setPaymentStatus] = useState(null);
  const [copiedOrderId, setCopiedOrderId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'finance'
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

    const { error } = await supabase.from('orders').insert([{
      order_number: `ORD-${Date.now()}`,
      customer_name: formData.customerName,
      customer_phone: formData.customerPhone,
      pickup_address: formData.pickup,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_address: formData.dropoff,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
      fee: parseFloat(formData.fee),
      status: 'pending'
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

  const handleAddBatchItem = (e) => {
    e.preventDefault();
    if (!newBatchItem.customerName || !newBatchItem.dropoff || !newBatchItem.fee) {
      alert("Please enter customer name, destination, and fee.");
      return;
    }

    setBatchItems(prev => [
      ...prev,
      {
        ...newBatchItem,
        id: Date.now() + Math.random()
      }
    ]);

    setNewBatchItem({
      customerName: '',
      dropoff: '',
      customerPhone: '',
      fee: '',
      description: ''
    });
  };

  const handleRemoveBatchItem = (id) => {
    setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  const handleBatchDispatch = async () => {
    if (batchItems.length === 0) {
      alert("No deliveries in batch! Add at least one delivery.");
      return;
    }

    const baseTimestamp = Date.now();
    const ordersToInsert = batchItems.map((item, idx) => {
      const pLat = batchPickupData.pickupLat || -1.2921 + (Math.random() * 0.01 - 0.005);
      const pLng = batchPickupData.pickupLng || 36.8219 + (Math.random() * 0.01 - 0.005);
      const dLat = -1.2921 + (Math.random() * 0.01 - 0.005);
      const dLng = 36.8219 + (Math.random() * 0.01 - 0.005);

      const merchantPrefix = batchMerchant.trim() ? `${batchMerchant.trim()} · ` : '';
      const pickupAddress = `${merchantPrefix}${batchPickupData.pickup || 'Pickup'}`;
      const dropoffAddress = item.description?.trim() 
        ? `${item.dropoff.trim()} (${item.description.trim()})`
        : item.dropoff.trim();

      return {
        order_number: `ORD-${baseTimestamp}-${idx + 1}`,
        customer_name: item.customerName.trim(),
        customer_phone: item.customerPhone?.trim() || '',
        pickup_address: pickupAddress,
        pickup_lat: pLat,
        pickup_lng: pLng,
        dropoff_address: dropoffAddress,
        dropoff_lat: dLat,
        dropoff_lng: dLng,
        fee: parseFloat(item.fee) || 0,
        status: 'pending'
      };
    });

    const { error } = await supabase.from('orders').insert(ordersToInsert);

    if (!error) {
      alert(`🎉 Dispatched batch of ${ordersToInsert.length} orders to riders!`);
      setBatchItems([]);
    } else {
      alert("Error dispatching batch: " + error.message);
    }
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const triggerMpesa = async (orderId = null) => {
    const phone = formData.customerPhone;
    const amount = formData.fee;
    if (!phone || !amount) {
      alert("Please enter customer phone and fee to trigger M-Pesa");
      return;
    }
    
    setPaymentStatus('loading');
    try {
      const { error } = await supabase.functions.invoke('mpesa-stk', {
        body: { phone, amount, orderId }
      });
      
      if (error) throw error;
      setPaymentStatus('success');
      setTimeout(() => setPaymentStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setPaymentStatus('error');
      alert("M-Pesa Request Failed: " + (error.message || 'Check credentials'));
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

  if (activeTab === 'finance') {
    return (
      <div className="finance-dashboard">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Financial Analytics</h1>
          <button className="btn btn-primary" onClick={() => setActiveTab('dashboard')}>
            <MapIcon size={16} /> Back to Live Map
          </button>
        </div>

        <div className="metric-grid mb-4">
          <div className="metric-card">
            <div className="metric-label">Total Revenue</div>
            <div className="metric-value text-green">KES {totalEarnings}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Delivered Orders</div>
            <div className="metric-value">{totalOrders}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Active Fleet</div>
            <div className="metric-value text-blue">{activeRiders} / {Object.keys(riders).length || 3}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><DollarSign size={18} /> Revenue by Rider</div>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <BarChart data={riderStats} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `KES ${v}`} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                <Bar dataKey="grossRevenue" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      {/* Left Column: Sidebar with forms & active orders */}
      <div className="sidebar-scrollable">
        {/* Top Summary Metrics */}
        <div className="metric-grid">
          <div className="metric-card">
            <Activity size={18} className="text-blue" style={{ margin: '0 auto' }} />
            <div className="metric-value">{totalOrders}</div>
            <div className="metric-label">Delivered</div>
          </div>
          <div className="metric-card">
            <DollarSign size={18} className="text-green" style={{ margin: '0 auto' }} />
            <div className="metric-value text-green">KES {totalEarnings}</div>
            <div className="metric-label">Revenue</div>
          </div>
          <div className="metric-card">
            <Users size={18} className="text-gray" style={{ margin: '0 auto' }} />
            <div className="metric-value">{activeRiders}</div>
            <div className="metric-label">Active Fleet</div>
          </div>
        </div>

        {/* Dispatch Mode Toggle */}
        <div className="mode-toggle">
          <button 
            type="button" 
            className={`mode-toggle-btn ${dispatchMode === 'single' ? 'active' : ''}`}
            onClick={() => setDispatchMode('single')}
          >
            <Package size={15} /> Single Order
          </button>
          <button 
            type="button" 
            className={`mode-toggle-btn ${dispatchMode === 'batch' ? 'active' : ''}`}
            onClick={() => setDispatchMode('batch')}
          >
            <Layers size={15} /> Batch (Multi)
          </button>
        </div>

        {/* Dispatch Form Card */}
        <div className="card">
          {dispatchMode === 'single' ? (
            /* Single Dispatch */
            <form onSubmit={handleDispatch}>
              <div className="card-header">
                <Package size={18} /> Dispatch Single Order
              </div>

              <div className="form-group">
                <label>Customer Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="customerName" 
                  value={formData.customerName} 
                  onChange={handleInputChange} 
                  placeholder="e.g. John Doe"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Pickup Location</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    className="form-control" 
                    name="pickup" 
                    value={formData.pickup} 
                    onChange={handleInputChange} 
                    placeholder="e.g. CBD Nairobi"
                    required 
                  />
                  <button 
                    type="button" 
                    className={`btn-icon ${mapClickMode === 'pickup' ? 'active' : ''}`}
                    onClick={() => setMapClickMode(mapClickMode === 'pickup' ? null : 'pickup')}
                    title="Click on map to select pickup"
                  >
                    <MousePointerClick size={16} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Delivery Location</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    className="form-control" 
                    name="dropoff" 
                    value={formData.dropoff} 
                    onChange={handleInputChange} 
                    placeholder="e.g. Westlands"
                    required 
                  />
                  <button 
                    type="button" 
                    className={`btn-icon ${mapClickMode === 'dropoff' ? 'active' : ''}`}
                    onClick={() => setMapClickMode(mapClickMode === 'dropoff' ? null : 'dropoff')}
                    title="Click on map to select dropoff"
                  >
                    <MousePointerClick size={16} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="form-group w-full">
                  <label>Phone</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    name="customerPhone" 
                    value={formData.customerPhone} 
                    onChange={handleInputChange} 
                    placeholder="07... or 254..." 
                    required 
                  />
                </div>
                <div className="form-group w-full">
                  <label>Fee (KES)</label>
                  <input 
                    type="number" 
                    className="form-control font-bold" 
                    name="fee" 
                    value={formData.fee} 
                    onChange={handleInputChange} 
                    placeholder="300"
                    required 
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button type="submit" className="btn btn-dark w-full">
                  <Send size={15} /> Dispatch Order
                </button>
                <button 
                  type="button" 
                  className="btn btn-success"
                  onClick={() => triggerMpesa(null)}
                  title="Trigger M-Pesa STK Push"
                >
                  <Smartphone size={15} /> 
                  {paymentStatus === 'loading' ? '...' : paymentStatus === 'success' ? 'Sent' : 'Pay'}
                </button>
              </div>
            </form>
          ) : (
            /* Batch (Multi) Dispatch */
            <div>
              <div className="card-header">
                <Layers size={18} /> Batch Dispatch (One Sender)
              </div>

              {/* Sender & Common Pickup */}
              <div className="batch-merchant-box">
                <div className="form-group">
                  <label style={{ color: '#1E40AF' }}>Sender / Merchant Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={batchMerchant} 
                    onChange={(e) => setBatchMerchant(e.target.value)} 
                    placeholder="e.g. Hannan"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ color: '#1E40AF' }}>Common Pickup Point</label>
                  <div className="input-wrapper">
                    <input 
                      type="text" 
                      className="form-control" 
                      value={batchPickupData.pickup} 
                      onChange={(e) => setBatchPickupData({ ...batchPickupData, pickup: e.target.value })} 
                      placeholder="e.g. CBD Store"
                    />
                    <button 
                      type="button" 
                      className={`btn-icon ${mapClickMode === 'pickup' ? 'active' : ''}`}
                      onClick={() => setMapClickMode(mapClickMode === 'pickup' ? null : 'pickup')}
                      title="Select on map"
                    >
                      <MousePointerClick size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Queue List */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Deliveries in Queue ({batchItems.length})
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16A34A' }}>
                  Total: KES {batchItems.reduce((acc, i) => acc + (parseFloat(i.fee) || 0), 0)}
                </span>
              </div>

              <div className="batch-queue-container">
                {batchItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    No deliveries queued. Add below.
                  </div>
                ) : (
                  batchItems.map((item, idx) => (
                    <div key={item.id} className="batch-item-row">
                      <div>
                        <strong>{idx + 1}. {item.customerName}</strong> → {item.dropoff}
                        {item.customerPhone && <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>({item.customerPhone})</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#16A34A' }}>KES {item.fee}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveBatchItem(item.id)}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Stop Form */}
              <form onSubmit={handleAddBatchItem} style={{ borderTop: '1px dashed #CBD5E1', paddingTop: '0.75rem' }}>
                <div className="flex gap-2">
                  <div className="form-group w-full">
                    <label>Recipient Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Fatma"
                      value={newBatchItem.customerName}
                      onChange={(e) => setNewBatchItem({ ...newBatchItem, customerName: e.target.value })}
                    />
                  </div>
                  <div className="form-group w-full">
                    <label>Destination</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Majengo"
                      value={newBatchItem.dropoff}
                      onChange={(e) => setNewBatchItem({ ...newBatchItem, dropoff: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="form-group w-full">
                    <label>Phone</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="07..."
                      value={newBatchItem.customerPhone}
                      onChange={(e) => setNewBatchItem({ ...newBatchItem, customerPhone: e.target.value })}
                    />
                  </div>
                  <div className="form-group w-full">
                    <label>Fee (KES)</label>
                    <input 
                      type="number" 
                      className="form-control font-bold" 
                      placeholder="200"
                      value={newBatchItem.fee}
                      onChange={(e) => setNewBatchItem({ ...newBatchItem, fee: e.target.value })}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-outline-dark w-full" style={{ marginBottom: '0.75rem' }}>
                  <Plus size={15} /> Add to Batch
                </button>
              </form>

              <div className="flex gap-2">
                <button 
                  type="button" 
                  className="btn btn-dark w-full"
                  onClick={handleBatchDispatch}
                  disabled={batchItems.length === 0}
                >
                  <Send size={15} /> Dispatch All ({batchItems.length})
                </button>
                {batchItems.length > 0 && (
                  <button 
                    type="button" 
                    className="btn btn-outline-dark"
                    onClick={() => setBatchItems([])}
                    title="Clear batch"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Active Orders Section */}
        <div>
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <Activity size={18} /> Active Orders ({orders.filter(o => o.status !== 'delivered').length})
          </div>

          {orders.map(order => {
            if (order.status === 'delivered') return null;
            return (
              <div key={order.id} className="order-card-item">
                <div className="flex justify-between items-center mb-1">
                  <strong style={{ fontSize: '0.92rem' }}>{order.customer_name}</strong>
                  <span className={`status-badge status-${order.status === 'paid' ? 'online' : 'busy'}`}>
                    {order.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', margin: '4px 0' }}>
                  <span>{order.pickup_address}</span>
                  <ArrowRight size={12} />
                  <span>{order.dropoff_address}</span>
                </div>

                <div className="flex justify-between items-center" style={{ fontSize: '0.85rem' }}>
                  <span className="font-bold text-green">KES {order.fee}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-color)' }}>
                    {riders[order.assigned_rider_id]?.name || 'Unassigned'}
                  </span>
                </div>

                {/* Customer Contact Bar (Call, WhatsApp, Copy, Pay) */}
                <div className="order-action-bar">
                  <span className="order-phone-text">{order.customer_phone || 'No phone'}</span>
                  <div className="action-btn-group">
                    {order.customer_phone && (
                      <>
                        <a href={`tel:${order.customer_phone}`} className="action-btn-circle call" title="Call">
                          <Phone size={13} />
                        </a>
                        <a 
                          href={`https://wa.me/${formatKenyanPhone(order.customer_phone)}?text=${encodeURIComponent(`Hello ${order.customer_name}, Falcon Delivery here regarding your order (${order.order_number}).`)}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="action-btn-circle whatsapp" 
                          title="WhatsApp"
                        >
                          <MessageCircle size={13} />
                        </a>
                      </>
                    )}
                    <button 
                      type="button" 
                      onClick={() => copyToClipboard(order.customer_phone || order.order_number, order.id)} 
                      className="action-btn-circle copy" 
                      title="Copy Info"
                    >
                      {copiedOrderId === order.id ? <Check size={13} color="#16A34A" /> : <Copy size={13} />}
                    </button>
                    {order.status !== 'paid' && (
                      <button 
                        type="button"
                        onClick={() => triggerMpesa(order.id)} 
                        className="btn btn-success" 
                        style={{ padding: '2px 8px', fontSize: '0.75rem', height: '28px' }}
                        title="M-Pesa STK"
                      >
                        <Smartphone size={12} /> Pay
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {orders.filter(o => o.status !== 'delivered').length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              No active orders at the moment.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Live Interactive Map */}
      <div className="map-container">
        <button className="floating-finance-btn" onClick={() => setActiveTab('finance')}>
          <LayoutDashboard size={16} /> Finance
        </button>

        <MapContainer center={nairobiCenter} zoom={13} style={{ height: '100%', width: '100%', cursor: mapClickMode ? 'crosshair' : 'grab' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          <MapInteraction 
            mode={mapClickMode} 
            setFormData={setFormData} 
            setBatchPickupData={setBatchPickupData} 
            dispatchMode={dispatchMode} 
            setMode={setMapClickMode} 
          />

          {dispatchMode === 'single' && formData.pickupLat && (
            <Marker position={[formData.pickupLat, formData.pickupLng]}>
              <Popup>Pickup: {formData.pickup}</Popup>
            </Marker>
          )}
          {dispatchMode === 'batch' && batchPickupData.pickupLat && (
            <Marker position={[batchPickupData.pickupLat, batchPickupData.pickupLng]}>
              <Popup>Batch Pickup: {batchMerchant || 'Merchant'}</Popup>
            </Marker>
          )}
          {formData.dropoffLat && (
            <Marker position={[formData.dropoffLat, formData.dropoffLng]}>
              <Popup>Dropoff: {formData.dropoff}</Popup>
            </Marker>
          )}

          {Object.values(riders).map((rider) => {
            if (rider.status !== 'offline' && rider.current_lat) {
              return (
                <Marker key={rider.id} position={[rider.current_lat, rider.current_lng]} icon={createRiderIcon(rider.status)}>
                  <Popup>
                    <strong>{rider.name}</strong><br/>
                    Status: <span style={{textTransform: 'capitalize'}}>{rider.status}</span><br/>
                    Orders Today: {rider.orders_completed || 0}
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
