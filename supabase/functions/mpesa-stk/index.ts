import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DARAJA_CONSUMER_KEY = Deno.env.get('DARAJA_CONSUMER_KEY') || 'Nek2HeU12EG0hXAFzeq9cLHTtml40QSVWioG5j4mAhLwiJKG';
const DARAJA_CONSUMER_SECRET = Deno.env.get('DARAJA_CONSUMER_SECRET') || 'bX1DcqufoAGM1EGGlSRJayPTMHsFo0peSv7ZRfK8yCqmk9R1VJiR9Iu0GqOwSOEe';
const DARAJA_SHORTCODE = Deno.env.get('DARAJA_SHORTCODE') || '174379';
const DARAJA_PASSKEY = Deno.env.get('DARAJA_PASSKEY') || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

// This is the URL for our second edge function that Safaricom will call back
const CALLBACK_URL = 'https://vwuecbinjmhljyuysvnc.supabase.co/functions/v1/mpesa-callback';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken() {
  const credentials = btoa(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`);
  const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${credentials}`
    }
  });
  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, amount } = await req.json();

    // 1. Format Phone Number to 254...
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('+254')) {
      formattedPhone = formattedPhone.slice(1);
    }

    // 2. Generate Timestamp and Password
    const date = new Date();
    const timestamp = date.getFullYear().toString() + 
                      (date.getMonth() + 1).toString().padStart(2, '0') + 
                      date.getDate().toString().padStart(2, '0') + 
                      date.getHours().toString().padStart(2, '0') + 
                      date.getMinutes().toString().padStart(2, '0') + 
                      date.getSeconds().toString().padStart(2, '0');
    
    const password = btoa(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`);

    // 3. Get Access Token
    const accessToken = await getAccessToken();

    // 4. Make STK Push Request
    const stkPayload = {
      BusinessShortCode: DARAJA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(Number(amount)), // Daraja requires integers
      PartyA: formattedPhone,
      PartyB: DARAJA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: CALLBACK_URL,
      AccountReference: "Sudeis Delivery",
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

    return new Response(JSON.stringify({ success: true, data: stkData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
