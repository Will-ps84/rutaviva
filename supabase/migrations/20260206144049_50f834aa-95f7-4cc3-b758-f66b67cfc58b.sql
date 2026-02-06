-- =============================================
-- ETAPA 1: Base de datos para RutaViva MVP
-- Roles, Companies, Profiles con multi-tenant
-- =============================================

-- 1. Crear enum para roles de aplicación
CREATE TYPE public.app_role AS ENUM ('admin', 'dispatcher', 'driver', 'viewer');

-- 2. Tabla de empresas (multi-tenant root)
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Tabla de perfiles (extiende auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Tabla de roles de usuario (separada por seguridad)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'driver',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, company_id, role)
);

-- 5. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 6. Trigger para actualizar updated_at en profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Función para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Trigger para crear perfil cuando se registra un usuario
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 9. Función de seguridad para verificar rol (evita recursión RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- 10. Función para obtener company_id del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT company_id
    FROM public.profiles
    WHERE id = auth.uid()
$$;

-- 11. Función para verificar si usuario pertenece a una empresa
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND company_id = _company_id
    )
$$;

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- COMPANIES Policies
-- Usuarios pueden ver su propia empresa
CREATE POLICY "Users can view their own company"
    ON public.companies
    FOR SELECT
    TO authenticated
    USING (id = public.get_user_company_id());

-- Solo admins pueden crear empresas (para onboarding)
CREATE POLICY "Users can create companies"
    ON public.companies
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Admins pueden actualizar su empresa
CREATE POLICY "Admins can update their company"
    ON public.companies
    FOR UPDATE
    TO authenticated
    USING (id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

-- PROFILES Policies
-- Usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Usuarios de la misma empresa pueden ver otros perfiles
CREATE POLICY "Users can view company profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (company_id = public.get_user_company_id() AND company_id IS NOT NULL);

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- USER_ROLES Policies
-- Usuarios pueden ver roles de su empresa
CREATE POLICY "Users can view company roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (company_id = public.get_user_company_id());

-- Solo admins pueden asignar roles
CREATE POLICY "Admins can insert roles"
    ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id = public.get_user_company_id() 
        AND public.has_role(auth.uid(), 'admin')
    );

-- Solo admins pueden eliminar roles
CREATE POLICY "Admins can delete roles"
    ON public.user_roles
    FOR DELETE
    TO authenticated
    USING (
        company_id = public.get_user_company_id() 
        AND public.has_role(auth.uid(), 'admin')
    );

-- =============================================
-- Índices para mejor performance
-- =============================================
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_company_id ON public.user_roles(company_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);