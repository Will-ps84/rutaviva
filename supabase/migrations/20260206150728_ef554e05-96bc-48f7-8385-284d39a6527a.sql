-- Drop the existing restrictive INSERT policy that's causing issues
DROP POLICY IF EXISTS "Users without company can create companies" ON companies;

-- Create a PERMISSIVE INSERT policy for first company creation
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

-- Create function to auto-update profile after company creation
CREATE OR REPLACE FUNCTION handle_company_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the creator's profile with the new company_id
  UPDATE profiles
  SET company_id = NEW.id
  WHERE id = auth.uid();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger that fires after company insert
CREATE TRIGGER on_company_created
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION handle_company_created();