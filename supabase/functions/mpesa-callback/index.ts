import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("M-Pesa Callback Received:", JSON.stringify(payload));

    const body = payload?.Body?.stkCallback;
    if (!body) {
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Invalid payload" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const resultCode = body.ResultCode;
    const checkoutRequestID = body.CheckoutRequestID;

    if (resultCode === 0) {
      // ── Payment Successful ─────────────────────────────────────────────────
      const meta = body.CallbackMetadata?.Item || [];
      const receiptElement = meta.find((item: any) => item.Name === 'MpesaReceiptNumber');
      const mpesaReceipt = receiptElement ? String(receiptElement.Value) : 'UNKNOWN';

      const phoneElement = meta.find((item: any) => item.Name === 'PhoneNumber');
      const paidPhone = phoneElement ? String(phoneElement.Value) : null;

      const amountElement = meta.find((item: any) => item.Name === 'Amount');
      const paidAmount = amountElement ? Number(amountElement.Value) : null;

      let targetOrderId: string | null = null;

      // 1. Primary match: by CheckoutRequestID
      if (checkoutRequestID) {
        const { data: matchedOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('mpesa_checkout_id', checkoutRequestID)
          .maybeSingle();

        if (matchedOrder?.id) {
          targetOrderId = matchedOrder.id;
          console.log(`Matched order ${targetOrderId} via CheckoutRequestID: ${checkoutRequestID}`);
        }
      }

      // 2. Fallback match: by customer phone number on pending orders
      if (!targetOrderId && paidPhone) {
        let altPhone = paidPhone;
        if (paidPhone.startsWith('254') && paidPhone.length === 12) {
          altPhone = '0' + paidPhone.slice(3); // e.g. 0719664975
        } else if (paidPhone.startsWith('0') && paidPhone.length === 10) {
          altPhone = '254' + paidPhone.slice(1);
        }

        const { data: fallbackOrders } = await supabase
          .from('orders')
          .select('id')
          .or(`customer_phone.eq.${paidPhone},customer_phone.eq.${altPhone}`)
          .neq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1);

        if (fallbackOrders && fallbackOrders.length > 0) {
          targetOrderId = fallbackOrders[0].id;
          console.log(`Matched order ${targetOrderId} via phone fallback: ${paidPhone}`);
        }
      }

      // 3. Last-resort match: most recent pending order matching the paid amount
      if (!targetOrderId && paidAmount) {
        const { data: amountOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('fee', paidAmount)
          .neq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1);

        if (amountOrders && amountOrders.length > 0) {
          targetOrderId = amountOrders[0].id;
          console.log(`Matched order ${targetOrderId} via amount fallback: KES ${paidAmount}`);
        }
      }

      if (targetOrderId) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'paid',
            mpesa_receipt: mpesaReceipt,
            mpesa_checkout_id: checkoutRequestID || undefined
          })
          .eq('id', targetOrderId);

        if (updateError) {
          console.error(`Failed to update order ${targetOrderId}:`, updateError.message);
        } else {
          console.log(`Order ${targetOrderId} marked as PAID. Receipt: ${mpesaReceipt}`);
        }
      } else {
        console.warn(`Could not match any order for CheckoutRequestID: ${checkoutRequestID}, Phone: ${paidPhone}`);
      }

    } else {
      // ── Payment Failed or Cancelled ────────────────────────────────────────
      console.log(`Payment Failed/Cancelled. CheckoutRequestID: ${checkoutRequestID}. Desc: ${body.ResultDesc}`);

      if (checkoutRequestID) {
        await supabase
          .from('orders')
          .update({ mpesa_checkout_id: null })
          .eq('mpesa_checkout_id', checkoutRequestID);
      }
    }

    // Safaricom expects a success response so they stop retrying
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('mpesa-callback error:', error);
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error processing callback" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
