import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketUpdateRequest {
  ticket_id: string;
  new_status: string;
  resolution_notes?: string;
  notify_customer?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticket_id, new_status, resolution_notes, notify_customer = true }: TicketUpdateRequest = await req.json();

    console.log(`Updating ticket ${ticket_id} to status ${new_status}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select(`
        *,
        customers(id, name, phone, address),
        ticket_categories(name)
      `)
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      throw new Error("Ticket not found");
    }

    const oldStatus = ticket.status;

    // Update ticket
    const updateData: any = { status: new_status };
    if (resolution_notes) {
      updateData.resolution_notes = resolution_notes;
    }

    await supabase
      .from("tickets")
      .update(updateData)
      .eq("id", ticket_id);

    // Create audit log
    await supabase.from("audit_log").insert({
      action: "update",
      entity_type: "ticket",
      entity_id: ticket_id,
      old_value: { status: oldStatus },
      new_value: { status: new_status, resolution_notes },
    });

    // Create notification
    const customer = ticket.customers as any;
    await supabase.from("notifications").insert({
      title: "Ticket Updated",
      message: `Ticket for ${customer?.name || "customer"} changed from ${oldStatus} to ${new_status}`,
      type: "ticket_update",
      entity_type: "ticket",
      entity_id: ticket_id,
    });

    // Log the notification if customer notified
    if (notify_customer && customer) {
      await supabase.from("email_logs").insert({
        to_email: customer.phone,
        subject: `Ticket Update - ${new_status}`,
        template: "ticket_update",
        status: "sent",
        entity_type: "ticket",
        entity_id: ticket_id,
      });
    }

    console.log("Ticket updated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id,
        old_status: oldStatus,
        new_status,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error updating ticket:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
