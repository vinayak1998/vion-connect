import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Running payment reminders check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get customer plans expiring in the next 7 days
    const today = new Date();
    const in7Days = new Date();
    in7Days.setDate(today.getDate() + 7);

    const { data: expiringPlans, error } = await supabase
      .from("customer_plans")
      .select(`
        *,
        customers(id, name, phone, address, pincode, status),
        plans(id, name, price, speed_mbps, validity_days)
      `)
      .gte("expiry_date", today.toISOString().split("T")[0])
      .lte("expiry_date", in7Days.toISOString().split("T")[0]);

    if (error) {
      throw error;
    }

    console.log(`Found ${expiringPlans?.length || 0} expiring plans`);

    const reminders: any[] = [];

    for (const customerPlan of expiringPlans || []) {
      const customer = customerPlan.customers as any;
      const plan = customerPlan.plans as any;

      if (!customer || customer.status !== "Active") continue;

      const expiryDate = new Date(customerPlan.expiry_date);
      const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Skip if not 7, 3, or 1 day(s) remaining
      if (![7, 3, 1].includes(daysRemaining)) continue;

      // Check if we already sent a reminder today for this customer
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: existingReminder } = await supabase
        .from("email_logs")
        .select("id")
        .eq("entity_type", "customer_plan")
        .eq("entity_id", customerPlan.id)
        .gte("created_at", todayStart.toISOString())
        .limit(1);

      if (existingReminder && existingReminder.length > 0) {
        console.log(`Already sent reminder for customer plan ${customerPlan.id} today`);
        continue;
      }

      // Create a pending payment for renewal
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          customer_id: customer.id,
          plan_id: plan.id,
          amount: plan.price,
          original_amount: plan.price,
          status: "Pending",
          method: "UPI",
          notes: `Renewal reminder - ${daysRemaining} day(s) before expiry`,
        })
        .select()
        .single();

      if (paymentError) {
        console.error("Error creating payment:", paymentError);
        continue;
      }

      // Create payment link
      const paymentLinkResponse = await fetch(`${supabaseUrl}/functions/v1/create-payment-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          payment_id: payment.id,
          customer_id: customer.id,
          amount: plan.price,
          plan_name: plan.name,
          customer_name: customer.name,
          customer_phone: customer.phone,
          send_email: false, // We'll send our own reminder email
          send_sms: true,
        }),
      });

      let paymentLink = null;
      if (paymentLinkResponse.ok) {
        const linkData = await paymentLinkResponse.json();
        paymentLink = linkData.link_url;
      }

      // Log the reminder (using email_logs table to track sent reminders)
      await supabase.from("email_logs").insert({
        to_email: customer.phone, // Using phone as identifier since we don't have email
        subject: `Plan Renewal Reminder - ${daysRemaining} day(s) remaining`,
        template: "renewal_reminder",
        status: "sent",
        entity_type: "customer_plan",
        entity_id: customerPlan.id,
      });

      // Create notification
      await supabase.from("notifications").insert({
        title: "Plan Expiring Soon",
        message: `${customer.name}'s ${plan.name} plan expires in ${daysRemaining} day(s)`,
        type: "renewal_reminder",
        entity_type: "customer",
        entity_id: customer.id,
      });

      reminders.push({
        customer_name: customer.name,
        customer_phone: customer.phone,
        plan_name: plan.name,
        days_remaining: daysRemaining,
        expiry_date: customerPlan.expiry_date,
        payment_link: paymentLink,
      });
    }

    console.log(`Sent ${reminders.length} reminders`);

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: reminders.length,
        reminders,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in payment-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
