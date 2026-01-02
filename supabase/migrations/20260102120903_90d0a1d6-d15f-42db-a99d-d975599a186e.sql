-- Add Razorpay and invoice columns to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
ADD COLUMN IF NOT EXISTS razorpay_link_id text,
ADD COLUMN IF NOT EXISTS link_url text,
ADD COLUMN IF NOT EXISTS link_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS invoice_number text,
ADD COLUMN IF NOT EXISTS invoice_url text;

-- Create invoice_settings table
CREATE TABLE IF NOT EXISTS public.invoice_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL DEFAULT 'Your Company Name',
  address text,
  gstin text,
  pan text,
  logo_url text,
  terms text DEFAULT 'Payment is due within 30 days.',
  bank_name text,
  bank_account text,
  bank_ifsc text,
  email text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on invoice_settings
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy for invoice_settings - admins only
CREATE POLICY "Admins can manage invoice_settings" 
ON public.invoice_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email text NOT NULL,
  subject text NOT NULL,
  template text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  entity_type text,
  entity_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy for email_logs - admins only
CREATE POLICY "Admins can manage email_logs" 
ON public.email_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create invoices storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for invoices bucket - public read
CREATE POLICY "Public can read invoices"
ON storage.objects
FOR SELECT
USING (bucket_id = 'invoices');

-- Storage policy for invoices bucket - admins can upload
CREATE POLICY "Admins can upload invoices"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'invoices' AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for invoice_settings updated_at
CREATE TRIGGER update_invoice_settings_updated_at
BEFORE UPDATE ON public.invoice_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default invoice settings if none exist
INSERT INTO public.invoice_settings (company_name, terms)
SELECT 'Your Company Name', 'Payment is due within 30 days.'
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_settings);