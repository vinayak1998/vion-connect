-- Create enums for various statuses
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TYPE public.lead_stage AS ENUM ('New', 'Contacted', 'Scheduled Installation', 'Installed', 'Lost');
CREATE TYPE public.install_status AS ENUM ('Open', 'In Progress', 'Installed', 'Verified');
CREATE TYPE public.customer_status AS ENUM ('Active', 'Suspended', 'Churned');
CREATE TYPE public.ticket_status AS ENUM ('Open', 'In Progress', 'Resolved', 'Closed');
CREATE TYPE public.ticket_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE public.ticket_assignment_type AS ENUM ('Partner', 'Internal');
CREATE TYPE public.payment_status AS ENUM ('Paid', 'Failed', 'Pending');
CREATE TYPE public.payment_method AS ENUM ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Other');
CREATE TYPE public.coupon_type AS ENUM ('percentage', 'flat');
CREATE TYPE public.booking_status AS ENUM ('Paid', 'Pending', 'Failed');

-- User roles table for admin authentication
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Partners table
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Serviceable areas table
CREATE TABLE public.serviceable_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pincode TEXT NOT NULL,
  area_name TEXT NOT NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pincode)
);

-- Leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  pincode TEXT NOT NULL,
  source TEXT DEFAULT 'Website',
  stage lead_stage NOT NULL DEFAULT 'New',
  notes TEXT,
  owner TEXT,
  next_followup_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Waitlist table
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pincode TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 50,
  status booking_status NOT NULL DEFAULT 'Paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  pincode TEXT NOT NULL,
  status customer_status NOT NULL DEFAULT 'Active',
  installation_date DATE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Install tickets table
CREATE TABLE public.install_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  status install_status NOT NULL DEFAULT 'Open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Plans table
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  speed_mbps INTEGER NOT NULL,
  validity_days INTEGER NOT NULL DEFAULT 30,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer plans table
CREATE TABLE public.customer_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coupons table
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type coupon_type NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  expiry_date DATE,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  original_amount DECIMAL(10,2),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  method payment_method NOT NULL DEFAULT 'UPI',
  status payment_status NOT NULL DEFAULT 'Paid',
  notes TEXT,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coupon redemptions table
CREATE TABLE public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ticket categories table
CREATE TABLE public.ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  assignment_type ticket_assignment_type NOT NULL DEFAULT 'Internal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Support tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.ticket_categories(id) ON DELETE SET NULL,
  priority ticket_priority NOT NULL DEFAULT 'Medium',
  status ticket_status NOT NULL DEFAULT 'Open',
  description TEXT NOT NULL,
  assigned_to_type ticket_assignment_type,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  internal_queue TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serviceable_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.install_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin access
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage partners" ON public.partners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage serviceable_areas" ON public.serviceable_areas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public can read serviceable areas for pincode check
CREATE POLICY "Public can read active serviceable areas" ON public.serviceable_areas
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Admins can manage leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public can insert leads
CREATE POLICY "Public can insert leads" ON public.leads
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Admins can manage waitlist" ON public.waitlist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public can insert to waitlist
CREATE POLICY "Public can insert waitlist" ON public.waitlist
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Admins can manage bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public can insert bookings
CREATE POLICY "Public can insert bookings" ON public.bookings
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Admins can manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage install_tickets" ON public.install_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage plans" ON public.plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public can read active plans
CREATE POLICY "Public can read active plans" ON public.plans
  FOR SELECT TO anon
  USING (active = true);

CREATE POLICY "Admins can manage customer_plans" ON public.customer_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage coupon_redemptions" ON public.coupon_redemptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage ticket_categories" ON public.ticket_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage tickets" ON public.tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read audit_log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit_log" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_serviceable_areas_updated_at BEFORE UPDATE ON public.serviceable_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_install_tickets_updated_at BEFORE UPDATE ON public.install_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-calculate expiry date for customer plans
CREATE OR REPLACE FUNCTION public.calculate_plan_expiry()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expiry_date = NEW.start_date + (SELECT validity_days FROM public.plans WHERE id = NEW.plan_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER calculate_customer_plan_expiry BEFORE INSERT OR UPDATE ON public.customer_plans
  FOR EACH ROW EXECUTE FUNCTION public.calculate_plan_expiry();