import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ── Secrets (set via: supabase secrets set KEY=value) ─────────────────────────
// NEVER use hardcoded fallback values here. If a secret is missing, the function
// will throw immediately with a clear error rather than silently using wrong creds.
const DARAJA_CONSUMER_KEY = Deno.env.get('DARAJA_CONSUMER_KEY');
const DARAJA_CONSUMER_SECRET = Deno.env.get('DARAJA_CONSUMER_SECRET');
const DARAJA_SHORTCODE = Deno.env.get('DARAJA_SHORTCODE');
const DARAJA_PASSKEY = Deno.env.get('DARAJA_PASSKEY');

// Required secrets check — fail fast if any are missing
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

// ── CORS ──────────────────────────────────────────────────────────────────────
// Restricted to production domain. Set ALLOWED_ORIGIN env var to override for
// local dev: supabase secrets set ALLOWED_ORIGIN=http://localhost:5173
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://falcondelivery.co.ke';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
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
    const date = new Date();
    const timestamp = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0') +
      date.getHours().toString().padStart(2, '0') +
      date.getMinutes().toString().padStart(2, '0') +
      date.getSeconds().toString().padStart(2, '0');

    const password = btoa(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`);
    const accessToken = await getAccessToken();

    // ── Make STK Push Request ──────────────────────────────────────────────────
    const stkPayload = {
      BusinessShortCode: DARAJA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(parsedAmount), // Daraja requires integers
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

    // ── Save CheckoutRequestID to the order for callback reconciliation ────────
    // This allows mpesa-callback to reliably match the payment confirmation to
    // the correct order, eliminating the race condition of "most recent pending".
    if (stkData.CheckoutRequestID && orderId) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ mpesa_checkout_id: stkData.CheckoutRequestID })
        .eq('id', orderId);

      if (updateError) {
        // Non-fatal: STK push was already sent. Log and continue.
        console.error('Failed to save CheckoutRequestID to order:', updateError.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: stkData,
      checkoutRequestId: stkData.CheckoutRequestID
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
