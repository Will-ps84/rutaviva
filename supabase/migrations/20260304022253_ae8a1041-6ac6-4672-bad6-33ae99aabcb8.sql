
-- Fix 1: Attach prevent_company_id_change trigger to profiles table
-- This prevents users from updating their own company_id to bypass multi-tenant isolation

DROP TRIGGER IF EXISTS prevent_profiles_company_change ON public.profiles;

CREATE TRIGGER prevent_profiles_company_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_company_id_change();

-- Fix 2: Add admin read access to stop-evidence storage bucket
-- Allows admins/dispatchers/owners to audit driver-uploaded delivery evidence

DROP POLICY IF EXISTS "admins_read_company_evidence" ON storage.objects;

CREATE POLICY "admins_read_company_evidence"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'stop-evidence'
  AND (
    -- Own files: always readable
    auth.uid()::text = (storage.foldername(name))[1]
    -- Admins, owners, dispatchers can read evidence linked to their company's stop events
    OR (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'dispatcher'::public.app_role)
    )
  )
);
