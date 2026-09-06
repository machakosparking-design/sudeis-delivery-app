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
      // ── Payment Successful ─────────────────────────────────────────────────
      const meta = body.CallbackMetadata.Item;
      const receiptElement = meta.find((item: any) => item.Name === 'MpesaReceiptNumber');
      const mpesaReceipt = receiptElement ? receiptElement.Value : 'UNKNOWN';

      // Find the exact order using the CheckoutRequestID that was saved during
      // the STK push. This eliminates any guesswork or race conditions.
      const { data: matchedOrder, error: findError } = await supabase
        .from('orders')
        .select('id')
        .eq('mpesa_checkout_id', checkoutRequestID)
        .single();

      if (findError || !matchedOrder) {
        console.error(`Could not find order for CheckoutRequestID: ${checkoutRequestID}`, findError?.message);
        // Still return 200 so Safaricom stops retrying — log for manual review
      } else {
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'paid',
            mpesa_receipt: mpesaReceipt,
          })
          .eq('id', matchedOrder.id);

        if (updateError) {
          console.error(`Failed to update order ${matchedOrder.id}:`, updateError.message);
        } else {
          console.log(`Order ${matchedOrder.id} marked as PAID. Receipt: ${mpesaReceipt}`);
        }
      }
    } else {
      // ── Payment Failed or Cancelled ────────────────────────────────────────
      console.log(`Payment Failed/Cancelled. CheckoutRequestID: ${checkoutRequestID}. Desc: ${body.ResultDesc}`);

      // Optionally mark the order's payment as failed for UI feedback
      const { error: failError } = await supabase
        .from('orders')
        .update({ mpesa_checkout_id: null }) // Clear the ID so it can be retried
        .eq('mpesa_checkout_id', checkoutRequestID);

      if (failError) {
        console.error('Failed to clear failed checkout ID:', failError.message);
      }
    }

    // Safaricom expects a success response to stop retrying
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('mpesa-callback error:', error);
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error processing callback" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

