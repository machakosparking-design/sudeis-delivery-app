import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  Send, MapPin, Package, Smartphone, DollarSign, Activity, Users, 
  LayoutDashboard, Map as MapIcon, MousePointerClick, Plus, Trash2, 
  Layers, Phone, MessageCircle, Copy, Check, ArrowRight, X, Clock,
  CheckCircle, Receipt, AlertCircle, Loader2
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

  // STK Push Modal State
  const [stkModalData, setStkModalData] = useState({
    isOpen: false,
    orderId: null,
    orderNumber: '',
    customerName: '',
    amount: '',
    phone: ''
  });
  const [stkStatus, setStkStatus] = useState(null); // 'loading', 'success', 'error'
  const [stkMessage, setStkMessage] = useState('');

  // Payment Realtime Toast Banner
  const [paymentToast, setPaymentToast] = useState(null);

  // Active Orders Filter
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('all'); // 'all', 'unpaid', 'paid'

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
          setOrders(prev => {
            const oldOrder = prev.find(o => o.id === payload.new.id);
            // Detect newly paid order to trigger live toast
            if (payload.new.status === 'paid' && oldOrder && oldOrder.status !== 'paid') {
              setPaymentToast({
                customer: payload.new.customer_name,
                amount: payload.new.fee,
                receipt: payload.new.mpesa_receipt || 'Received',
                orderNumber: payload.new.order_number
              });
              setTimeout(() => setPaymentToast(null), 8000);
            }
            return prev.map(o => o.id === payload.new.id ? payload.new : o);
          });
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
      fee: parseFloat(formData.fee),
      status: 'pending'
    }]).select();

    if (!error) {
      const createdOrder = data?.[0];
      setFormData({ 
        customerName: '', customerPhone: '', 
        pickup: '', pickupLat: null, pickupLng: null,
        dropoff: '', dropoffLat: null, dropoffLng: null, 
        fee: '' 
      });
      alert("Order dispatched to riders!");

      // Option: Prompt if they want to trigger STK immediately
      if (createdOrder && createdOrder.customer_phone) {
        openStkModal(createdOrder);
      }
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

  // ── Open STK Modal for an Existing Order ───────────────────────────────────
  const openStkModal = (order) => {
    setStkModalData({
      isOpen: true,
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      amount: order.fee,
      phone: order.customer_phone || ''
    });
    setStkStatus(null);
    setStkMessage('');
  };

  // ── Open STK Modal from Dispatch Form (Single Order) ───────────────────────
  const openDispatchFormStkModal = () => {
    if (!formData.customerPhone || !formData.fee) {
      alert("Please enter customer phone and fee in the dispatch form first.");
      return;
    }
    setStkModalData({
      isOpen: true,
      orderId: null,
      orderNumber: 'New Dispatch',
      customerName: formData.customerName || 'Customer',
      amount: formData.fee,
      phone: formData.customerPhone
    });
    setStkStatus(null);
    setStkMessage('');
  };

  // ── Send M-Pesa STK Push from Modal ───────────────────────────────────────
  const handleSendStkPush = async (e) => {
    e.preventDefault();
    if (!stkModalData.phone || !stkModalData.amount) {
      setStkStatus('error');
      setStkMessage('Phone number and amount are required.');
      return;
    }

    setStkStatus('loading');
    setStkMessage('Sending STK prompt to customer phone...');

    try {
      const { data, error } = await supabase.functions.invoke('mpesa-stk', {
        body: { 
          phone: stkModalData.phone, 
          amount: parseFloat(stkModalData.amount), 
          orderId: stkModalData.orderId 
        }
      });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to trigger STK push');
      }

      setStkStatus('success');
      setStkMessage(`STK push sent to ${stkModalData.phone}! Awaiting customer PIN on phone.`);
      
      // Auto-close modal after 3.5 seconds on success
      setTimeout(() => {
        setStkModalData(prev => ({ ...prev, isOpen: false }));
        setStkStatus(null);
      }, 3500);

    } catch (err) {
      console.error('STK Push Error:', err);
      setStkStatus('error');
      setStkMessage(err.message || 'M-Pesa STK push request failed.');
    }
  };

  // ── Revenue & Metric Calculations ──────────────────────────────────────────
  const totalCollectedRevenue = orders
    .filter(o => o.status === 'paid' || o.status === 'delivered' || o.mpesa_receipt)
    .reduce((acc, o) => acc + (parseFloat(o.fee) || 0), 0);

  const totalPendingRevenue = orders
    .filter(o => o.status !== 'paid' && o.status !== 'delivered' && !o.mpesa_receipt)
    .reduce((acc, o) => acc + (parseFloat(o.fee) || 0), 0);

  const totalPaidOrders = orders.filter(o => o.status === 'paid' || o.mpesa_receipt).length;
  const activeRiders = Object.values(riders).filter(r => r.status === 'online' || r.status === 'busy').length;
  const nairobiCenter = [-1.2921, 36.8219];

  // Filter active orders based on payment status
  const filteredActiveOrders = orders.filter(o => {
    if (o.status === 'delivered') return false;
    const isPaid = o.status === 'paid' || !!o.mpesa_receipt;
    if (orderPaymentFilter === 'paid') return isPaid;
    if (orderPaymentFilter === 'unpaid') return !isPaid;
    return true;
  });

  const riderStats = Object.values(riders).map(rider => ({
    name: rider.name,
    grossRevenue: Number(rider.earnings || 0),
    orders: rider.orders_completed || 0
  }));

  // List of all received payments for Finance dashboard
  const paidOrdersList = orders.filter(o => o.status === 'paid' || o.mpesa_receipt);

  if (activeTab === 'finance') {
    return (
      <div className="finance-dashboard">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Payment & Financial Overview</h1>
          <button className="btn btn-primary" onClick={() => setActiveTab('dashboard')}>
            <MapIcon size={16} /> Back to Live Map
          </button>
        </div>

        {/* Financial Highlights */}
        <div className="metric-grid mb-4">
          <div className="metric-card">
            <div className="metric-label">Total Collected</div>
            <div className="metric-value text-green">KES {totalCollectedRevenue.toLocaleString()}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Pending Collection</div>
            <div className="metric-value" style={{ color: '#F59E0B' }}>KES {totalPendingRevenue.toLocaleString()}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Paid Transactions</div>
            <div className="metric-value text-blue">{totalPaidOrders} / {orders.length}</div>
          </div>
        </div>

        {/* Received Payments Ledger */}
        <div className="card mb-4">
          <div className="card-header">
            <Receipt size={18} /> Recent M-Pesa Payments Received ({paidOrdersList.length})
          </div>
          {paidOrdersList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No payments recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Receipt #</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Order #</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Customer</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Phone</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Amount</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paidOrdersList.map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontWeight: 700, color: '#1E40AF' }}>
                        {order.mpesa_receipt || 'M-PESA'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {order.order_number}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>
                        {order.customer_name}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                        {order.customer_phone || '—'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#16A34A' }}>
                        KES {order.fee}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span className="badge-paid">
                          <CheckCircle size={12} /> PAID
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rider Revenue Chart */}
        <div className="card">
          <div className="card-header"><DollarSign size={18} /> Revenue by Rider</div>
          <div style={{ width: '100%', height: '280px' }}>
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
      {/* Real-time Payment Toast Notification */}
      {paymentToast && (
        <div className="payment-toast">
          <CheckCircle size={24} color="#10B981" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.9rem' }}>Payment Received!</div>
            <div style={{ fontSize: '0.8rem', color: '#16A34A', fontWeight: 700 }}>
              KES {paymentToast.amount} · {paymentToast.customer}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>
              Receipt: {paymentToast.receipt}
            </div>
          </div>
          <button className="toast-close-btn" onClick={() => setPaymentToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* STK Push Confirmation Modal */}
      {stkModalData.isOpen && (
        <div className="modal-backdrop" onClick={() => setStkModalData(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Smartphone size={18} color="#10B981" /> Send M-Pesa STK Push</h3>
              <button 
                type="button" 
                onClick={() => setStkModalData(prev => ({ ...prev, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendStkPush}>
              <div className="modal-body">
                {/* Order Summary Box */}
                <div style={{ backgroundColor: '#F8FAFC', padding: '0.85rem', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Order Summary</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{stkModalData.customerName}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748B' }}>{stkModalData.orderNumber}</span>
                  </div>
                </div>

                {/* Status / Feedback Banner */}
                {stkStatus === 'loading' && (
                  <div style={{ backgroundColor: '#EFF6FF', color: '#1E40AF', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                    <Loader2 size={16} className="animate-spin" /> {stkMessage}
                  </div>
                )}
                {stkStatus === 'success' && (
                  <div style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontWeight: 600 }}>
                    <CheckCircle size={16} /> {stkMessage}
                  </div>
                )}
                {stkStatus === 'error' && (
                  <div style={{ backgroundColor: '#FEE2E2', color: '#B91C1C', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontWeight: 600 }}>
                    <AlertCircle size={16} /> {stkMessage}
                  </div>
                )}

                {/* Editable Phone Field */}
                <div className="form-group">
                  <label>Customer Safaricom Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={stkModalData.phone}
                    onChange={(e) => setStkModalData({ ...stkModalData, phone: e.target.value })}
                    placeholder="e.g. 0712345678 or 254..."
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                    You can change this number if the customer wishes to pay using another M-Pesa line.
                  </span>
                </div>

                {/* Editable Amount Field */}
                <div className="form-group">
                  <label>Amount to Charge (KES)</label>
                  <input 
                    type="number" 
                    className="form-control font-bold" 
                    value={stkModalData.amount}
                    onChange={(e) => setStkModalData({ ...stkModalData, amount: e.target.value })}
                    style={{ fontSize: '1.1rem', color: '#16A34A' }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-outline-dark" 
                  onClick={() => setStkModalData(prev => ({ ...prev, isOpen: false }))}
                  disabled={stkStatus === 'loading'}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-success" 
                  disabled={stkStatus === 'loading'}
                >
                  {stkStatus === 'loading' ? 'Sending...' : 'Send STK Push Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Left Column: Sidebar with forms & active orders */}
      <div className="sidebar-scrollable">
        {/* Top Summary Metrics */}
        <div className="metric-grid">
          <div className="metric-card">
            <DollarSign size={18} className="text-green" style={{ margin: '0 auto' }} />
            <div className="metric-value text-green">KES {totalCollectedRevenue.toLocaleString()}</div>
            <div className="metric-label">Collected</div>
          </div>
          <div className="metric-card">
            <Clock size={18} style={{ margin: '0 auto', color: '#F59E0B' }} />
            <div className="metric-value" style={{ color: '#F59E0B' }}>KES {totalPendingRevenue.toLocaleString()}</div>
            <div className="metric-label">Pending</div>
          </div>
          <div className="metric-card">
            <Receipt size={18} className="text-blue" style={{ margin: '0 auto' }} />
            <div className="metric-value text-blue">{totalPaidOrders} / {orders.length}</div>
            <div className="metric-label">Paid Orders</div>
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
                  onClick={openDispatchFormStkModal}
                  title="Verify & Send M-Pesa STK Prompt"
                >
                  <Smartphone size={15} /> Pay
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="card-header" style={{ margin: 0 }}>
              <Activity size={18} /> Active Orders ({filteredActiveOrders.length})
            </div>
          </div>

          {/* Payment Status Filter Pills */}
          <div className="filter-pills">
            <button 
              type="button" 
              className={`filter-pill ${orderPaymentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setOrderPaymentFilter('all')}
            >
              All ({orders.filter(o => o.status !== 'delivered').length})
            </button>
            <button 
              type="button" 
              className={`filter-pill ${orderPaymentFilter === 'unpaid' ? 'active' : ''}`}
              onClick={() => setOrderPaymentFilter('unpaid')}
            >
              Unpaid ({orders.filter(o => o.status !== 'delivered' && o.status !== 'paid' && !o.mpesa_receipt).length})
            </button>
            <button 
              type="button" 
              className={`filter-pill ${orderPaymentFilter === 'paid' ? 'active' : ''}`}
              onClick={() => setOrderPaymentFilter('paid')}
            >
              Paid ({orders.filter(o => o.status !== 'delivered' && (o.status === 'paid' || !!o.mpesa_receipt)).length})
            </button>
          </div>

          {filteredActiveOrders.map(order => {
            const isPaid = order.status === 'paid' || !!order.mpesa_receipt;
            
            return (
              <div key={order.id} className="order-card-item" style={{ borderLeftColor: isPaid ? '#10B981' : 'var(--secondary-color)' }}>
                <div className="flex justify-between items-center mb-1">
                  <strong style={{ fontSize: '0.92rem' }}>{order.customer_name}</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isPaid ? (
                      <span className="badge-paid">
                        <CheckCircle size={11} /> PAID
                      </span>
                    ) : (
                      <span className="badge-unpaid">
                        <Clock size={11} /> UNPAID
                      </span>
                    )}
                    <span className={`status-badge status-${order.status === 'paid' ? 'online' : 'busy'}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                      {order.status}
                    </span>
                  </div>
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

                {/* M-Pesa Receipt if paid */}
                {order.mpesa_receipt && (
                  <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span 
                      className="receipt-tag" 
                      onClick={() => copyToClipboard(order.mpesa_receipt, order.id + '-rcpt')}
                      title="Click to copy receipt"
                    >
                      <Receipt size={11} /> Receipt: {order.mpesa_receipt}
                      {copiedOrderId === order.id + '-rcpt' && <Check size={11} color="#16A34A" />}
                    </span>
                  </div>
                )}

                {/* Customer Contact & Payment Action Bar */}
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
                    
                    {/* Trigger STK Push modal if not yet paid */}
                    {!isPaid ? (
                      <button 
                        type="button"
                        onClick={() => openStkModal(order)} 
                        className="btn btn-success" 
                        style={{ padding: '2px 8px', fontSize: '0.75rem', height: '28px', gap: '4px' }}
                        title="Send M-Pesa STK push to customer phone"
                      >
                        <Smartphone size={12} /> STK Push
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '4px' }}>
                        <CheckCircle size={13} /> Paid
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredActiveOrders.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              No {orderPaymentFilter !== 'all' ? orderPaymentFilter : 'active'} orders at the moment.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Live Interactive Map */}
      <div className="map-container">
        <button className="floating-finance-btn" onClick={() => setActiveTab('finance')}>
          <LayoutDashboard size={16} /> Finance Dashboard
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
