import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Printer, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  ShieldCheck,
  MessageCircle
} from 'lucide-react';
import { supabase } from '../supabase';
import './CustomerReceipt.css';

export default function CustomerReceipt({ orderNumber: initialOrderNumber, onBack }) {
  const [activeOrderNumber, setActiveOrderNumber] = useState(initialOrderNumber || '');
  const [searchInput, setSearchInput] = useState(initialOrderNumber || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync if prop changes
  useEffect(() => {
    if (initialOrderNumber && initialOrderNumber !== activeOrderNumber) {
      setActiveOrderNumber(initialOrderNumber);
      setSearchInput(initialOrderNumber);
    }
  }, [initialOrderNumber]);

  useEffect(() => {
    const rawRef = (activeOrderNumber || '').trim();
    if (!rawRef || rawRef === 'undefined' || rawRef === 'null') {
      setError("No order reference provided.");
      setLoading(false);
      return;
    }

    const fetchReceipt = async () => {
      setLoading(true);
      setError(null);

      try {
        const cleanRef = decodeURIComponent(rawRef).trim();

        // 1. Try secure public RPC function first (if migration executed)
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_receipt', {
            p_order_number: cleanRef
          });

          if (!rpcError && rpcData && rpcData.length > 0) {
            setOrder(rpcData[0]);
            setLoading(false);
            return;
          }
        } catch (rpcErr) {
          console.warn("RPC receipt lookup skipped/unavailable:", rpcErr);
        }

        // 2. Direct lookup: Case-insensitive match on order_number (covers ORD-... and ord-...)
        let { data: orderData } = await supabase
          .from('orders')
          .select('id, order_number, customer_name, customer_phone, pickup_address, dropoff_address, fee, status, mpesa_receipt, created_at, updated_at, assigned_rider_id')
          .ilike('order_number', cleanRef)
          .maybeSingle();

        // 3. Fallback: If not found, try by order ID (UUID or numeric ID)
        if (!orderData) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRef);
          if (isUuid || !isNaN(cleanRef)) {
            const { data: idData } = await supabase
              .from('orders')
              .select('id, order_number, customer_name, customer_phone, pickup_address, dropoff_address, fee, status, mpesa_receipt, created_at, updated_at, assigned_rider_id')
              .eq('id', cleanRef)
              .maybeSingle();
            if (idData) orderData = idData;
          }
        }

        // 4. Fallback: Try by M-Pesa receipt code
        if (!orderData) {
          const { data: mpesaData } = await supabase
            .from('orders')
            .select('id, order_number, customer_name, customer_phone, pickup_address, dropoff_address, fee, status, mpesa_receipt, created_at, updated_at, assigned_rider_id')
            .ilike('mpesa_receipt', cleanRef)
            .maybeSingle();
          if (mpesaData) orderData = mpesaData;
        }

        if (!orderData) {
          throw new Error(`Order "${cleanRef}" not found or invalid receipt number.`);
        }

        // 5. Lookup rider display name if assigned
        let riderName = 'Falcon Courier Rider';
        if (orderData.assigned_rider_id) {
          try {
            const { data: riderData } = await supabase
              .from('riders')
              .select('name')
              .eq('id', orderData.assigned_rider_id)
              .maybeSingle();
            if (riderData?.name) riderName = riderData.name;
          } catch (rErr) {
            console.warn("Could not fetch rider name for receipt:", rErr);
          }
        }

        setOrder({
          ...orderData,
          rider_name: riderName
        });
      } catch (err) {
        console.error("Receipt fetch error:", err);
        setError(err.message || "Failed to load receipt details.");
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [activeOrderNumber]);

  const handleManualSearch = (e) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;
    setActiveOrderNumber(query);
    // Also update browser URL gracefully
    if (typeof window !== 'undefined' && window.history?.pushState) {
      window.history.pushState({}, '', `/receipt/${encodeURIComponent(query)}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!order) return;
    const currentUrl = window.location.href;
    const isPaid = order.status === 'paid' || !!order.mpesa_receipt;
    const mpesaRef = order.mpesa_receipt ? `\n💳 *M-Pesa Code:* ${order.mpesa_receipt}` : '';
    
    const message = `*FALCON DELIVERY - OFFICIAL RECEIPT* 🧾\n` +
      `───────────────────────\n` +
      `📦 *Order No:* ${order.order_number || order.id}\n` +
      `👤 *Customer:* ${order.customer_name || 'Walk-in'}\n` +
      `📍 *From:* ${order.pickup_address}\n` +
      `🏁 *To:* ${order.dropoff_address}\n` +
      `💰 *Amount:* KES ${Number(order.fee || 0).toLocaleString()}\n` +
      `✅ *Status:* ${isPaid ? 'PAID' : order.status ? order.status.toUpperCase() : 'COMPLETED'}${mpesaRef}\n` +
      `🕒 *Date:* ${new Date(order.created_at || Date.now()).toLocaleDateString()}\n` +
      `───────────────────────\n` +
      `📄 *View / Download Official PDF Receipt:*\n` +
      `👉 ${currentUrl}\n\n` +
      `Thank you for choosing Falcon Delivery! 🚀\n` +
      `Customer Support: +254 700 000 000`;

    const cleanPhone = order.customer_phone ? String(order.customer_phone).replace(/[^0-9]/g, '') : '';
    let targetPhone = cleanPhone;
    if (targetPhone.startsWith('0')) targetPhone = '254' + targetPhone.slice(1);

    const waUrl = targetPhone
      ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="receipt-page-container">
        <div className="receipt-state-box">
          <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-4" style={{ animation: 'spin 1s linear infinite' }} />
          <h3 className="text-lg font-bold text-gray-800 mb-1">Generating Official Receipt</h3>
          <p className="text-sm text-gray-500">Retrieving delivery verification details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="receipt-page-container">
        <div className="receipt-state-box">
          <AlertCircle size={48} className="text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800 mb-2">Receipt Unavailable</h3>
          <p className="text-sm text-gray-500 mb-4">{error || "Could not find an order matching this reference."}</p>
          
          <form onSubmit={handleManualSearch} className="receipt-search-form">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter Order # or M-Pesa Code"
              className="receipt-search-input"
            />
            <button type="submit" className="receipt-search-btn">
              Find Receipt
            </button>
          </form>

          {onBack && (
            <button onClick={onBack} className="receipt-back-btn" style={{ marginTop: '0.5rem' }}>
              <ArrowLeft size={16} /> Return to Home
            </button>
          )}
        </div>
      </div>
    );
  }

  const isPaid = order.status === 'paid' || !!order.mpesa_receipt;
  const isDelivered = order.status === 'delivered';
  const formattedDate = new Date(order.created_at || Date.now()).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="receipt-page-container">
      {/* ── Top Bar Controls (Hidden when printed to PDF) ───────────────── */}
      <div className="receipt-top-bar no-print">
        {onBack ? (
          <button onClick={onBack} className="receipt-back-btn">
            <ArrowLeft size={16} /> Falcon Delivery
          </button>
        ) : (
          <a href="/" className="receipt-back-btn">
            <ArrowLeft size={16} /> Falcon Delivery
          </a>
        )}

        <div className="receipt-action-group">
          <button onClick={handleWhatsAppShare} className="receipt-btn receipt-btn-whatsapp" title="Share via WhatsApp">
            <MessageCircle size={16} /> Share WhatsApp
          </button>
          <button onClick={handlePrint} className="receipt-btn receipt-btn-print" title="Print or Save as PDF">
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── Official Printable Receipt Voucher ───────────────────────────── */}
      <div className="receipt-card">
        {/* Header Band */}
        <div className="receipt-header-band">
          <div className="receipt-brand-row">
            <div className="receipt-brand-info">
              <div className="receipt-logo-icon">
                <Truck size={24} />
              </div>
              <div>
                <div className="receipt-company-name">Falcon Delivery</div>
                <div className="receipt-company-tagline">Express Courier Services · Kenya</div>
              </div>
            </div>

            <div className="receipt-voucher-title">
              <span className="receipt-title-tag">Official Receipt</span>
              <div className="receipt-order-num">{order.order_number}</div>
            </div>
          </div>
        </div>

        {/* Status Strip */}
        <div className="receipt-status-banner">
          <div>
            {isPaid ? (
              <span className="receipt-status-badge status-badge-paid">
                <CheckCircle2 size={15} /> Payment Confirmed
              </span>
            ) : isDelivered ? (
              <span className="receipt-status-badge status-badge-delivered">
                <ShieldCheck size={15} /> Delivered
              </span>
            ) : (
              <span className="receipt-status-badge status-badge-pending">
                <Clock size={15} /> {order.status ? order.status.toUpperCase() : 'PENDING'}
              </span>
            )}
          </div>
          <div className="receipt-timestamp">{formattedDate}</div>
        </div>

        {/* Body Content */}
        <div className="receipt-body">
          {/* Delivery Route */}
          <div className="receipt-section-title">Delivery Route & Locations</div>
          <div className="receipt-route-box">
            <div className="route-stop">
              <div className="route-dot route-dot-pickup">
                <MapPin size={12} />
              </div>
              <div className="route-details">
                <div className="route-label">Pickup Origin</div>
                <div className="route-address">{order.pickup_address || 'Origin Desk'}</div>
              </div>
            </div>

            <div className="route-stop">
              <div className="route-dot route-dot-dropoff">
                <MapPin size={12} />
              </div>
              <div className="route-details">
                <div className="route-label">Destination Dropoff</div>
                <div className="route-address">{order.dropoff_address || 'Destination'}</div>
              </div>
            </div>
          </div>

          {/* Customer & Carrier Information */}
          <div className="receipt-info-grid">
            <div className="info-item">
              <span className="info-item-label">Customer / Sender</span>
              <span className="info-item-value">{order.customer_name || 'Walk-in Customer'}</span>
            </div>
            <div className="info-item">
              <span className="info-item-label">Contact Phone</span>
              <span className="info-item-value">{order.customer_phone || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-item-label">Courier Service</span>
              <span className="info-item-value">Point-to-Point Express</span>
            </div>
            <div className="info-item">
              <span className="info-item-label">Assigned Carrier</span>
              <span className="info-item-value">{order.rider_name || 'Verified Falcon Rider'}</span>
            </div>
          </div>

          {/* M-Pesa Transaction Verification (If Paid via M-Pesa) */}
          {order.mpesa_receipt && (
            <div className="mpesa-confirmation-box">
              <div>
                <div className="mpesa-code-label">M-Pesa Transaction Code</div>
                <div className="mpesa-code-value">{order.mpesa_receipt}</div>
              </div>
              <div className="status-badge-paid receipt-status-badge">
                <CheckCircle2 size={14} /> Verified
              </div>
            </div>
          )}

          {/* Financial Breakdown Table */}
          <div className="receipt-section-title">Charges Breakdown</div>
          <div className="receipt-financials">
            <div className="fin-row">
              <span>Standard Courier Delivery Fee</span>
              <span>KES {Number(order.fee || 0).toLocaleString()}</span>
            </div>
            <div className="fin-row">
              <span>Handling & Insurance Surcharge</span>
              <span>KES 0.00</span>
            </div>
            <div className="fin-row fin-row-total">
              <span>Total Amount</span>
              <span className="fin-amount-highlight">KES {Number(order.fee || 0).toLocaleString()}</span>
            </div>
            <div className="fin-row" style={{ fontSize: '0.8rem', color: '#64748b' }}>
              <span>Payment Method:</span>
              <span className="font-semibold text-gray-700">
                {order.mpesa_receipt ? 'M-Pesa Mobile Money (STK Push)' : isPaid ? 'Cash on Delivery / Desk' : 'Pending Settlement'}
              </span>
            </div>
          </div>
        </div>

        {/* Official Footer */}
        <div className="receipt-footer">
          <div className="receipt-footer-support">
            Falcon Delivery Express · Machakos & Nairobi Regional Hubs
          </div>
          <div>Inquiries or dispatch support? Call / WhatsApp: <strong>+254 700 000 000</strong></div>
          <div style={{ marginTop: '0.4rem', color: '#94a3b8' }}>
            This is a computer-generated digital receipt and serves as official proof of payment and delivery.
          </div>
        </div>
      </div>
    </div>
  );
}
