-- ============================================================
-- SECURITY HARDENING: profiles company_id immutability
-- Applies prevent_company_id_change trigger to profiles table
-- (was missing — critical multi-tenant isolation bypass fix)
-- ============================================================

-- Attach the existing trigger function to profiles
DROP TRIGGER IF EXISTS prevent_profiles_company_change ON public.profiles;
CREATE TRIGGER prevent_profiles_company_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_id_change();

-- ============================================================
-- SECURITY: Fix companies INSERT policy (USING true → scoped)
-- Allows insert only during onboarding (no existing company_id)
-- or by super_admin. Replaces the overly-permissive `true` check.
-- ============================================================
DROP POLICY IF EXISTS "authenticated_insert_company" ON public.companies;

CREATE POLICY "authenticated_insert_company" ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins can always create companies
    is_super_admin()
    -- OR the user has no company yet (onboarding flow)
    OR NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Ensure RLS is enabled on companies (document explicitly)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Document RLS activation for all core tables (idempotent)
-- ============================================================
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_points      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stop_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_activation_codes ENABLE ROW LEVEL SECURITY;
