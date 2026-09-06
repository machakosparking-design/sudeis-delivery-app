import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  Send, MapPin, Package, Smartphone, DollarSign, Activity, Users, 
  LayoutDashboard, Map as MapIcon, MousePointerClick, Plus, Trash2, 
  Layers, Phone, MessageCircle, Copy, Check, ArrowRight, X, Clock,
  CheckCircle, Receipt, AlertCircle, Loader2, RefreshCw, FileText, KeyRound
} from 'lucide-react';
import { supabase } from '../supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { parseAddressAndNote, formatDropoffWithNote } from '../utils/orderUtils';

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

export default function CEOAdminPanel({ userRole }) {
  const [riders, setRiders] = useState({});
  const [orders, setOrders] = useState([]);
  
  // Single Order Form State
  const [formData, setFormData] = useState({ 
    customerName: '', customerPhone: '', 
    pickup: '', pickupLat: null, pickupLng: null,
    dropoff: '', dropoffLat: null, dropoffLng: null, 
    fee: '',
    deliveryNote: '',
    requirePin: false,
    deliveryPin: ''
  });
  const [showSingleNote, setShowSingleNote] = useState(false);
  const [showBatchNote, setShowBatchNote] = useState(false);

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
    phone: '',
    checkoutRequestId: null
  });
  const [stkStatus, setStkStatus] = useState(null); // null, 'sending', 'awaiting_pin', 'paid', 'timeout', 'error'
  const [stkMessage, setStkMessage] = useState('');
  const [stkCountdown, setStkCountdown] = useState(60);
  const [stkPaidDetails, setStkPaidDetails] = useState({ receipt: '', amount: '' });

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
                receipt: payload.new.mpesa_receipt || 'Confirmed',
                orderNumber: payload.new.order_number
              });
              setTimeout(() => setPaymentToast(null), 8000);
            }
            return prev.map(o => o.id === payload.new.id ? payload.new : o);
          });

          // Check if the currently open modal's order just got paid
          const isCurrentModalOrder = stkModalData.isOpen && (
            (stkModalData.orderId && stkModalData.orderId === payload.new.id) ||
            (stkModalData.phone && (
              payload.new.customer_phone === stkModalData.phone ||
              payload.new.customer_phone === ('254' + stkModalData.phone.replace(/^0/, '')) ||
              payload.new.customer_phone === ('0' + stkModalData.phone.replace(/^254/, ''))
            ))
          );

          if (isCurrentModalOrder && (payload.new.status === 'paid' || payload.new.mpesa_receipt)) {
            setStkStatus('paid');
            setStkPaidDetails({
              receipt: payload.new.mpesa_receipt || 'Confirmed',
              amount: payload.new.fee
            });
          }
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
  }, [stkModalData.isOpen, stkModalData.orderId]);

  // ── Polling and Countdown when Awaiting PIN ──────────────────────────────────
  useEffect(() => {
    if (stkStatus !== 'awaiting_pin') return;

    setStkCountdown(60);
    let pollCount = 0;
    const countdownTimer = setInterval(() => {
      setStkCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          setStkStatus('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Active polling every 2.5s for the order status
    const pollTimer = setInterval(async () => {
      pollCount++;
      let orderData = null;

      if (stkModalData.orderId) {
        const { data } = await supabase
          .from('orders')
          .select('id, status, mpesa_receipt, fee, mpesa_checkout_id')
          .eq('id', stkModalData.orderId)
          .maybeSingle();
        orderData = data;
      }

      if (!orderData && stkModalData.phone) {
        const cleanPhone = stkModalData.phone.replace(/[^0-9]/g, '');
        const altPhone = cleanPhone.startsWith('0') ? '254' + cleanPhone.slice(1) : ('0' + cleanPhone.slice(3));
        const { data } = await supabase
          .from('orders')
          .select('id, status, mpesa_receipt, fee, mpesa_checkout_id')
          .or(`customer_phone.eq.${cleanPhone},customer_phone.eq.${altPhone}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        orderData = data;
      }

      // Check 1: Did Supabase DB receive payment confirmation?
      if (orderData && (orderData.status === 'paid' || orderData.mpesa_receipt)) {
        clearInterval(pollTimer);
        clearInterval(countdownTimer);
        setStkStatus('paid');
        setStkPaidDetails({
          receipt: orderData.mpesa_receipt || 'Confirmed',
          amount: orderData.fee
        });
        setOrders(prev => prev.map(o => o.id === orderData.id ? { ...o, status: 'paid', mpesa_receipt: orderData.mpesa_receipt } : o));
        return;
      }

      // Check 2: Active STK Query to Daraja every 5 seconds (every 2nd tick)
      const activeCheckoutId = stkModalData.checkoutRequestId || orderData?.mpesa_checkout_id;
      if (activeCheckoutId && pollCount % 2 === 0) {
        try {
          const { data: queryRes } = await supabase.functions.invoke('mpesa-stk', {
            body: {
              action: 'query',
              checkoutRequestId: activeCheckoutId,
              orderId: stkModalData.orderId || orderData?.id,
              phone: stkModalData.phone
            }
          });

          if (queryRes?.paid) {
            clearInterval(pollTimer);
            clearInterval(countdownTimer);
            const receipt = queryRes.receipt || 'Confirmed';
            const targetId = stkModalData.orderId || orderData?.id;
            setStkStatus('paid');
            setStkPaidDetails({
              receipt: receipt,
              amount: stkModalData.amount || orderData?.fee
            });
            if (targetId) {
              setOrders(prev => prev.map(o => o.id === targetId ? { ...o, status: 'paid', mpesa_receipt: receipt } : o));
            }
          }
        } catch (queryErr) {
          console.warn('Daraja poll check failed:', queryErr);
        }
      }
    }, 2500);

    return () => {
      clearInterval(countdownTimer);
      clearInterval(pollTimer);
    };
  }, [stkStatus, stkModalData.orderId, stkModalData.phone, stkModalData.checkoutRequestId]);

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!formData.customerName || !formData.fee) return;
    
    const pickupLat = formData.pickupLat || -1.2921 + (Math.random() * 0.01 - 0.005);
    const pickupLng = formData.pickupLng || 36.8219 + (Math.random() * 0.01 - 0.005);
    const dropoffLat = formData.dropoffLat || -1.2921 + (Math.random() * 0.01 - 0.005);
    const dropoffLng = formData.dropoffLng || 36.8219 + (Math.random() * 0.01 - 0.005);

    const finalDropoff = formatDropoffWithNote(
      formData.dropoff, 
      formData.deliveryNote,
      formData.requirePin ? formData.deliveryPin : null
    );

    const orderPayload = {
      order_number: `ORD-${Date.now()}`,
      customer_name: formData.customerName,
      customer_phone: formData.customerPhone,
      pickup_address: formData.pickup,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_address: finalDropoff,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
      fee: parseFloat(formData.fee),
      status: 'pending'
    };

    if (formData.requirePin && formData.deliveryPin) {
      orderPayload.delivery_pin = formData.deliveryPin;
    }

    let { data, error } = await supabase.from('orders').insert([orderPayload]).select();
    if (error && orderPayload.delivery_pin) {
      delete orderPayload.delivery_pin;
      const retry = await supabase.from('orders').insert([orderPayload]).select();
      data = retry.data;
      error = retry.error;
    }

    if (!error) {
      const createdOrder = data?.[0];
      setFormData({ 
        customerName: '', customerPhone: '', 
        pickup: '', pickupLat: null, pickupLng: null,
        dropoff: '', dropoffLat: null, dropoffLng: null, 
        fee: '',
        deliveryNote: '',
        requirePin: false,
        deliveryPin: ''
      });
      setShowSingleNote(false);

      // Automatically open the STK Push prompt for the newly created order
      if (createdOrder) {
        openStkModal(createdOrder);
      } else {
        alert("Order dispatched to riders!");
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
    setShowBatchNote(false);
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
      const dropoffAddress = formatDropoffWithNote(item.dropoff, item.description, item.deliveryPin || null);

      const orderObj = {
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

      if (item.deliveryPin) {
        orderObj.delivery_pin = item.deliveryPin;
      }

      return orderObj;
    });

    let { error } = await supabase.from('orders').insert(ordersToInsert);
    if (error && ordersToInsert.some(o => o.delivery_pin)) {
      const fallbackOrders = ordersToInsert.map(o => {
        const copy = { ...o };
        delete copy.delivery_pin;
        return copy;
      });
      const retry = await supabase.from('orders').insert(fallbackOrders);
      error = retry.error;
    }

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
      phone: order.customer_phone || '',
      checkoutRequestId: order.mpesa_checkout_id || null
    });
    setStkStatus(null);
    setStkMessage('');
  };

  // ── Open STK Modal from Dispatch Form (Creates Order First) ──────────────
  const openDispatchFormStkModal = async () => {
    if (!formData.customerName || !formData.customerPhone || !formData.fee) {
      alert("Please enter Customer Name, Phone, and Fee in the dispatch form first.");
      return;
    }

    // 1. Create order in the database first so the payment is linked to a real order!
    const pickupLat = formData.pickupLat || -1.2921 + (Math.random() * 0.01 - 0.005);
    const pickupLng = formData.pickupLng || 36.8219 + (Math.random() * 0.01 - 0.005);
    const dropoffLat = formData.dropoffLat || -1.2921 + (Math.random() * 0.01 - 0.005);
    const dropoffLng = formData.dropoffLng || 36.8219 + (Math.random() * 0.01 - 0.005);

    const finalDropoff = formatDropoffWithNote(formData.dropoff || 'Delivery', formData.deliveryNote);

    const { data, error } = await supabase.from('orders').insert([{
      order_number: `ORD-${Date.now()}`,
      customer_name: formData.customerName,
      customer_phone: formData.customerPhone,
      pickup_address: formData.pickup || 'Pickup',
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_address: finalDropoff,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
      fee: parseFloat(formData.fee),
      status: 'pending'
    }]).select();

    if (error || !data || data.length === 0) {
      alert("Error creating order: " + (error?.message || 'Unknown error'));
      return;
    }

    const createdOrder = data[0];

    // Clear form
    setFormData({ 
      customerName: '', customerPhone: '', 
      pickup: '', pickupLat: null, pickupLng: null,
      dropoff: '', dropoffLat: null, dropoffLng: null, 
      fee: '',
      deliveryNote: ''
    });
    setShowSingleNote(false);

    // 2. Open modal with real order details!
    setStkModalData({
      isOpen: true,
      orderId: createdOrder.id,
      orderNumber: createdOrder.order_number,
      customerName: createdOrder.customer_name,
      amount: createdOrder.fee,
      phone: createdOrder.customer_phone,
      checkoutRequestId: null
    });
    setStkStatus(null);
    setStkMessage('');
  };

  // ── Send M-Pesa STK Push ──────────────────────────────────────────────────
  const handleSendStkPush = async (e) => {
    if (e) e.preventDefault();
    if (!stkModalData.phone || !stkModalData.amount) {
      setStkStatus('error');
      setStkMessage('Phone number and amount are required.');
      return;
    }

    setStkStatus('sending');
    setStkMessage('Connecting to Safaricom Daraja...');

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

      // Extract checkoutRequestId from backend response (either top-level or data.data)
      const checkoutId = data?.checkoutRequestId || data?.data?.CheckoutRequestID;

      if (checkoutId) {
        setStkModalData(prev => ({ ...prev, checkoutRequestId: checkoutId }));
        if (stkModalData.orderId) {
          await supabase
            .from('orders')
            .update({ mpesa_checkout_id: checkoutId })
            .eq('id', stkModalData.orderId);
        }
      }

      // Transition to active awaiting PIN state (DO NOT CLOSE MODAL)
      setStkStatus('awaiting_pin');
      setStkMessage(`STK prompt sent to ${stkModalData.phone}. Customer is entering PIN...`);

    } catch (err) {
      console.error('STK Push Error:', err);
      setStkStatus('error');
      setStkMessage(err.message || 'M-Pesa STK push request failed.');
    }
  };

  // ── Manual Payment Confirmation ───────────────────────────────────────────
  const handleManualPaymentConfirm = async (orderId) => {
    let targetId = orderId;

    if (!targetId && stkModalData.phone) {
      const cleanPhone = stkModalData.phone.replace(/[^0-9]/g, '');
      const altPhone = cleanPhone.startsWith('0') ? '254' + cleanPhone.slice(1) : ('0' + cleanPhone.slice(3));
      const { data } = await supabase
        .from('orders')
        .select('id')
        .or(`customer_phone.eq.${cleanPhone},customer_phone.eq.${altPhone}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      targetId = data?.id;
    }

    if (!targetId) {
      alert("No order found to update. Please select or dispatch an order first.");
      return;
    }

    const receipt = window.prompt("Enter M-Pesa Receipt Code (from customer's SMS, e.g. NLX8932J1):", "M-PESA");
    if (receipt === null) return;

    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'paid', 
        mpesa_receipt: receipt.trim() || 'M-PESA' 
      })
      .eq('id', targetId);

    if (!error) {
      setStkStatus('paid');
      setStkPaidDetails({
        receipt: receipt.trim() || 'M-PESA',
        amount: stkModalData.amount
      });
      setOrders(prev => prev.map(o => o.id === targetId ? { ...o, status: 'paid', mpesa_receipt: receipt.trim() || 'M-PESA' } : o));
    } else {
      alert("Error marking order as paid: " + error.message);
    }
  };

  // ── Check Payment Status On Demand ────────────────────────────────────────
  const handleManualCheck = async () => {
    let orderData = null;

    if (stkModalData.orderId) {
      const { data } = await supabase
        .from('orders')
        .select('id, status, mpesa_receipt, fee, mpesa_checkout_id')
        .eq('id', stkModalData.orderId)
        .maybeSingle();
      orderData = data;
    }

    // Fallback: check most recent order matching the phone number
    if (!orderData && stkModalData.phone) {
      const cleanPhone = stkModalData.phone.replace(/[^0-9]/g, '');
      const altPhone = cleanPhone.startsWith('0') ? '254' + cleanPhone.slice(1) : ('0' + cleanPhone.slice(3));
      const { data } = await supabase
        .from('orders')
        .select('id, status, mpesa_receipt, fee, mpesa_checkout_id')
        .or(`customer_phone.eq.${cleanPhone},customer_phone.eq.${altPhone}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      orderData = data;
    }

    // 1. Direct DB check
    if (orderData && (orderData.status === 'paid' || orderData.mpesa_receipt)) {
      setStkStatus('paid');
      setStkPaidDetails({
        receipt: orderData.mpesa_receipt || 'Confirmed',
        amount: orderData.fee
      });
      setOrders(prev => prev.map(o => o.id === orderData.id ? { ...o, status: 'paid', mpesa_receipt: orderData.mpesa_receipt } : o));
      return;
    }

    // 2. Active Daraja STK Query check
    const activeCheckoutId = stkModalData.checkoutRequestId || orderData?.mpesa_checkout_id;
    if (activeCheckoutId) {
      try {
        const { data: queryRes, error: qErr } = await supabase.functions.invoke('mpesa-stk', {
          body: {
            action: 'query',
            checkoutRequestId: activeCheckoutId,
            orderId: stkModalData.orderId || orderData?.id,
            phone: stkModalData.phone
          }
        });

        if (!qErr && queryRes?.paid) {
          const receipt = queryRes.receipt || 'Confirmed';
          const targetId = stkModalData.orderId || orderData?.id;
          setStkStatus('paid');
          setStkPaidDetails({
            receipt: receipt,
            amount: stkModalData.amount || orderData?.fee
          });
          if (targetId) {
            setOrders(prev => prev.map(o => o.id === targetId ? { ...o, status: 'paid', mpesa_receipt: receipt } : o));
          }
          return;
        }

        if (queryRes?.cancelled) {
          alert("Customer cancelled the M-Pesa prompt on their phone.");
          return;
        }
      } catch (err) {
        console.warn('Manual STK query error:', err);
      }
    }

    alert("Payment has not been confirmed yet. Please wait for customer to enter PIN, or click 'Customer Paid Cash / Manual Confirm' if already paid.");
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

  const paidOrdersList = orders.filter(o => o.status === 'paid' || o.mpesa_receipt);

  // ── Manage Roles Tab (Superadmin Only) ──────────────────────────────────
  if (activeTab === 'roles' && userRole === 'superadmin') {
    const ridersList = Object.values(riders);
    return (
      <div className="finance-dashboard">
        {/* Superadmin Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          color: '#fff',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 700,
          fontSize: '0.9rem',
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
        }}>
          ⚡ Super Administrator Mode — Role Management
        </div>

        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Manage User Roles</h1>
          <button className="btn btn-primary" onClick={() => setActiveTab('dashboard')}>
            <MapIcon size={16} /> Back to Live Map
          </button>
        </div>

        <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Assign or revoke roles for all team members. Only you (Super Admin) can change who is the CEO.
        </p>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {ridersList.map(rider => {
            const isCurrentUser = rider.role === 'superadmin';
            return (
              <div key={rider.id} className="card" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '1.25rem 1.5rem',
                border: rider.role === 'ceo' ? '2px solid #3B82F6' : rider.role === 'superadmin' ? '2px solid #F59E0B' : '1px solid var(--border-color)',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '200px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: rider.role === 'superadmin' ? '#FEF3C7' : rider.role === 'ceo' ? '#DBEAFE' : '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    color: rider.role === 'superadmin' ? '#D97706' : rider.role === 'ceo' ? '#2563EB' : '#64748B'
                  }}>
                    {rider.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '1rem' }}>
                      {rider.name || 'Unnamed'}
                      {isCurrentUser && (
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.65rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '10px',
                          background: '#FEF3C7',
                          color: '#D97706',
                          fontWeight: 600
                        }}>YOU</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                      Code: {rider.rider_code} • Status: <span style={{ textTransform: 'capitalize' }}>{rider.status || 'offline'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* Current role badge */}
                  <span style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '16px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: rider.role === 'superadmin' ? 'linear-gradient(135deg, #F59E0B, #D97706)' : rider.role === 'ceo' ? '#2563EB' : '#64748B',
                    color: '#fff',
                  }}>
                    {rider.role === 'superadmin' ? '⚡ Super Admin' : rider.role === 'ceo' ? '👔 CEO' : '🏍️ Rider'}
                  </span>

                  {/* Role change dropdown — disabled for superadmin's own row */}
                  {!isCurrentUser && (
                    <select
                      value={rider.role}
                      onChange={async (e) => {
                        const newRole = e.target.value;
                        const confirmed = window.confirm(
                          `Change ${rider.name}'s role from "${rider.role}" to "${newRole}"?`
                        );
                        if (!confirmed) return;

                        const { error } = await supabase
                          .from('riders')
                          .update({ role: newRole })
                          .eq('id', rider.id);

                        if (error) {
                          alert(`Error updating role: ${error.message}`);
                        } else {
                          setRiders(prev => ({
                            ...prev,
                            [rider.id]: { ...prev[rider.id], role: newRole }
                          }));
                        }
                      }}
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: '#F8FAFC'
                      }}
                    >
                      <option value="rider">Rider</option>
                      <option value="ceo">CEO</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}

          {ridersList.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: '#64748B', padding: '2rem' }}>
              No team members found.
            </div>
          )}
        </div>
      </div>
    );
  }

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
      {/* Super Admin Mode Banner */}
      {userRole === 'superadmin' && (
        <div style={{
          gridColumn: '1 / -1',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          color: '#fff',
          padding: '0.6rem 1.25rem',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 700,
          fontSize: '0.85rem',
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
          marginBottom: '0.5rem'
        }}>
          ⚡ Super Administrator Mode — Full System Access
        </div>
      )}

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

      {/* STK Push Confirmation & Live Status Modal */}
      {stkModalData.isOpen && (
        <div className="modal-backdrop" onClick={() => {
          if (stkStatus !== 'sending') {
            setStkModalData(prev => ({ ...prev, isOpen: false }));
          }
        }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {stkStatus === 'paid' ? (
                  <><CheckCircle size={20} color="#10B981" /> Payment Confirmed</>
                ) : stkStatus === 'awaiting_pin' ? (
                  <><Smartphone size={20} color="#3B82F6" /> Waiting for M-Pesa PIN</>
                ) : (
                  <><Smartphone size={20} color="#10B981" /> Send M-Pesa STK Push</>
                )}
              </h3>
              <button 
                type="button" 
                onClick={() => setStkModalData(prev => ({ ...prev, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* SCREEN 1: Awaiting PIN State */}
            {stkStatus === 'awaiting_pin' ? (
              <div className="modal-body" style={{ textAlign: 'center', padding: '1.75rem 1.5rem' }}>
                <div style={{ width: '68px', height: '68px', borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
                  <Loader2 size={36} color="#2563EB" className="animate-spin" />
                </div>
                
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.4rem' }}>
                  STK Prompt Sent!
                </h4>
                
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  A prompt for <strong>KES {stkModalData.amount}</strong> was sent to <strong>{stkModalData.phone}</strong>.<br/>
                  Waiting for customer to enter their PIN on their phone.
                </p>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F1F5F9', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.78rem', color: '#64748B', fontWeight: 700, marginBottom: '1.5rem' }}>
                  <Clock size={13} /> Waiting: {stkCountdown}s
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleManualCheck}
                    style={{ width: '100%' }}
                  >
                    <RefreshCw size={14} /> Check Status Now
                  </button>
                  
                  {stkModalData.orderId && (
                    <button 
                      type="button" 
                      className="btn btn-outline-dark"
                      onClick={() => handleManualPaymentConfirm(stkModalData.orderId)}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    >
                      Customer Paid Cash / Manual Confirm
                    </button>
                  )}

                  <button 
                    type="button" 
                    onClick={() => setStkStatus(null)}
                    style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.8rem', cursor: 'pointer', marginTop: '0.25rem' }}
                  >
                    Change Phone Number / Resend
                  </button>
                </div>
              </div>
            ) : stkStatus === 'paid' ? (
              /* SCREEN 2: Payment Received Success Screen */
              <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
                  <CheckCircle size={40} color="#15803D" />
                </div>
                
                <h4 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#15803D', marginBottom: '0.3rem' }}>
                  Payment Received!
                </h4>
                
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.5rem' }}>
                  KES {stkPaidDetails.amount}
                </div>

                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.65rem 1rem', borderRadius: '8px', display: 'inline-block', marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>M-Pesa Receipt</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1E40AF', fontSize: '1rem' }}>{stkPaidDetails.receipt}</span>
                </div>

                <button 
                  type="button" 
                  className="btn btn-success"
                  onClick={() => setStkModalData(prev => ({ ...prev, isOpen: false }))}
                  style={{ width: '100%', padding: '0.75rem' }}
                >
                  Done
                </button>
              </div>
            ) : stkStatus === 'timeout' ? (
              /* SCREEN 3: Timeout Screen */
              <div className="modal-body" style={{ textAlign: 'center', padding: '1.75rem 1.5rem' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                  <AlertCircle size={32} color="#D97706" />
                </div>
                
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>
                  Payment Timed Out
                </h4>
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Customer did not enter their PIN within 60 seconds or cancelled the prompt.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleSendStkPush}
                    style={{ flex: 1 }}
                  >
                    Retry STK Push
                  </button>
                  {stkModalData.orderId && (
                    <button 
                      type="button" 
                      className="btn btn-outline-dark"
                      onClick={() => handleManualPaymentConfirm(stkModalData.orderId)}
                      style={{ flex: 1 }}
                    >
                      Cash / Manual
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* SCREEN 4: Initial Trigger Form */
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
                      Edit this number if the customer is paying with another M-Pesa line.
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
                    disabled={stkStatus === 'sending'}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-success" 
                    disabled={stkStatus === 'sending'}
                  >
                    {stkStatus === 'sending' ? (
                      <><Loader2 size={15} className="animate-spin" /> Sending...</>
                    ) : (
                      <><Smartphone size={15} /> Send STK Prompt</>
                    )}
                  </button>
                </div>
              </form>
            )}
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

              {/* Personal / Delivery Note (Optional) */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ margin: 0, fontSize: '0.82rem' }}>
                    Personal Note / Instructions <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.72rem' }}>(Optional)</span>
                  </label>
                  {!showSingleNote && !formData.deliveryNote && (
                    <button 
                      type="button" 
                      onClick={() => setShowSingleNote(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--secondary-color)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Plus size={12} /> Add Note
                    </button>
                  )}
                </div>
                
                {showSingleNote || formData.deliveryNote ? (
                  <div className="note-input-container">
                    <input 
                      type="text" 
                      className="form-control" 
                      name="deliveryNote" 
                      value={formData.deliveryNote} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Gate code #402, fragile item, call recipient..."
                      style={{ paddingRight: '2rem', fontSize: '0.84rem' }}
                      autoFocus
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        setFormData(prev => ({ ...prev, deliveryNote: '' }));
                        setShowSingleNote(false);
                      }}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                      title="Clear & close note"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div 
                    className="note-toggle-box"
                    onClick={() => setShowSingleNote(true)}
                    title="Click to write delivery note or personal instructions"
                  >
                    <FileText size={13} color="#64748B" />
                    <span>+ Add delivery note or personal instructions (Optional)</span>
                  </div>
                )}
              </div>

              {/* Optional 4-Digit Security PIN */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.65rem 0.85rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    <input 
                      type="checkbox"
                      checked={formData.requirePin || false}
                      onChange={e => {
                        const checked = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          requirePin: checked,
                          deliveryPin: checked ? (prev.deliveryPin || Math.floor(1000 + Math.random() * 9000).toString()) : ''
                        }));
                      }}
                      style={{ accentColor: '#7C3AED', width: '15px', height: '15px' }}
                    />
                    <KeyRound size={14} color="#7C3AED" />
                    <span>Require 4-Digit Delivery PIN</span>
                  </label>

                  {formData.requirePin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.95rem', color: '#6D28D9', background: '#EDE9FE', padding: '2px 8px', borderRadius: '6px' }}>
                        {formData.deliveryPin}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, deliveryPin: Math.floor(1000 + Math.random() * 9000).toString() }))}
                        style={{ background: 'none', border: 'none', color: '#6D28D9', cursor: 'pointer', padding: '2px' }}
                        title="Generate new PIN"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  )}
                </div>
                {formData.requirePin && (
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px', paddingLeft: '23px' }}>
                    Customer must provide this 4-digit PIN to the driver upon delivery.
                  </div>
                )}
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
                    <div key={item.id} className="batch-item-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            title="Remove delivery"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {item.description && (
                        <div style={{ fontSize: '0.74rem', color: '#1E40AF', backgroundColor: '#EFF6FF', padding: '0.15rem 0.45rem', borderRadius: '4px', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                          <FileText size={11} color="#3B82F6" /> Note: {item.description}
                        </div>
                      )}
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

                {/* Optional Note for Batch Item */}
                <div className="form-group" style={{ marginTop: '0.35rem', marginBottom: '0.75rem' }}>
                  {showBatchNote || newBatchItem.description ? (
                    <div className="note-input-container">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <label style={{ margin: 0, fontSize: '0.78rem' }}>Order Note / Instructions (Optional)</label>
                      </div>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="e.g. Leave at reception, call recipient before arrival..."
                        value={newBatchItem.description}
                        onChange={(e) => setNewBatchItem({ ...newBatchItem, description: e.target.value })}
                        style={{ paddingRight: '2rem', fontSize: '0.82rem' }}
                        autoFocus
                      />
                      <button 
                        type="button" 
                        onClick={() => {
                          setNewBatchItem(prev => ({ ...prev, description: '' }));
                          setShowBatchNote(false);
                        }}
                        style={{ position: 'absolute', right: '8px', top: '65%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                        title="Remove note"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      className="note-toggle-box"
                      onClick={() => setShowBatchNote(true)}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
                      title="Click to write special instructions for this delivery"
                    >
                      <FileText size={12} color="#64748B" />
                      <span>+ Add note / instructions for this recipient (Optional)</span>
                    </div>
                  )}
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
            const parsedDropoff = parseAddressAndNote(order.dropoff_address);
            const orderPin = order.delivery_pin || parsedDropoff.pin;
            
            return (
              <div key={order.id} className="order-card-item" style={{ borderLeftColor: isPaid ? '#10B981' : order.status === 'arrived' ? '#0284C7' : 'var(--secondary-color)' }}>
                <div className="flex justify-between items-center mb-1">
                  <strong style={{ fontSize: '0.92rem' }}>{order.customer_name}</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {orderPin && (
                      <span 
                        className="badge-pin" 
                        onClick={() => copyToClipboard(orderPin, order.id + '-pin')}
                        style={{ cursor: 'pointer' }}
                        title="Click to copy delivery PIN"
                      >
                        <KeyRound size={11} /> PIN: {orderPin}
                        {copiedOrderId === order.id + '-pin' && <Check size={11} color="#059669" />}
                      </span>
                    )}
                    {isPaid ? (
                      <span className="badge-paid">
                        <CheckCircle size={11} /> PAID
                      </span>
                    ) : (
                      <span className="badge-unpaid">
                        <Clock size={11} /> UNPAID
                      </span>
                    )}
                    {order.status === 'arrived' ? (
                      <span className="badge-arrived">
                        <MapPin size={11} /> ARRIVED
                      </span>
                    ) : (
                      <span className={`status-badge status-${order.status === 'paid' ? 'online' : 'busy'}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                        {order.status}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', margin: '4px 0' }}>
                  <span>{order.pickup_address}</span>
                  <ArrowRight size={12} />
                  <span>{parsedDropoff.address}</span>
                </div>

                {parsedDropoff.note && (
                  <div className="note-pill">
                    <FileText size={11} color="#3B82F6" />
                    <span>Note: {parsedDropoff.note}</span>
                  </div>
                )}

                {order.received_by && (
                  <div style={{ fontSize: '0.74rem', color: '#0369A1', background: '#F0F9FF', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', margin: '2px 0 4px' }}>
                    <CheckCircle size={11} /> Handed to: {order.received_by}
                  </div>
                )}

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
                    
                    {/* Trigger STK Push modal or show Paid state */}
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
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="floating-finance-btn" style={{ position: 'relative', top: 'auto', right: 'auto' }} onClick={() => setActiveTab('finance')}>
            <LayoutDashboard size={16} /> Finance Dashboard
          </button>
          {userRole === 'superadmin' && (
            <button className="floating-finance-btn" style={{ position: 'relative', top: 'auto', right: 'auto', background: 'linear-gradient(135deg, #F59E0B, #D97706)' }} onClick={() => setActiveTab('roles')}>
              <Users size={16} /> Manage Roles
            </button>
          )}
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
