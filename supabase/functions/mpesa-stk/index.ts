import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ── Secrets (set via: supabase secrets set KEY=value) ─────────────────────────
const DARAJA_CONSUMER_KEY = Deno.env.get('DARAJA_CONSUMER_KEY');
const DARAJA_CONSUMER_SECRET = Deno.env.get('DARAJA_CONSUMER_SECRET');
const DARAJA_SHORTCODE = Deno.env.get('DARAJA_SHORTCODE');
const DARAJA_PASSKEY = Deno.env.get('DARAJA_PASSKEY');

if (!DARAJA_CONSUMER_KEY || !DARAJA_CONSUMER_SECRET || !DARAJA_SHORTCODE || !DARAJA_PASSKEY) {
  throw new Error(
    'Missing required Daraja secrets. Set them with:\n' +
    '  supabase secrets set DARAJA_CONSUMER_KEY=<key>\n' +
    '  supabase secrets set DARAJA_CONSUMER_SECRET=<secret>\n' +
    '  supabase secrets set DARAJA_SHORTCODE=<shortcode>\n' +
    '  supabase secrets set DARAJA_PASSKEY=<passkey>'
  );
}

// ── Supabase client (service role — needed to write back CheckoutRequestID) ────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Safaricom callback URL
const CALLBACK_URL = 'https://vwuecbinjmhljyuysvnc.supabase.co/functions/v1/mpesa-callback';

// ── CORS Headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

// ── Kenyan phone number validation ────────────────────────────────────────────
function validateKenyanPhone(phone: string): { valid: boolean; formatted: string; error?: string } {
  const cleaned = phone.trim().replace(/\s+/g, '');
  let formatted = cleaned;

  if (formatted.startsWith('0') && formatted.length === 10) {
    formatted = '254' + formatted.slice(1);
  } else if (formatted.startsWith('+254') && formatted.length === 13) {
    formatted = formatted.slice(1);
  } else if (formatted.startsWith('254') && formatted.length === 12) {
    // already in correct format
  } else {
    return {
      valid: false,
      formatted: '',
      error: 'Invalid phone number. Use format: 07XXXXXXXX, +2547XXXXXXXX, or 2547XXXXXXXX'
    };
  }

  // Must be a Safaricom number (07x or 01x maps to 2547x or 2541x)
  if (!formatted.match(/^2547\d{8}$/) && !formatted.match(/^2541\d{8}$/)) {
    return {
      valid: false,
      formatted: '',
      error: 'Phone number must be a valid Safaricom Kenyan number (07xx or 01xx)'
    };
  }

  return { valid: true, formatted };
}

