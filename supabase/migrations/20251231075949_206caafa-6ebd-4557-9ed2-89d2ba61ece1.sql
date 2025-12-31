-- Link partner auth users to partners table and assign partner role
-- Run this AFTER creating the partner accounts via signup

-- Link partner1@vion.in to TechNet Solutions
UPDATE public.partners 
SET user_id = (SELECT id FROM auth.users WHERE email = 'partner1@vion.in' LIMIT 1)
WHERE name = 'TechNet Solutions';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'partner'::app_role FROM auth.users WHERE email = 'partner1@vion.in'
ON CONFLICT (user_id, role) DO NOTHING;

-- Link partner2@vion.in to QuickFiber Partners
UPDATE public.partners 
SET user_id = (SELECT id FROM auth.users WHERE email = 'partner2@vion.in' LIMIT 1)
WHERE name = 'QuickFiber Partners';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'partner'::app_role FROM auth.users WHERE email = 'partner2@vion.in'
ON CONFLICT (user_id, role) DO NOTHING;

-- Link partner3@vion.in to NetWorks India
UPDATE public.partners 
SET user_id = (SELECT id FROM auth.users WHERE email = 'partner3@vion.in' LIMIT 1)
WHERE name = 'NetWorks India';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'partner'::app_role FROM auth.users WHERE email = 'partner3@vion.in'
ON CONFLICT (user_id, role) DO NOTHING;