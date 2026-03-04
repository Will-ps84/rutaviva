
-- Fix USING(true) / WITH CHECK(true) policies on application tables

-- driver_activation_codes: INSERT → restrict to admins/owners of the company
DROP POLICY IF EXISTS system_insert_activation_codes ON public.driver_activation_codes;
CREATE POLICY system_insert_activation_codes
  ON public.driver_activation_codes
  FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (
      company_id = get_user_company_id()
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    )
  );

-- driver_activation_codes: UPDATE → restrict to company members
DROP POLICY IF EXISTS system_update_activation_codes ON public.driver_activation_codes;
CREATE POLICY system_update_activation_codes
  ON public.driver_activation_codes
  FOR UPDATE
  USING (
    is_super_admin()
    OR company_id = get_user_company_id()
  );

-- profiles: INSERT → allow own id or admins in same company
DROP POLICY IF EXISTS system_insert_profiles ON public.profiles;
CREATE POLICY system_insert_profiles
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR is_super_admin()
    OR (
      company_id = get_user_company_id()
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    )
  );

-- audit_logs: INSERT → restrict to authenticated users for own company
DROP POLICY IF EXISTS system_insert_logs ON public.audit_logs;
CREATE POLICY system_insert_logs
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      company_id IS NULL
      OR company_id = get_user_company_id()
      OR is_super_admin()
    )
  );

-- Ensure companies RLS is on
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
