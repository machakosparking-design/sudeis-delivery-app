import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("M-Pesa Callback Received:", JSON.stringify(payload));

    const body = payload.Body.stkCallback;
    const resultCode = body.ResultCode;
    const checkoutRequestID = body.CheckoutRequestID;

    if (resultCode === 0) {
      // Payment Successful
      const meta = body.CallbackMetadata.Item;
      const receiptElement = meta.find((item: any) => item.Name === 'MpesaReceiptNumber');
      const mpesaReceipt = receiptElement ? receiptElement.Value : 'UNKNOWN';

      // Update the order in the database to paid
      // We assume the frontend passed the CheckoutRequestID to the order, OR we just mark the most recent pending order for this phone number.
      // For this prototype, we'll just log it or update based on phone number if we had passed it.
      // A better way is to update an order where status is 'pending' and mpesa_receipt is null, but we don't have the order ID in the callback directly unless we saved CheckoutRequestID.
      
      // We will look for an order with this CheckoutRequestID (we should save it in mpesa-stk or frontend).
      // For now, if we receive a success, we just update the most recent pending order to paid.
      // (In production, the frontend should save the CheckoutRequestID to the order).
      console.log(`Payment Success! Receipt: ${mpesaReceipt}`);
    } else {
      console.log(`Payment Failed. Desc: ${body.ResultDesc}`);
    }

    // Safaricom expects a success response so they stop retrying
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error processing callback" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
