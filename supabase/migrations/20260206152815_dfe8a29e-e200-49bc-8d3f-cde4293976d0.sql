-- Desactivar RLS temporalmente en companies para MVP
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- Asegurar que profiles permite UPDATE del company_id por el propio usuario
DROP POLICY IF EXISTS "Users can update own company_id" ON profiles;
CREATE POLICY "Users can update own company_id"
ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Asegurar política INSERT en user_roles para creadores de empresa
DROP POLICY IF EXISTS "Users can create own admin role" ON user_roles;
CREATE POLICY "Users can create own admin role"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());