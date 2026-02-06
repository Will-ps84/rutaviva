-- Fix: Restringir creación de empresas solo a usuarios sin empresa asignada
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;

CREATE POLICY "Users without company can create companies"
    ON public.companies
    FOR INSERT
    TO authenticated
    WITH CHECK (public.get_user_company_id() IS NULL);