import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return signature === expectedSignature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");
    }

    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    // Verify webhook signature
    if (signature) {
      const isValid = await verifySignature(body, signature, webhookSecret);
      
      if (!isValid) {
        console.error("Invalid webhook signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const event = JSON.parse(body);
    console.log("Received webhook event:", event.event);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = event.payload;

    switch (event.event) {
      case "payment_link.paid": {
        const paymentLink = payload.payment_link.entity;
        const payment = payload.payment.entity;
        const paymentId = paymentLink.notes?.payment_id;
        const customerId = paymentLink.notes?.customer_id;
        const planName = paymentLink.notes?.plan_name;

        console.log(`Payment link paid: ${paymentLink.id}, payment_id: ${paymentId}`);

        if (!paymentId) {
          console.error("No payment_id in notes");
          break;
        }

        // Update payment status
        const { data: paymentRecord, error: updateError } = await supabase
          .from("payments")
          .update({
            status: "Paid",
            razorpay_payment_id: payment.id,
            method: payment.method === "upi" ? "UPI" : 
                    payment.method === "card" ? "Card" : 
                    payment.method === "netbanking" ? "Bank Transfer" : "Other",
          })
          .eq("id", paymentId)
          .select(`
            *,
            customers(name, phone, address, pincode),
            plans(name, price, validity_days, speed_mbps)
          `)
          .single();

        if (updateError) {
          console.error("Error updating payment:", updateError);
          break;
        }

        // Create customer plan if plan_id exists
        if (paymentRecord.plan_id && customerId) {
          const startDate = new Date();
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + (paymentRecord.plans?.validity_days || 30));

          await supabase.from("customer_plans").insert({
            customer_id: customerId,
            plan_id: paymentRecord.plan_id,
            start_date: startDate.toISOString().split("T")[0],
            expiry_date: expiryDate.toISOString().split("T")[0],
          });
        }

        // Generate invoice
        const invoiceResponse = await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ payment_id: paymentId }),
        });

        let invoiceUrl = null;
        if (invoiceResponse.ok) {
          const invoiceData = await invoiceResponse.json();
          invoiceUrl = invoiceData.invoice_url;
        }

        // Send payment success email if customer has email
        // For now we'll use phone as a placeholder since we don't have email in customers table
        // In production, you'd add an email column to customers table
        
        console.log("Payment processed successfully:", paymentId);
        break;
      }

      case "payment_link.expired": {
        const paymentLink = payload.payment_link.entity;
        const paymentId = paymentLink.notes?.payment_id;

        if (paymentId) {
          await supabase
            .from("payments")
            .update({ status: "Failed" })
            .eq("id", paymentId);
          console.log(`Payment link expired: ${paymentId}`);
        }
        break;
      }

      case "payment.captured": {
        console.log("Payment captured:", payload.payment.entity.id);
        break;
      }

      case "payment.failed": {
        const payment = payload.payment.entity;
        console.log("Payment failed:", payment.id, payment.error_description);
        break;
      }

      default:
        console.log("Unhandled event:", event.event);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
