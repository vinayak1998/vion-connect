-- Insert admin role for existing user
INSERT INTO public.user_roles (user_id, role)
VALUES ('6fee1244-dabf-4b4e-aa3a-24283b3c905e', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create trigger function to auto-assign admin role to new users (for development)
CREATE OR REPLACE FUNCTION public.assign_admin_role_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for new signups
CREATE TRIGGER on_auth_user_created_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_admin_role_on_signup();