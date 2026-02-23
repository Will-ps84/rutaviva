
-- Add unique constraint on user_roles(user_id, role) if not exists for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- RLS policies for driver_activation_codes
ALTER TABLE public.driver_activation_codes ENABLE ROW LEVEL SECURITY;

-- Admins can view codes for their company
CREATE POLICY "admins_view_activation_codes"
ON public.driver_activation_codes
FOR SELECT
USING (
  is_super_admin() OR
  (company_id = get_user_company_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role)))
);

-- System can insert (edge functions use service role, bypasses RLS)
CREATE POLICY "system_insert_activation_codes"
ON public.driver_activation_codes
FOR INSERT
WITH CHECK (true);

-- System can update (for marking used_at)
CREATE POLICY "system_update_activation_codes"
ON public.driver_activation_codes
FOR UPDATE
USING (true);
