import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConvertRequest {
  lead_id: string;
  plan_id: string;
  partner_id?: string;
  installation_date?: string;
  create_install_ticket?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, plan_id, partner_id, installation_date, create_install_ticket = true }: ConvertRequest = await req.json();

    console.log(`Converting lead ${lead_id} to customer`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    // Check if lead is already converted
    if (lead.stage === "Installed") {
      throw new Error("Lead is already converted to customer");
    }

    // Fetch plan details
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
      throw new Error("Plan not found");
    }

    // Create customer
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        name: lead.name,
        phone: lead.phone,
        address: lead.address,
        pincode: lead.pincode,
        partner_id: partner_id || null,
        lead_id: lead.id,
        status: "Active",
        installation_date: installation_date || null,
      })
      .select()
      .single();

    if (customerError) {
      console.error("Customer creation error:", customerError);
      throw new Error("Failed to create customer");
    }

    // Create customer plan
    const startDate = installation_date ? new Date(installation_date) : new Date();
    const expiryDate = new Date(startDate);
    expiryDate.setDate(expiryDate.getDate() + plan.validity_days);

    await supabase.from("customer_plans").insert({
      customer_id: customer.id,
      plan_id: plan_id,
      start_date: startDate.toISOString().split("T")[0],
      expiry_date: expiryDate.toISOString().split("T")[0],
    });

    // Update lead stage
    await supabase
      .from("leads")
      .update({ stage: "Scheduled Installation" })
      .eq("id", lead_id);

    // Create installation ticket if requested
    let installTicket = null;
    if (create_install_ticket) {
      const scheduledDate = installation_date || new Date().toISOString().split("T")[0];
      
      const { data: ticket, error: ticketError } = await supabase
        .from("install_tickets")
        .insert({
          lead_id: lead.id,
          customer_id: customer.id,
          partner_id: partner_id || null,
          scheduled_date: scheduledDate,
          status: "Open",
          notes: `New customer installation - ${plan.name} (${plan.speed_mbps} Mbps)`,
        })
        .select()
        .single();

      if (ticketError) {
        console.error("Install ticket error:", ticketError);
      } else {
        installTicket = ticket;
      }
    }

    // Create notification
    await supabase.from("notifications").insert({
      title: "New Customer Created",
      message: `Lead ${lead.name} has been converted to a customer with ${plan.name} plan`,
      type: "lead_converted",
      entity_type: "customer",
      entity_id: customer.id,
    });

    console.log("Lead converted successfully:", customer.id);

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: customer.id,
        install_ticket_id: installTicket?.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error converting lead:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
