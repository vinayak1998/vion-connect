import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompleteRequest {
  install_ticket_id: string;
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { install_ticket_id, notes }: CompleteRequest = await req.json();

    console.log(`Completing installation ${install_ticket_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch install ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("install_tickets")
      .select(`
        *,
        leads(id, name, phone),
        customers(id, name, phone, address, pincode)
      `)
      .eq("id", install_ticket_id)
      .single();

    if (ticketError || !ticket) {
      throw new Error("Installation ticket not found");
    }

    // Update install ticket status
    await supabase
      .from("install_tickets")
      .update({
        status: "Completed",
        notes: notes ? `${ticket.notes || ""}\n\nCompletion notes: ${notes}` : ticket.notes,
      })
      .eq("id", install_ticket_id);

    // Update lead stage if lead exists
    if (ticket.lead_id) {
      await supabase
        .from("leads")
        .update({ stage: "Installed" })
        .eq("id", ticket.lead_id);
    }

    // Update customer installation date if customer exists
    if (ticket.customer_id) {
      await supabase
        .from("customers")
        .update({
          installation_date: new Date().toISOString().split("T")[0],
          status: "Active",
        })
        .eq("id", ticket.customer_id);
    }

    // Create notification
    const customer = ticket.customers as any;
    const lead = ticket.leads as any;
    const customerName = customer?.name || lead?.name || "Unknown";

    await supabase.from("notifications").insert({
      title: "Installation Completed",
      message: `Installation for ${customerName} has been completed`,
      type: "installation_complete",
      entity_type: "install_ticket",
      entity_id: install_ticket_id,
    });

    // Get customer plan to send welcome email
    if (ticket.customer_id) {
      const { data: customerPlan } = await supabase
        .from("customer_plans")
        .select(`
          *,
          plans(name, speed_mbps, validity_days)
        `)
        .eq("customer_id", ticket.customer_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (customerPlan && customer) {
        // Log welcome message sent
        await supabase.from("email_logs").insert({
          to_email: customer.phone,
          subject: "Welcome to Vion Internet!",
          template: "welcome",
          status: "sent",
          entity_type: "customer",
          entity_id: ticket.customer_id,
        });
      }
    }

    console.log("Installation completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: install_ticket_id,
        customer_id: ticket.customer_id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error completing installation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
