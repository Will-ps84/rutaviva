
-- Fix infinite recursion in profiles policies
-- admins_view_company_profiles references profiles table causing recursion
-- Use get_user_company_id() (security definer) instead

DROP POLICY IF EXISTS "admins_view_company_profiles" ON profiles;

CREATE POLICY "admins_view_company_profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  company_id = public.get_user_company_id()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'owner')
  )
);
