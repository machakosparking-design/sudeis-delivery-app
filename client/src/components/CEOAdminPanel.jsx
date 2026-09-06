import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  Send, MapPin, Package, Smartphone, DollarSign, Activity, Users, 
  LayoutDashboard, Map as MapIcon, MousePointerClick, Plus, Trash2, 
  ListPlus, ListChecks, Layers, Phone, MessageCircle, Copy, Check,
  ArrowRight
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
      <div className="p-6 bg-gray-50 h-full overflow-y-auto w-full absolute top-0 left-0 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Financial Dashboard</h1>
            <div className="flex gap-4">
              <button className="bg-white hover:bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl shadow-sm border border-gray-200 font-bold transition-all flex items-center gap-2" onClick={() => setActiveTab('dispatch')}>
                <MapIcon size={18} className="text-blue-600" /> Live Map
              </button>
              <button className="bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-md font-bold flex items-center gap-2">
                <LayoutDashboard size={18} /> Finance
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-600">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Gross Revenue</div>
              <div className="text-4xl font-black text-gray-900">KES {totalEarnings}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-500">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Deliveries</div>
              <div className="text-4xl font-black text-gray-900">{totalOrders}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-amber-500">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Active Fleet</div>
              <div className="text-4xl font-black text-gray-900">{activeRiders} / {Object.keys(riders).length || 3}</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg mb-6 flex items-center gap-2">
                <DollarSign size={20} className="text-blue-600"/> Gross Revenue by Rider
              </h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={riderStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(value) => `KES ${value}`} />
                    <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                    <Bar dataKey="grossRevenue" fill="#2563EB" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg mb-6 flex items-center gap-2">
                <Activity size={20} className="text-green-500"/> Completed Orders by Rider
              </h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={riderStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                    <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                    <Bar dataKey="orders" fill="#10B981" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Order History */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 text-lg mb-4">Historical Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="p-3 font-bold">Order #</th>
                    <th className="p-3 font-bold">Customer</th>
                    <th className="p-3 font-bold">Route</th>
                    <th className="p-3 font-bold">Rider</th>
                    <th className="p-3 font-bold">Gross Fee</th>
                    <th className="p-3 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {orders.filter(o => o.status === 'delivered').map(order => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-mono font-medium text-gray-500">{order.order_number}</td>
                      <td className="p-3 font-bold text-gray-900">{order.customer_name}</td>
                      <td className="p-3 text-gray-600">
                        <div className="truncate max-w-xs flex items-center gap-2">
                          <MapPin size={14} className="text-gray-400" /> {order.pickup_address} <ArrowRight size={14} className="text-gray-300" /> {order.dropoff_address}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
                          {riders[order.assigned_rider_id]?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-3 font-black text-green-600">KES {order.fee}</td>
                      <td className="p-3 text-gray-400">{new Date(order.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {orders.filter(o => o.status === 'delivered').length === 0 && (
                    <tr><td colSpan="6" className="text-center p-8 text-gray-400 font-medium">No transactions recorded yet.</td></tr>
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
    <div className="flex flex-1 h-[calc(100vh-74px)] bg-gray-100 overflow-hidden relative w-full">
      {/* Sidebar Panel */}
      <div className="w-full md:w-[450px] bg-white border-r border-gray-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.03)] z-10">
        
        {/* Sidebar Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button 
            className={`flex-1 py-4 text-sm font-black transition-all flex items-center justify-center gap-2 tracking-wide uppercase ${activeSidebarTab === 'dispatch' ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
            onClick={() => setActiveSidebarTab('dispatch')}
          >
            <Package size={18} /> Dispatch
          </button>
          <button 
            className={`flex-1 py-4 text-sm font-black transition-all flex items-center justify-center gap-2 tracking-wide uppercase ${activeSidebarTab === 'orders' ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
            onClick={() => setActiveSidebarTab('orders')}
          >
            <ListChecks size={18} /> Active ({orders.length})
          </button>
        </div>

        {/* Sidebar Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {activeSidebarTab === 'dispatch' && (
            <div className="p-5 space-y-6">
              {/* Dispatch Mode Switcher */}
              <div className="bg-gray-200/70 p-1.5 rounded-xl flex shadow-inner">
                <button
                  type="button"
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${dispatchMode === 'single' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                  onClick={() => setDispatchMode('single')}
                >
                  <Package size={16} /> Single Route
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${dispatchMode === 'batch' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                  onClick={() => setDispatchMode('batch')}
                >
                  <Layers size={16} /> Batch (Multi)
                </button>
              </div>

              {/* Forms */}
              {dispatchMode === 'single' ? (
                <form onSubmit={handleDispatch} className="space-y-4">
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1.5 font-bold uppercase tracking-wider">Customer Name</label>
                    <input type="text" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm font-medium" name="customerName" value={formData.customerName} onChange={handleInputChange} required />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1.5 font-bold uppercase tracking-wider">Pickup Location</label>
                    <div className="flex gap-2">
                      <input type="text" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm font-medium" name="pickup" value={formData.pickup} onChange={handleInputChange} required />
                      <button type="button" 
                        className={`p-3 rounded-xl transition-all shadow-sm ${mapClickMode === 'pickup' ? 'bg-blue-600 text-white shadow-blue-600/30' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`} 
                        onClick={() => setMapClickMode(mapClickMode === 'pickup' ? null : 'pickup')}
                        title="Click map to set">
                        <MousePointerClick size={20} />
                      </button>
                    </div>
                    {mapClickMode === 'pickup' && <div className="text-xs text-blue-600 mt-2 font-bold animate-pulse flex items-center gap-1"><MousePointerClick size={14}/> Click anywhere on map to set pickup...</div>}
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1.5 font-bold uppercase tracking-wider">Delivery Location</label>
                    <div className="flex gap-2">
                      <input type="text" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm font-medium" name="dropoff" value={formData.dropoff} onChange={handleInputChange} required />
                      <button type="button" 
                        className={`p-3 rounded-xl transition-all shadow-sm ${mapClickMode === 'dropoff' ? 'bg-blue-600 text-white shadow-blue-600/30' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`} 
                        onClick={() => setMapClickMode(mapClickMode === 'dropoff' ? null : 'dropoff')}
                        title="Click map to set">
                        <MousePointerClick size={20} />
                      </button>
                    </div>
                    {mapClickMode === 'dropoff' && <div className="text-xs text-blue-600 mt-2 font-bold animate-pulse flex items-center gap-1"><MousePointerClick size={14}/> Click anywhere on map to set delivery...</div>}
                  </div>

                  <div className="flex gap-4">
                    <div className="w-full">
                      <label className="text-[11px] text-gray-500 block mb-1.5 font-bold uppercase tracking-wider">Phone</label>
                      <input type="text" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm font-medium" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} required placeholder="2547..." />
                    </div>
                    <div className="w-full">
                      <label className="text-[11px] text-gray-500 block mb-1.5 font-bold uppercase tracking-wider">Fee (KES)</label>
                      <input type="number" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm font-medium font-black text-green-700" name="fee" value={formData.fee} onChange={handleInputChange} required />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="submit" className="flex-1 py-3.5 bg-gray-900 text-white rounded-xl shadow-lg hover:bg-gray-800 transition-all font-bold text-sm flex justify-center items-center gap-2">
                      <Send size={18} /> Dispatch Now
                    </button>
                    <button type="button" className="px-6 py-3.5 bg-green-500 text-white rounded-xl shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all font-bold text-sm flex justify-center items-center gap-2" onClick={() => triggerMpesa(null)} title="Send M-Pesa request">
                      <Smartphone size={18} /> 
                      {paymentStatus === 'loading' ? '...' : paymentStatus === 'success' ? 'Sent!' : 'Pay'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5">
                  {/* Merchant & Pickup Header */}
                  <div className="bg-blue-50/70 p-5 rounded-2xl border border-blue-100 space-y-4">
                    <div className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center justify-between">
                      <div className="flex items-center gap-2"><MapPin size={16} className="text-blue-600" /> Sender Profile</div>
                      <span className="text-[10px] bg-blue-100 px-2 py-1 rounded-full text-blue-700 font-bold">Common Pickup</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[11px] text-blue-800/70 block mb-1.5 font-bold uppercase tracking-wider">Merchant / Client Name</label>
                        <input
                          type="text"
                          className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none font-bold text-gray-800 shadow-sm"
                          placeholder="e.g. Hannan"
                          value={batchMerchant}
                          onChange={(e) => setBatchMerchant(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-blue-800/70 block mb-1.5 font-bold uppercase tracking-wider">Pickup Location</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none font-medium text-gray-800 shadow-sm"
                            placeholder="e.g. CBD Shop #4"
                            value={batchPickupData.pickup}
                            onChange={(e) => setBatchPickupData({ ...batchPickupData, pickup: e.target.value })}
                          />
                          <button
                            type="button"
                            className={`p-2.5 rounded-xl transition-all shadow-sm ${mapClickMode === 'pickup' ? 'bg-blue-600 text-white shadow-blue-600/30' : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'}`}
                            onClick={() => setMapClickMode(mapClickMode === 'pickup' ? null : 'pickup')}
                            title="Pick on map"
                          >
                            <MousePointerClick size={20} />
                          </button>
                        </div>
                        {mapClickMode === 'pickup' && <div className="text-xs text-blue-600 font-bold mt-2 animate-pulse flex items-center gap-1"><MousePointerClick size={14}/> Click map to set batch pickup location...</div>}
                      </div>
                    </div>
                  </div>

                  {/* Queued Deliveries List */}
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-5 py-3 flex justify-between items-center border-b border-gray-100">
                      <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider">Deliveries ({batchItems.length})</span>
                      <span className="text-green-600 font-black text-sm">
                        KES {batchItems.reduce((acc, i) => acc + (parseFloat(i.fee) || 0), 0)}
                      </span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto divide-y divide-gray-50">
                      {batchItems.length === 0 ? (
                        <div className="text-center py-8 text-sm text-gray-400 font-medium">
                          No deliveries added yet.
                        </div>
                      ) : (
                        batchItems.map((item, idx) => (
                          <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                              <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs shrink-0">
                                {idx + 1}
                              </span>
                              <div className="truncate">
                                <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                  {item.customerName}
                                  {item.customerPhone && (
                                    <span className="text-gray-400 font-medium text-xs font-mono">({item.customerPhone})</span>
                                  )}
                                </div>
                                <div className="text-gray-500 text-xs truncate mt-1 flex items-center gap-1.5 font-medium">
                                  <MapPin size={12} className="text-gray-400"/> {item.dropoff} {item.description && <span className="text-gray-400">· {item.description}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <span className="font-black text-green-600 text-sm">KES {item.fee}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveBatchItem(item.id)}
                                className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                title="Remove"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add Delivery Stop Form */}
                  <form onSubmit={handleAddBatchItem} className="bg-white p-5 rounded-2xl border border-dashed border-gray-300 space-y-4 hover:border-gray-400 transition-colors">
                    <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <Plus size={14} /> Add Dropoff Stop
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium text-gray-900"
                        placeholder="Customer Name"
                        value={newBatchItem.customerName}
                        onChange={(e) => setNewBatchItem({ ...newBatchItem, customerName: e.target.value })}
                      />
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium text-gray-900"
                        placeholder="Destination (e.g. Majengo)"
                        value={newBatchItem.dropoff}
                        onChange={(e) => setNewBatchItem({ ...newBatchItem, dropoff: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium text-gray-900"
                        placeholder="Phone"
                        value={newBatchItem.customerPhone}
                        onChange={(e) => setNewBatchItem({ ...newBatchItem, customerPhone: e.target.value })}
                      />
                      <input
                        type="number"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-black text-green-700 placeholder:text-gray-400 placeholder:font-medium"
                        placeholder="Fee"
                        value={newBatchItem.fee}
                        onChange={(e) => setNewBatchItem({ ...newBatchItem, fee: e.target.value })}
                      />
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium text-gray-900"
                        placeholder="Note (Opt)"
                        value={newBatchItem.description}
                        onChange={(e) => setNewBatchItem({ ...newBatchItem, description: e.target.value })}
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-gray-100 text-gray-800 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 mt-2 border border-gray-200"
                    >
                      <Plus size={16} /> Add to Queue
                    </button>
                  </form>

                  {/* Batch Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      className="flex-1 py-3.5 bg-gray-900 text-white rounded-xl shadow-lg shadow-gray-900/20 hover:bg-gray-800 hover:shadow-xl transition-all font-bold text-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleBatchDispatch}
                      disabled={batchItems.length === 0}
                    >
                      <Send size={18} /> Dispatch Batch ({batchItems.length})
                    </button>
                    {batchItems.length > 0 && (
                      <button
                        type="button"
                        className="px-5 py-3.5 bg-white border border-gray-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors font-bold text-sm flex justify-center items-center shadow-sm"
                        onClick={() => setBatchItems([])}
                        title="Clear batch"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSidebarTab === 'orders' && (
            <div className="p-5 space-y-4">
              {orders.map(order => (
                <div key={order.id} className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    order.status === 'delivered' ? 'bg-green-500' : 
                    order.status === 'paid' ? 'bg-emerald-500' : 
                    'bg-amber-500'
                  }`}></div>
                  
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-black text-gray-900 text-base leading-none">{order.customer_name}</h4>
                      <div className="text-[10px] text-gray-400 font-mono mt-1.5 uppercase tracking-wider">{order.order_number}</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-700' : 
                      order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-2 text-gray-600 text-xs mt-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 font-medium">
                      <div className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
                        <MapPin size={10} className="text-gray-400"/>
                      </div>
                      <span className="truncate">{order.pickup_address}</span>
                    </div>
                    <div className="w-0.5 h-3 bg-gray-200 ml-2.5"></div>
                    <div className="flex items-center gap-2 font-medium">
                      <div className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
                        <ArrowRight size={10} className="text-gray-400"/>
                      </div>
                      <span className="truncate">{order.dropoff_address}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Fee</span>
                      <span className="font-black text-green-600 text-base leading-none">KES {order.fee}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Assigned Rider</span>
                      <span className="font-bold text-blue-600 text-sm leading-none bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                        {riders[order.assigned_rider_id]?.name || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {/* Phone & Quick Actions Bar */}
                  <div className="flex items-center justify-between mt-4 bg-gray-50 p-2 rounded-xl border border-gray-100">
                    <span className="font-mono text-gray-700 text-xs font-bold pl-2 tracking-wide">
                      {order.customer_phone || 'No Phone'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {order.customer_phone && (
                        <>
                          <a href={`tel:${order.customer_phone}`} className="p-2 rounded-lg bg-white border border-gray-200 text-blue-600 hover:bg-blue-50 transition shadow-sm" title="Call">
                            <Phone size={14} />
                          </a>
                          <a href={`https://wa.me/${formatKenyanPhone(order.customer_phone)}?text=${encodeURIComponent(`Hello ${order.customer_name}, Falcon Delivery here regarding your order (${order.order_number}).`)}`} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-white border border-gray-200 text-green-600 hover:bg-green-50 transition shadow-sm" title="WhatsApp">
                            <MessageCircle size={14} />
                          </a>
                        </>
                      )}
                      <button type="button" onClick={() => copyToClipboard(order.customer_phone || order.order_number, order.id)} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition shadow-sm" title="Copy">
                        {copiedOrderId === order.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                      </button>
                      {order.status !== 'delivered' && order.status !== 'paid' && (
                        <button onClick={() => triggerMpesa(order.id)} className="p-2 px-4 rounded-lg bg-green-500 text-white font-bold text-xs hover:bg-green-600 transition shadow-sm ml-1 flex items-center gap-1" title="M-Pesa Pay">
                          <Smartphone size={14}/> Pay
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="text-gray-400 text-center py-16 text-sm font-medium flex flex-col items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <Package size={32} className="text-gray-300"/>
                  No active orders on the board
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative z-0">
        {/* Map Overlay Top Left (Metrics) */}
        <div className="absolute top-5 left-5 z-[400] flex gap-3 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 px-6 flex items-center gap-8 pointer-events-auto">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Deliveries</span>
              <span className="text-2xl font-black text-gray-900 leading-none">{totalOrders}</span>
            </div>
            <div className="w-px h-10 bg-gray-100"></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gross Revenue</span>
              <span className="text-2xl font-black text-green-600 leading-none">KES {totalEarnings}</span>
            </div>
          </div>
        </div>

        {/* Map Overlay Top Right (Switch to Finance Tab) */}
        <div className="absolute top-5 right-5 z-[400]">
          <button 
            className="bg-white hover:bg-gray-50 text-gray-800 px-6 py-3 rounded-2xl shadow-xl border border-gray-200 font-bold transition-all flex items-center gap-2 pointer-events-auto"
            onClick={() => setActiveTab('transactions')}
          >
            <LayoutDashboard size={18} className="text-blue-600" />
            Finance Dashboard
          </button>
        </div>

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
