-- Phase 1: Database Schema Changes for Partner Login

-- 1.1 Add 'partner' value to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'partner';

-- 1.2 Add user_id column to partners table to link with auth users
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
CREATE UNIQUE INDEX IF NOT EXISTS partners_user_id_idx ON public.partners(user_id) WHERE user_id IS NOT NULL;

-- 1.3 Create security definer function to get partner_id from user_id
CREATE OR REPLACE FUNCTION public.get_partner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.partners WHERE user_id = _user_id LIMIT 1
$$;

-- 1.4 Update RLS policies for partner access

-- Partners table: partners can view their own record
CREATE POLICY "Partners can view own record"
ON public.partners
FOR SELECT
USING (user_id = auth.uid());

-- Install tickets: partners can view and update tickets assigned to them
CREATE POLICY "Partners can view assigned install_tickets"
ON public.install_tickets
FOR SELECT
USING (partner_id = public.get_partner_id(auth.uid()));

CREATE POLICY "Partners can update assigned install_tickets"
ON public.install_tickets
FOR UPDATE
USING (partner_id = public.get_partner_id(auth.uid()));

-- Tickets: partners can view and update tickets assigned to them
CREATE POLICY "Partners can view assigned tickets"
ON public.tickets
FOR SELECT
USING (partner_id = public.get_partner_id(auth.uid()));

CREATE POLICY "Partners can update assigned tickets"
ON public.tickets
FOR UPDATE
USING (partner_id = public.get_partner_id(auth.uid()));

-- Customers: partners can view customers linked to their install tickets or tickets
CREATE POLICY "Partners can view related customers"
ON public.customers
FOR SELECT
USING (
  partner_id = public.get_partner_id(auth.uid())
  OR id IN (
    SELECT customer_id FROM public.install_tickets 
    WHERE partner_id = public.get_partner_id(auth.uid()) AND customer_id IS NOT NULL
  )
  OR id IN (
    SELECT customer_id FROM public.tickets 
    WHERE partner_id = public.get_partner_id(auth.uid())
  )
);

-- Leads: partners can view leads linked to their install tickets
CREATE POLICY "Partners can view related leads"
ON public.leads
FOR SELECT
USING (
  id IN (
    SELECT lead_id FROM public.install_tickets 
    WHERE partner_id = public.get_partner_id(auth.uid()) AND lead_id IS NOT NULL
  )
);