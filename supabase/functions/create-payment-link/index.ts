import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentLinkRequest {
  payment_id: string;
  customer_id: string;
  amount: number;
  plan_name: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  send_email?: boolean;
  send_sms?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      payment_id, 
      customer_id, 
      amount, 
      plan_name, 
      customer_name, 
      customer_phone,
      customer_email,
      send_email = true,
      send_sms = false 
    }: PaymentLinkRequest = await req.json();

    console.log(`Creating payment link for payment ${payment_id}, amount: ${amount}`);

    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured");
    }

    // Create Razorpay payment link
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now
    
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to paise
        currency: "INR",
        accept_partial: false,
        expire_by: expiresAt,
        reference_id: payment_id,
        description: `Payment for ${plan_name}`,
        customer: {
          name: customer_name,
          contact: `+91${customer_phone.replace(/^\+91/, "")}`,
          email: customer_email || undefined,
        },
        notify: {
          sms: send_sms,
          email: false, // We'll handle email ourselves with Resend
        },
        callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/razorpay-webhook`,
        callback_method: "get",
        notes: {
          payment_id,
          customer_id,
          plan_name,
        },
      }),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error("Razorpay error:", errorText);
      throw new Error(`Razorpay API error: ${razorpayResponse.status}`);
    }

    const razorpayData = await razorpayResponse.json();
    console.log("Payment link created:", razorpayData.id);

    // Update payment record with link details
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const expiresDate = new Date(expiresAt * 1000).toISOString();

    await supabase
      .from("payments")
      .update({
        razorpay_link_id: razorpayData.id,
        link_url: razorpayData.short_url,
        link_expires_at: expiresDate,
        status: "Pending",
      })
      .eq("id", payment_id);

    // Send email if requested and email is provided
    if (send_email && customer_email) {
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          to: customer_email,
          subject: `Payment Request - ${plan_name}`,
          template: "payment_link",
          data: {
            customerName: customer_name,
            planName: plan_name,
            amount,
            paymentLink: razorpayData.short_url,
            expiresAt: new Date(expiresDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          },
          entity_type: "payment",
          entity_id: payment_id,
        }),
      });

      if (!emailResponse.ok) {
        console.error("Failed to send email:", await emailResponse.text());
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        link_id: razorpayData.id,
        link_url: razorpayData.short_url,
        expires_at: expiresDate,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error creating payment link:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
