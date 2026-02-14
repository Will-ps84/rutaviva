
-- Fix 1: Restrict location_points SELECT to admin/dispatcher/owner + own driver
DROP POLICY IF EXISTS "company_view_own_locations" ON location_points;

CREATE POLICY "company_view_own_locations"
ON location_points FOR SELECT
TO authenticated
USING (
  company_id = (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())
  AND (
    driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'owner')
  )
);

-- Fix 2: Restrict profiles SELECT - drivers can only see own profile + names (not phone) of others
-- Replace current policy with two: one for own profile, one for company profiles (admin/dispatcher/owner only)
DROP POLICY IF EXISTS "users_view_company_profiles" ON profiles;

-- Everyone can see their own profile
CREATE POLICY "users_view_own_profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Admin/dispatcher/owner can see all company profiles (including phone)
CREATE POLICY "admins_view_company_profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR public.has_role(auth.uid(), 'owner')
  )
);