async function getAccessToken(): Promise<string> {
  const credentials = btoa(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`);
  const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${credentials}` }
  });
  if (!response.ok) {
    throw new Error(`Daraja token request failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Daraja did not return an access token. Check your consumer key/secret.');
  }
  return data.access_token;
}

function getTimestamp(): string {
  const date = new Date();
  return (
    date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0') +
    date.getHours().toString().padStart(2, '0') +
    date.getMinutes().toString().padStart(2, '0') +
    date.getSeconds().toString().padStart(2, '0')
  );
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || 'push';

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: QUERY (Direct Daraja STK Push Status Query)
    // ══════════════════════════════════════════════════════════════════════════
    if (action === 'query') {
      const { checkoutRequestId, orderId, phone } = body;

      if (!checkoutRequestId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'checkoutRequestId is required to query payment status.' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      console.log(`Querying Daraja STK status for CheckoutRequestID: ${checkoutRequestId}`);

      const timestamp = getTimestamp();
      const password = btoa(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`);
      const accessToken = await getAccessToken();

      const queryPayload = {
        BusinessShortCode: DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };

      const queryRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryPayload)
      });

      const queryData = await queryRes.json();
      console.log('Daraja Query Response:', JSON.stringify(queryData));

      const resultCode = String(queryData.ResultCode ?? queryData.errorCode ?? '');

      // ResultCode === "0" -> Payment is confirmed!
      if (resultCode === '0') {
        const receipt = queryData.MpesaReceiptNumber || 
                        queryData.ReceiptNumber || 
                        `MP-${timestamp.slice(8)}-${checkoutRequestId.slice(-4).toUpperCase()}`;

        // 1. Update order if orderId provided
        let targetId = orderId;
        if (targetId) {
          await supabase
            .from('orders')
            .update({ 
              status: 'paid', 
              mpesa_receipt: receipt,
              mpesa_checkout_id: checkoutRequestId
            })
            .eq('id', targetId);
        } else {
          // Fallback match by checkout ID
          const { data: matched } = await supabase
            .from('orders')
            .update({ status: 'paid', mpesa_receipt: receipt })
            .eq('mpesa_checkout_id', checkoutRequestId)
            .select('id')
            .maybeSingle();

          if (matched) {
            targetId = matched.id;
          } else if (phone) {
            // Fallback match by phone on pending orders
            const clean = phone.replace(/[^0-9]/g, '');
            const alt = clean.startsWith('0') ? '254' + clean.slice(1) : ('0' + clean.slice(3));
            const { data: phoneMatch } = await supabase
              .from('orders')
              .update({ status: 'paid', mpesa_receipt: receipt, mpesa_checkout_id: checkoutRequestId })
              .or(`customer_phone.eq.${clean},customer_phone.eq.${alt}`)
              .neq('status', 'paid')
              .order('created_at', { ascending: false })
              .limit(1)
              .select('id')
              .maybeSingle();
            if (phoneMatch) targetId = phoneMatch.id;
          }
        }

        return new Response(JSON.stringify({
          success: true,
          paid: true,
          status: 'paid',
          receipt: receipt,
          orderId: targetId,
          resultDesc: queryData.ResultDesc || 'Payment confirmed successfully!',
          data: queryData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // ResultCode === "1032" -> User cancelled
      if (resultCode === '1032') {
        return new Response(JSON.stringify({
          success: true,
          paid: false,
          cancelled: true,
          resultCode: '1032',
          message: queryData.ResultDesc || 'Request cancelled by user',
          data: queryData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // ResultCode === "1037" -> DS Timeout (user did not enter PIN)
      if (resultCode === '1037') {
        return new Response(JSON.stringify({
          success: true,
          paid: false,
          timeout: true,
          resultCode: '1037',
          message: queryData.ResultDesc || 'Customer failed to enter PIN within timeout',
          data: queryData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Still in progress / processing
      return new Response(JSON.stringify({
        success: true,
        paid: false,
        pending: true,
        resultCode: resultCode,
        message: queryData.ResultDesc || queryData.errorMessage || 'Transaction is still processing',
        data: queryData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTION: PUSH (Default STK Push Request)
    // ══════════════════════════════════════════════════════════════════════════
    const { phone, amount, orderId } = body;

    // ── Input Validation ───────────────────────────────────────────────────────
    if (!phone || typeof phone !== 'string' || phone.trim() === '') {
      return new Response(JSON.stringify({ success: false, error: 'Phone number is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 150000) {
      return new Response(JSON.stringify({ success: false, error: 'Amount must be a positive number and not exceed KES 150,000.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const phoneValidation = validateKenyanPhone(phone);
    if (!phoneValidation.valid) {
      return new Response(JSON.stringify({ success: false, error: phoneValidation.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const formattedPhone = phoneValidation.formatted;

    // ── Generate Timestamp and Password ───────────────────────────────────────
    const timestamp = getTimestamp();
    const password = btoa(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`);
    const accessToken = await getAccessToken();

    // ── Make STK Push Request ──────────────────────────────────────────────────
    const stkPayload = {
      BusinessShortCode: DARAJA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(parsedAmount),
      PartyA: formattedPhone,
      PartyB: DARAJA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: CALLBACK_URL,
      AccountReference: "Falcon Delivery",
      TransactionDesc: "Delivery Fee Payment"
    };

    const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPayload)
    });

    const stkData = await stkResponse.json();

    // ── Save CheckoutRequestID to order immediately ────────────────────────────
    if (stkData.CheckoutRequestID) {
      if (orderId) {
        await supabase
          .from('orders')
          .update({ mpesa_checkout_id: stkData.CheckoutRequestID })
          .eq('id', orderId);
      } else {
        // Fallback: save on most recent pending order for this customer phone
        const clean = phone.replace(/[^0-9]/g, '');
        const alt = clean.startsWith('0') ? '254' + clean.slice(1) : ('0' + clean.slice(3));
        await supabase
          .from('orders')
          .update({ mpesa_checkout_id: stkData.CheckoutRequestID })
          .or(`customer_phone.eq.${clean},customer_phone.eq.${alt}`)
          .neq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: stkData,
      checkoutRequestId: stkData.CheckoutRequestID,
      orderId: orderId || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('mpesa-stk error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
