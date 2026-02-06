-- Drop existing policy and recreate correctly
DROP POLICY IF EXISTS "users_can_create_first_company" ON companies;
DROP POLICY IF EXISTS "Users without company can create companies" ON companies;

-- Create permissive INSERT policy for first company creation
CREATE POLICY "users_can_create_first_company"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id IS NOT NULL
  )
);

-- Drop and recreate trigger function with admin role assignment
DROP TRIGGER IF EXISTS on_company_created ON companies;

CREATE OR REPLACE FUNCTION handle_company_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile del creador con company_id
  UPDATE profiles
  SET company_id = NEW.id
  WHERE id = auth.uid();
  
  -- Asignar rol admin al creador
  INSERT INTO user_roles (user_id, company_id, role)
  VALUES (auth.uid(), NEW.id, 'admin')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_company_created
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION handle_company_created();