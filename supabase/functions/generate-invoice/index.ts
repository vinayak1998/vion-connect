import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceRequest {
  payment_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id }: InvoiceRequest = await req.json();

    console.log(`Generating invoice for payment ${payment_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch payment details
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(`
        *,
        customers(name, phone, address, pincode),
        plans(name, price, speed_mbps, validity_days),
        coupons(code, type, value)
      `)
      .eq("id", payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    // Fetch invoice settings
    const { data: settings } = await supabase
      .from("invoice_settings")
      .select("*")
      .limit(1)
      .single();

    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, "0")}-${payment_id.slice(0, 8).toUpperCase()}`;

    // Create invoice HTML
    const customer = payment.customers as any;
    const plan = payment.plans as any;
    const coupon = payment.coupons as any;

    const invoiceHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; background: #fff; }
    .invoice { max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .company { font-size: 24px; font-weight: bold; color: #1e40af; }
    .invoice-title { font-size: 32px; color: #374151; }
    .details { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .details-box { width: 45%; }
    .details-box h3 { color: #6b7280; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
    .details-box p { margin: 4px 0; color: #374151; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .table th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; }
    .table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .table .amount { text-align: right; }
    .totals { width: 300px; margin-left: auto; }
    .totals .row { display: flex; justify-content: space-between; padding: 8px 0; }
    .totals .total { font-size: 18px; font-weight: bold; border-top: 2px solid #374151; padding-top: 12px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 4px 0; }
    .paid-stamp { position: absolute; top: 50%; right: 40px; transform: rotate(-15deg); font-size: 48px; font-weight: bold; color: rgba(34, 197, 94, 0.2); border: 4px solid rgba(34, 197, 94, 0.3); padding: 10px 30px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="invoice" style="position: relative;">
    ${payment.status === "Paid" ? '<div class="paid-stamp">PAID</div>' : ''}
    <div class="header">
      <div>
        <div class="company">${settings?.company_name || "Vion Internet Services"}</div>
        <p style="color: #6b7280; margin-top: 4px;">${settings?.address || ""}</p>
        ${settings?.gstin ? `<p style="color: #6b7280; font-size: 12px;">GSTIN: ${settings.gstin}</p>` : ""}
      </div>
      <div style="text-align: right;">
        <div class="invoice-title">INVOICE</div>
        <p style="color: #374151; margin-top: 8px;"><strong>${invoiceNumber}</strong></p>
        <p style="color: #6b7280;">Date: ${new Date(payment.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
    </div>

    <div class="details">
      <div class="details-box">
        <h3>Bill To</h3>
        <p><strong>${customer?.name || "Customer"}</strong></p>
        <p>${customer?.address || ""}</p>
        <p>${customer?.pincode || ""}</p>
        <p>Phone: ${customer?.phone || ""}</p>
      </div>
      <div class="details-box">
        <h3>Payment Details</h3>
        <p><strong>Status:</strong> ${payment.status}</p>
        <p><strong>Method:</strong> ${payment.method}</p>
        ${payment.razorpay_payment_id ? `<p><strong>Transaction ID:</strong> ${payment.razorpay_payment_id}</p>` : ""}
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Details</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${plan?.name || "Internet Service"}</strong></td>
          <td>${plan ? `${plan.speed_mbps} Mbps • ${plan.validity_days} days validity` : ""}</td>
          <td class="amount">₹${payment.original_amount || payment.amount}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="row">
        <span>Subtotal</span>
        <span>₹${payment.original_amount || payment.amount}</span>
      </div>
      ${coupon ? `
      <div class="row" style="color: #059669;">
        <span>Discount (${coupon.code})</span>
        <span>-₹${(payment.original_amount || payment.amount) - payment.amount}</span>
      </div>
      ` : ""}
      <div class="row total">
        <span>Total</span>
        <span>₹${payment.amount}</span>
      </div>
    </div>

    <div class="footer">
      ${settings?.bank_name ? `
      <p><strong>Bank Details:</strong> ${settings.bank_name} | A/C: ${settings.bank_account} | IFSC: ${settings.bank_ifsc}</p>
      ` : ""}
      <p>${settings?.terms || "Thank you for your business!"}</p>
      <p style="margin-top: 12px;">
        ${settings?.email ? `Email: ${settings.email}` : ""} 
        ${settings?.phone ? `| Phone: ${settings.phone}` : ""}
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Store invoice as HTML file in storage
    const fileName = `${invoiceNumber}.html`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(fileName, invoiceHtml, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload invoice");
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from("invoices")
      .getPublicUrl(fileName);

    // Update payment with invoice details
    await supabase
      .from("payments")
      .update({
        invoice_number: invoiceNumber,
        invoice_url: publicUrl.publicUrl,
      })
      .eq("id", payment_id);

    console.log("Invoice generated:", invoiceNumber);

    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoiceNumber,
        invoice_url: publicUrl.publicUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error generating invoice:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
