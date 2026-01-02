import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  template: "payment_link" | "payment_success" | "invoice" | "renewal_reminder" | "ticket_update" | "welcome";
  data: Record<string, any>;
  entity_type?: string;
  entity_id?: string;
}

const getEmailHtml = (template: string, data: Record<string, any>): string => {
  const baseStyle = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #ffffff;
  `;

  const buttonStyle = `
    display: inline-block;
    padding: 12px 24px;
    background-color: #3b82f6;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
  `;

  switch (template) {
    case "payment_link":
      return `
        <div style="${baseStyle}">
          <h1 style="color: #1e40af;">Payment Request</h1>
          <p>Dear ${data.customerName},</p>
          <p>Please complete your payment for <strong>${data.planName}</strong>.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1e40af;">₹${data.amount}</p>
            <p style="margin: 5px 0 0; color: #6b7280;">Due by: ${data.expiresAt}</p>
          </div>
          <a href="${data.paymentLink}" style="${buttonStyle}">Pay Now</a>
          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
            This link will expire on ${data.expiresAt}. If you have any questions, please contact our support.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">Vion Internet Services</p>
        </div>
      `;

    case "payment_success":
      return `
        <div style="${baseStyle}">
          <h1 style="color: #059669;">Payment Successful! ✓</h1>
          <p>Dear ${data.customerName},</p>
          <p>Thank you for your payment. Your transaction has been completed successfully.</p>
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <p style="margin: 0;"><strong>Amount Paid:</strong> ₹${data.amount}</p>
            <p style="margin: 5px 0;"><strong>Plan:</strong> ${data.planName}</p>
            <p style="margin: 5px 0;"><strong>Transaction ID:</strong> ${data.transactionId}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${data.date}</p>
          </div>
          ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" style="${buttonStyle}">Download Invoice</a>` : ""}
          <p style="margin-top: 20px; color: #6b7280;">Your plan is now active. Enjoy high-speed internet!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">Vion Internet Services</p>
        </div>
      `;

    case "invoice":
      return `
        <div style="${baseStyle}">
          <h1 style="color: #1e40af;">Your Invoice</h1>
          <p>Dear ${data.customerName},</p>
          <p>Please find your invoice attached for the recent payment.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> ₹${data.amount}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${data.date}</p>
          </div>
          <a href="${data.invoiceUrl}" style="${buttonStyle}">Download Invoice</a>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">Vion Internet Services</p>
        </div>
      `;

    case "renewal_reminder":
      return `
        <div style="${baseStyle}">
          <h1 style="color: #d97706;">Plan Renewal Reminder</h1>
          <p>Dear ${data.customerName},</p>
          <p>Your internet plan is expiring soon. Please renew to avoid service interruption.</p>
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d97706;">
            <p style="margin: 0;"><strong>Current Plan:</strong> ${data.planName}</p>
            <p style="margin: 5px 0;"><strong>Expires On:</strong> ${data.expiryDate}</p>
            <p style="margin: 5px 0;"><strong>Days Remaining:</strong> ${data.daysRemaining}</p>
          </div>
          ${data.paymentLink ? `<a href="${data.paymentLink}" style="${buttonStyle}">Renew Now</a>` : ""}
          <p style="margin-top: 20px; color: #6b7280;">Renew today and continue enjoying uninterrupted internet service.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">Vion Internet Services</p>
        </div>
      `;

    case "ticket_update":
      return `
        <div style="${baseStyle}">
          <h1 style="color: #1e40af;">Ticket Update</h1>
          <p>Dear ${data.customerName},</p>
          <p>Your support ticket has been updated.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Ticket ID:</strong> ${data.ticketId}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> ${data.status}</p>
            <p style="margin: 5px 0;"><strong>Description:</strong> ${data.description}</p>
            ${data.resolutionNotes ? `<p style="margin: 5px 0;"><strong>Resolution:</strong> ${data.resolutionNotes}</p>` : ""}
          </div>
          <p style="color: #6b7280;">If you have any questions, please contact our support team.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">Vion Internet Services</p>
        </div>
      `;

    case "welcome":
      return `
        <div style="${baseStyle}">
          <h1 style="color: #059669;">Welcome to Vion! 🎉</h1>
          <p>Dear ${data.customerName},</p>
          <p>Welcome aboard! Your installation has been completed successfully.</p>
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Plan:</strong> ${data.planName}</p>
            <p style="margin: 5px 0;"><strong>Speed:</strong> ${data.speed} Mbps</p>
            <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${data.expiryDate}</p>
          </div>
          <p>You can now enjoy high-speed internet at your home. Here are a few things to get you started:</p>
          <ul style="color: #374151;">
            <li>Connect your devices to your new WiFi network</li>
            <li>Save our support number for quick assistance</li>
            <li>Check your email for billing updates</li>
          </ul>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">Vion Internet Services</p>
        </div>
      `;

    default:
      return `<p>${JSON.stringify(data)}</p>`;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, template, data, entity_type, entity_id }: EmailRequest = await req.json();

    console.log(`Sending ${template} email to ${to}`);

    const html = getEmailHtml(template, data);

    const emailResponse = await resend.emails.send({
      from: "Vion Internet <noreply@resend.dev>",
      to: [to],
      subject,
      html,
    });

    console.log("Email sent:", emailResponse);

    // Log email to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase.from("email_logs").insert({
      to_email: to,
      subject,
      template,
      status: emailResponse.error ? "failed" : "sent",
      error_message: emailResponse.error?.message || null,
      entity_type,
      entity_id,
    });

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
