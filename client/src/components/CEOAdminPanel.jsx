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

  // Batch Multi-Order State (e.g. Merchant "Hannan" with multiple dropoffs)
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

  // ── Batch Handlers ────────────────────────────────────────────────────────
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

    // Reset only the recipient-specific fields for quick consecutive entry
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
          // Pass the orderId so the edge function can save the CheckoutRequestID
          // to the order for reliable callback reconciliation
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
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Package size={20} /> Dispatch Order
            </h2>
            {/* Single vs Batch Mode Switcher */}
            <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${dispatchMode === 'single' ? 'bg-white text-primary-color shadow-sm font-bold' : 'text-gray-500 hover:text-gray-900'}`}
                onClick={() => setDispatchMode('single')}
              >
                Single
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${dispatchMode === 'batch' ? 'bg-white text-primary-color shadow-sm font-bold' : 'text-gray-500 hover:text-gray-900'}`}
                onClick={() => setDispatchMode('batch')}
              >
                <Layers size={13} /> Batch (Multi)
              </button>
            </div>
          </div>

          {dispatchMode === 'single' ? (
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
                <button type="button" className="btn btn-success w-full justify-center" onClick={() => triggerMpesa(null)} title="Send M-Pesa request (link to order after dispatching)">
                  <Smartphone size={18} /> 
                  {paymentStatus === 'loading' ? '...' : paymentStatus === 'success' ? 'Sent!' : 'M-Pesa'}
                </button>
              </div>
            </form>
          ) : (
            /* ── Batch Multi-Order Form (Mockup: Hannan -> Fatma, Erick...) ── */
            <div className="space-y-3">
              {/* Merchant & Pickup Header */}
              <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-100 space-y-2">
                <div className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center justify-between">
                  <span>Sender / Merchant Details</span>
                  <span className="text-[11px] font-normal text-blue-700">Common for all stops</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-600 block mb-0.5 font-medium">Merchant / Client</label>
                    <input
                      type="text"
                      className="form-control text-sm py-1.5"
                      placeholder="e.g. Hannan"
                      value={batchMerchant}
                      onChange={(e) => setBatchMerchant(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-600 block mb-0.5 font-medium">Pickup Location</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        className="form-control text-sm py-1.5 flex-1"
                        placeholder="e.g. CBD Shop #4"
                        value={batchPickupData.pickup}
                        onChange={(e) => setBatchPickupData({ ...batchPickupData, pickup: e.target.value })}
                      />
                      <button
                        type="button"
                        className={`btn px-2 py-1 ${mapClickMode === 'pickup' ? 'btn-primary' : 'bg-white text-gray-600 border border-gray-200'}`}
                        onClick={() => setMapClickMode(mapClickMode === 'pickup' ? null : 'pickup')}
                        title="Pick on map"
                      >
                        <MousePointerClick size={15} />
                      </button>
                    </div>
                  </div>
                </div>
                {mapClickMode === 'pickup' && <div className="text-xs text-blue-600 animate-pulse">Click map to set batch pickup location...</div>}
              </div>

              {/* Queued Deliveries List */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3 py-1.5 flex justify-between items-center text-xs font-bold text-gray-700">
                  <span>Queued Deliveries ({batchItems.length})</span>
                  <span className="text-primary-color font-bold">
                    Total: KES {batchItems.reduce((acc, i) => acc + (parseFloat(i.fee) || 0), 0)}
                  </span>
                </div>
                <div className="max-h-[160px] overflow-y-auto divide-y divide-gray-100 bg-white">
                  {batchItems.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400">
                      No orders in batch yet. Add customer deliveries below.
                    </div>
                  ) : (
                    batchItems.map((item, idx) => (
                      <div key={item.id} className="p-2 flex items-center justify-between text-xs hover:bg-gray-50 transition">
                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                          <span className="w-5 h-5 rounded-full bg-primary-color/10 text-primary-color font-bold flex items-center justify-center text-[11px] shrink-0">
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                              <span>{item.customerName}</span>
                              {item.customerPhone && (
                                <span className="text-gray-400 font-normal text-[11px]">({item.customerPhone})</span>
                              )}
                            </div>
                            <div className="text-gray-500 text-[11px] truncate">
                              📍 {item.dropoff} {item.description && `· ${item.description}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-green-700 text-xs">KES {item.fee}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchItem(item.id)}
                            className="text-red-400 hover:text-red-600 p-1"
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Delivery Stop Form */}
              <form onSubmit={handleAddBatchItem} className="bg-gray-50 p-2.5 rounded-lg border border-dashed border-gray-300 space-y-2">
                <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                  + Add Stop / Recipient
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    className="form-control text-xs py-1 px-2"
                    placeholder="Customer (e.g. Fatma)"
                    value={newBatchItem.customerName}
                    onChange={(e) => setNewBatchItem({ ...newBatchItem, customerName: e.target.value })}
                  />
                  <input
                    type="text"
                    className="form-control text-xs py-1 px-2"
                    placeholder="Destination (e.g. majengo)"
                    value={newBatchItem.dropoff}
                    onChange={(e) => setNewBatchItem({ ...newBatchItem, dropoff: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    className="form-control text-xs py-1 px-2"
                    placeholder="Phone (07...)"
                    value={newBatchItem.customerPhone}
                    onChange={(e) => setNewBatchItem({ ...newBatchItem, customerPhone: e.target.value })}
                  />
                  <input
                    type="number"
                    className="form-control text-xs py-1 px-2"
                    placeholder="Fee (KES)"
                    value={newBatchItem.fee}
                    onChange={(e) => setNewBatchItem({ ...newBatchItem, fee: e.target.value })}
                  />
                  <input
                    type="text"
                    className="form-control text-xs py-1 px-2"
                    placeholder="Note (optional)"
                    value={newBatchItem.description}
                    onChange={(e) => setNewBatchItem({ ...newBatchItem, description: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  className="btn bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 w-full py-1 text-xs justify-center font-semibold"
                >
                  <Plus size={14} /> Add Delivery to Batch
                </button>
              </form>

              {/* Batch Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-primary flex-1 justify-center py-2 text-sm font-bold shadow"
                  onClick={handleBatchDispatch}
                  disabled={batchItems.length === 0}
                >
                  <Send size={16} /> Dispatch All ({batchItems.length} Orders)
                </button>
                {batchItems.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline py-2 text-xs text-gray-500 hover:text-red-600"
                    onClick={() => setBatchItems([])}
                    title="Clear batch"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Active Orders List with Phone Features (Call, WhatsApp, Copy, Pay) ── */}
        <div className="card mt-4 max-h-[340px] overflow-y-auto">
          <h3 className="font-bold mb-3 text-sm text-gray-500 uppercase tracking-wider">Active Orders</h3>
          {orders.map(order => (
            <div key={order.id} className="p-3 mb-2 border border-gray-100 rounded-lg hover:shadow-sm transition-shadow bg-gray-50">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-gray-800">{order.customer_name}</span>
                <span className={`status-badge status-${order.status === 'delivered' ? 'online' : (order.status === 'paid' ? 'online' : 'busy')}`} style={{ fontSize: '0.65rem' }}>
                  {order.status}
                </span>
              </div>
              
              <div className="text-gray-500 text-xs truncate max-w-full">
                {order.pickup_address} → {order.dropoff_address}
              </div>

              {/* Customer Phone & Quick Actions Bar */}
              {order.customer_phone && (
                <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-gray-100 text-xs">
                  <span className="font-mono text-gray-600 text-[11px]">
                    {order.customer_phone}
                  </span>
                  <div className="flex items-center gap-1">
                    <a
                      href={`tel:${order.customer_phone}`}
                      className="p-1 rounded text-blue-600 hover:bg-blue-50 transition"
                      title={`Call ${order.customer_name}`}
                    >
                      <Phone size={13} />
                    </a>
                    <a
                      href={`https://wa.me/${formatKenyanPhone(order.customer_phone)}?text=${encodeURIComponent(`Hello ${order.customer_name}, Falcon Delivery here regarding your order (${order.order_number}).`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 rounded text-green-600 hover:bg-green-50 transition"
                      title={`WhatsApp ${order.customer_name}`}
                    >
                      <MessageCircle size={13} />
                    </a>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(order.customer_phone, order.id)}
                      className="p-1 rounded text-gray-500 hover:bg-gray-200 transition"
                      title="Copy Phone Number"
                    >
                      {copiedOrderId === order.id ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="text-gray-600 mt-1.5 text-xs font-semibold flex justify-between items-center">
                <span>KES {order.fee}</span>
                <div className="flex gap-2 items-center">
                  <span className="text-primary-color">{riders[order.assigned_rider_id]?.name || 'Unassigned'}</span>
                  {/* M-Pesa button linked to THIS specific order for accurate reconciliation */}
                  {order.status !== 'delivered' && order.status !== 'paid' && (
                    <button
                      onClick={() => triggerMpesa(order.id)}
                      className="btn btn-success"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}
                      title="Trigger M-Pesa payment for this order"
                    >
                      <Smartphone size={11} /> Pay
                    </button>
                  )}
                </div>
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
