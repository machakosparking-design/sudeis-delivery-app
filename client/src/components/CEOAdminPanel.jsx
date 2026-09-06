import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  Send, MapPin, Package, Smartphone, DollarSign, Activity, Users, 
  LayoutDashboard, Map as MapIcon, MousePointerClick, Plus, Trash2, 
  ListPlus, ListChecks, Layers, Phone, MessageCircle, Copy, Check 
} from 'lucide-react';
import { supabase } from '../supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

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
    { id: 1, customerName: 'Fatma', dropoff: 'majengo', customerPhone: '0712345678', fee: '200', description: '' },
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
  const [activeTab, setActiveTab] = useState('dispatch'); // 'dispatch' or 'transactions'
  const [activeSidebarTab, setActiveSidebarTab] = useState('dispatch'); // 'dispatch' or 'orders'
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

  const handleAddBatchItem = (e) => {
    e.preventDefault();
    if (!newBatchItem.customerName || !newBatchItem.dropoff || !newBatchItem.fee) {
      alert("Please fill in recipient name, destination, and fee.");
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
      alert("No delivery orders in batch! Add at least one delivery.");
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
      alert(`🎉 Successfully dispatched batch of ${ordersToInsert.length} orders to riders!`);
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
    if (!formData.customerPhone || !formData.fee) {
      alert("Please enter customer phone and fee to trigger M-Pesa");
      return;
    }
    
    setPaymentStatus('loading');
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-stk', {
        body: { 
          phone: formData.customerPhone, 
          amount: formData.fee,
          orderId: orderId 
        }
      });
      
      if (error) throw error;
      setPaymentStatus('success');
      setTimeout(() => setPaymentStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setPaymentStatus('error');
      alert("M-Pesa Trigger Failed: " + (error.message || 'Unknown error'));
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
      <div className="finance-dashboard">
        <div className="finance-header">
          <h1 className="finance-title">Financial Dashboard</h1>
          <div className="finance-actions">
            <button className="btn-outline-vanilla" onClick={() => setActiveTab('dispatch')}>
              <MapIcon size={18} style={{ color: '#2563eb' }} /> Live Map
            </button>
            <button className="btn-primary-vanilla">
              <LayoutDashboard size={18} /> Finance
            </button>
          </div>
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', borderLeft: '4px solid #2563eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Gross Revenue</div>
              <div style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f172a' }}>KES {totalEarnings}</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', borderLeft: '4px solid #10b981', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Deliveries</div>
              <div style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f172a' }}>{totalOrders}</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', borderLeft: '4px solid #f59e0b', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Active Fleet</div>
              <div style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0f172a' }}>{activeRiders} / {Object.keys(riders).length || 3}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={20} style={{ color: '#2563eb' }}/> Gross Revenue by Rider
              </h3>
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                  <BarChart data={riderStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(value) => `KES ${value}`} />
                    <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB' }} />
                    <Bar dataKey="grossRevenue" fill="#2563EB" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={20} style={{ color: '#10b981' }}/> Completed Orders by Rider
              </h3>
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                  <BarChart data={riderStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                    <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB' }} />
                    <Bar dataKey="orders" fill="#10B981" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ceo-panel-container">
      {/* Sidebar Panel */}
      <div className="ceo-sidebar">
        
        {/* Sidebar Tabs */}
        <div className="ceo-tabs">
          <button 
            className={`ceo-tab-btn ${activeSidebarTab === 'dispatch' ? 'active' : ''}`}
            onClick={() => setActiveSidebarTab('dispatch')}
          >
            <Package size={18} /> Dispatch
          </button>
          <button 
            className={`ceo-tab-btn ${activeSidebarTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveSidebarTab('orders')}
          >
            <ListChecks size={18} /> Active ({orders.length})
          </button>
        </div>

        {/* Sidebar Content (Scrollable) */}
        <div className="ceo-sidebar-content">
          {activeSidebarTab === 'dispatch' && (
            <div>
              {/* Dispatch Mode Switcher */}
              <div className="mode-switcher">
                <button
                  type="button"
                  className={`mode-btn ${dispatchMode === 'single' ? 'active' : ''}`}
                  onClick={() => setDispatchMode('single')}
                >
                  <Package size={16} /> Single Route
                </button>
                <button
                  type="button"
                  className={`mode-btn ${dispatchMode === 'batch' ? 'active' : ''}`}
                  onClick={() => setDispatchMode('batch')}
                >
                  <Layers size={16} /> Batch (Multi)
                </button>
              </div>

              {/* Forms */}
              {dispatchMode === 'single' ? (
                <form onSubmit={handleDispatch}>
                  <div className="input-group">
                    <label className="input-label">Customer Name</label>
                    <input type="text" className="custom-input" name="customerName" value={formData.customerName} onChange={handleInputChange} required />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Pickup Location</label>
                    <div className="input-with-btn">
                      <input type="text" className="custom-input" name="pickup" value={formData.pickup} onChange={handleInputChange} required />
                      <button type="button" 
                        className={`map-pick-btn ${mapClickMode === 'pickup' ? 'active' : ''}`} 
                        onClick={() => setMapClickMode(mapClickMode === 'pickup' ? null : 'pickup')}
                        title="Click map to set">
                        <MousePointerClick size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Delivery Location</label>
                    <div className="input-with-btn">
                      <input type="text" className="custom-input" name="dropoff" value={formData.dropoff} onChange={handleInputChange} required />
                      <button type="button" 
                        className={`map-pick-btn ${mapClickMode === 'dropoff' ? 'active' : ''}`} 
                        onClick={() => setMapClickMode(mapClickMode === 'dropoff' ? null : 'dropoff')}
                        title="Click map to set">
                        <MousePointerClick size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Phone</label>
                      <input type="text" className="custom-input" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} required placeholder="2547..." />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Fee (KES)</label>
                      <input type="number" className="custom-input" name="fee" value={formData.fee} onChange={handleInputChange} required style={{ fontWeight: 900, color: '#15803d' }} />
                    </div>
                  </div>
                  <div className="action-row">
                    <button type="submit" className="btn-dispatch">
                      <Send size={18} /> Dispatch Now
                    </button>
                    <button type="button" className="btn-pay" onClick={() => triggerMpesa(null)} title="Send M-Pesa request">
                      <Smartphone size={18} /> 
                      {paymentStatus === 'loading' ? '...' : paymentStatus === 'success' ? 'Sent!' : 'Pay'}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  {/* Merchant & Pickup Header */}
                  <div className="batch-header">
                    <div className="batch-header-title">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={14} /> Sender Profile</span>
                      <span className="batch-tag">Common Pickup</span>
                    </div>
                    <div className="input-group">
                      <label className="input-label" style={{ color: '#1e40af' }}>Merchant / Client Name</label>
                      <input type="text" className="custom-input" placeholder="e.g. Hannan" value={batchMerchant} onChange={(e) => setBatchMerchant(e.target.value)} />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ color: '#1e40af' }}>Pickup Location</label>
                      <div className="input-with-btn">
                        <input type="text" className="custom-input" placeholder="e.g. CBD Shop #4" value={batchPickupData.pickup} onChange={(e) => setBatchPickupData({ ...batchPickupData, pickup: e.target.value })} />
                        <button type="button" className={`map-pick-btn ${mapClickMode === 'pickup' ? 'active' : ''}`} onClick={() => setMapClickMode(mapClickMode === 'pickup' ? null : 'pickup')} title="Pick on map">
                          <MousePointerClick size={20} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Queued Deliveries List */}
                  <div className="batch-list-container">
                    <div className="batch-list-header">
                      <span className="batch-list-title">Deliveries ({batchItems.length})</span>
                      <span className="batch-list-total">KES {batchItems.reduce((acc, i) => acc + (parseFloat(i.fee) || 0), 0)}</span>
                    </div>
                    <div className="batch-list-items">
                      {batchItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>No deliveries added yet.</div>
                      ) : (
                        batchItems.map((item, idx) => (
                          <div key={item.id} className="batch-item">
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: '0.75rem' }}>
                              <div className="batch-item-index">{idx + 1}</div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  {item.customerName}
                                  {item.customerPhone && <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>({item.customerPhone})</span>}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.dropoff} {item.description && <span>· {item.description}</span>}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                              <span style={{ fontWeight: 900, color: '#16a34a', fontSize: '0.875rem' }}>KES {item.fee}</span>
                              <button type="button" onClick={() => handleRemoveBatchItem(item.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add Delivery Stop Form */}
                  <form onSubmit={handleAddBatchItem} className="batch-form">
                    <div style={{ fontSize: '0.6875rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>+ Add Dropoff Stop</div>
                    <div className="grid-2">
                      <input type="text" className="custom-input" placeholder="Customer Name" value={newBatchItem.customerName} onChange={(e) => setNewBatchItem({ ...newBatchItem, customerName: e.target.value })} />
                      <input type="text" className="custom-input" placeholder="Destination (e.g. Majengo)" value={newBatchItem.dropoff} onChange={(e) => setNewBatchItem({ ...newBatchItem, dropoff: e.target.value })} />
                    </div>
                    <div className="grid-3">
                      <input type="text" className="custom-input" placeholder="Phone" value={newBatchItem.customerPhone} onChange={(e) => setNewBatchItem({ ...newBatchItem, customerPhone: e.target.value })} />
                      <input type="number" className="custom-input" placeholder="Fee" value={newBatchItem.fee} onChange={(e) => setNewBatchItem({ ...newBatchItem, fee: e.target.value })} style={{ fontWeight: 900, color: '#15803d' }} />
                      <input type="text" className="custom-input" placeholder="Note (Opt)" value={newBatchItem.description} onChange={(e) => setNewBatchItem({ ...newBatchItem, description: e.target.value })} />
                    </div>
                    <button type="submit" className="btn-add-batch"><Plus size={16} /> Add to Queue</button>
                  </form>

                  {/* Batch Action Buttons */}
                  <div className="action-row">
                    <button type="button" className="btn-dispatch" onClick={handleBatchDispatch} disabled={batchItems.length === 0}>
                      <Send size={18} /> Dispatch Batch ({batchItems.length})
                    </button>
                    {batchItems.length > 0 && (
                      <button type="button" className="btn-clear" onClick={() => setBatchItems([])} title="Clear batch"><Trash2 size={18} /></button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSidebarTab === 'orders' && (
            <div>
              {orders.map(order => {
                const statusClass = order.status === 'delivered' ? 'bg-status-delivered badge-delivered' 
                                  : order.status === 'paid' ? 'bg-status-paid badge-paid' 
                                  : 'bg-status-pending badge-pending';
                const lineClass = order.status === 'delivered' ? 'bg-status-delivered' : order.status === 'paid' ? 'bg-status-paid' : 'bg-status-pending';
                const badgeClass = order.status === 'delivered' ? 'badge-delivered' : order.status === 'paid' ? 'badge-paid' : 'badge-pending';
                
                return (
                  <div key={order.id} className="order-card">
                    <div className={`order-card-status-line ${lineClass}`}></div>
                    
                    <div className="order-header">
                      <div>
                        <div className="order-customer">{order.customer_name}</div>
                        <div className="order-number">{order.order_number}</div>
                      </div>
                      <div className={`order-badge ${badgeClass}`}>{order.status}</div>
                    </div>
                    
                    <div className="order-route">
                      <div className="route-step"><div className="route-icon"><MapPin size={10} color="#94a3b8" /></div>{order.pickup_address}</div>
                      <div className="route-divider"></div>
                      <div className="route-step"><div className="route-icon"><ArrowRight size={10} color="#94a3b8" /></div>{order.dropoff_address}</div>
                    </div>

                    <div className="order-meta">
                      <div className="meta-col">
                        <span className="meta-label">Fee</span>
                        <span className="meta-value-fee">KES {order.fee}</span>
                      </div>
                      <div className="meta-col right">
                        <span className="meta-label">Assigned Rider</span>
                        <span className="meta-value-rider">{riders[order.assigned_rider_id]?.name || 'Unassigned'}</span>
                      </div>
                    </div>

                    {/* Phone & Quick Actions Bar */}
                    <div className="order-actions">
                      <span className="order-phone">{order.customer_phone || 'No Phone'}</span>
                      <div className="actions-group">
                        {order.customer_phone && (
                          <>
                            <a href={`tel:${order.customer_phone}`} className="action-btn call" title="Call"><Phone size={14} /></a>
                            <a href={`https://wa.me/${formatKenyanPhone(order.customer_phone)}?text=${encodeURIComponent(`Hello ${order.customer_name}, Falcon Delivery here regarding your order (${order.order_number}).`)}`} target="_blank" rel="noreferrer" className="action-btn wa" title="WhatsApp"><MessageCircle size={14} /></a>
                          </>
                        )}
                        <button type="button" onClick={() => copyToClipboard(order.customer_phone || order.order_number, order.id)} className="action-btn copy" title="Copy">
                          {copiedOrderId === order.id ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                        </button>
                        {order.status !== 'delivered' && order.status !== 'paid' && (
                          <button onClick={() => triggerMpesa(order.id)} className="action-btn-pay" title="M-Pesa Pay"><Smartphone size={14}/> Pay</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {orders.length === 0 && (
                <div className="empty-state">
                  <Package size={32} color="#cbd5e1" />
                  No active orders on the board
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="map-area">
        {/* Map Overlay Top Left (Metrics) */}
        <div className="map-metrics-overlay">
          <div className="metrics-box">
            <div className="metric-col">
              <span className="metric-label">Deliveries</span>
              <span className="metric-val">{totalOrders}</span>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-col">
              <span className="metric-label">Gross Revenue</span>
              <span className="metric-val green">KES {totalEarnings}</span>
            </div>
          </div>
        </div>

        {/* Map Overlay Top Right (Switch to Finance Tab) */}
        <div className="map-action-overlay">
          <button className="btn-finance" onClick={() => setActiveTab('transactions')}>
            <LayoutDashboard size={18} className="icon-blue" /> Finance Dashboard
          </button>
        </div>

        <MapContainer center={nairobiCenter} zoom={13} style={{ height: '100%', width: '100%', cursor: mapClickMode ? 'crosshair' : 'grab', zIndex: 1 }}>
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
              <Popup>Pickup Location</Popup>
            </Marker>
          )}
          {dispatchMode === 'batch' && batchPickupData.pickupLat && (
            <Marker position={[batchPickupData.pickupLat, batchPickupData.pickupLng]}>
              <Popup>Batch Pickup: {batchMerchant || 'Merchant'}</Popup>
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
