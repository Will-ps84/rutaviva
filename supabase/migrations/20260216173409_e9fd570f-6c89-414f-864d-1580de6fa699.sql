
-- =============================================
-- MULTI-TENANT: schema changes, quotas, audit, RLS updates
-- (super_admin enum value was committed in previous migration)
-- =============================================

-- 2. Add plan/quota columns to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_name TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS max_admins INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_drivers INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- 3. Add status column to user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_user_roles_status ON public.user_roles(status);

-- 4. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. is_super_admin() helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin' AND status = 'active'
  )
$$;

-- 6. Update has_role to check status
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND status = 'active'
  )
$$;

-- 7. Quota enforcement trigger
CREATE OR REPLACE FUNCTION public.enforce_membership_quotas()
RETURNS TRIGGER AS $$
DECLARE
  v_max_admins INTEGER;
  v_max_drivers INTEGER;
  v_current INTEGER;
  v_company_status TEXT;
BEGIN
  IF NEW.role = 'super_admin' THEN RETURN NEW; END IF;
  IF NEW.status != 'active' THEN RETURN NEW; END IF;

  SELECT max_admins, max_drivers, status INTO v_max_admins, v_max_drivers, v_company_status
  FROM public.companies WHERE id = NEW.company_id;

  IF v_company_status != 'active' THEN
    RAISE EXCEPTION 'La empresa está inactiva. No se pueden agregar miembros.';
  END IF;

  IF NEW.role IN ('admin', 'dispatcher', 'owner') THEN
    SELECT COUNT(*) INTO v_current FROM public.user_roles
    WHERE company_id = NEW.company_id AND role IN ('admin', 'dispatcher', 'owner') AND status = 'active'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    IF v_current >= v_max_admins THEN
      RAISE EXCEPTION 'Límite de administradores alcanzado (% de %).', v_current, v_max_admins;
    END IF;
  END IF;

  IF NEW.role = 'driver' THEN
    SELECT COUNT(*) INTO v_current FROM public.user_roles
    WHERE company_id = NEW.company_id AND role = 'driver' AND status = 'active'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    IF v_current >= v_max_drivers THEN
      RAISE EXCEPTION 'Límite de conductores alcanzado (% de %).', v_current, v_max_drivers;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_membership_quotas ON public.user_roles;
CREATE TRIGGER enforce_membership_quotas
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_membership_quotas();

-- 8. Audit log helper
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action TEXT, p_target_table TEXT DEFAULT NULL, p_target_id TEXT DEFAULT NULL, p_details JSONB DEFAULT '{}'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (company_id, user_id, action, target_table, target_id, details)
  VALUES (public.get_user_company_id(), auth.uid(), p_action, p_target_table, p_target_id, p_details);
END;
$$;

-- 9. Audit trigger for user_roles
CREATE OR REPLACE FUNCTION public.audit_user_roles_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (company_id, user_id, action, target_table, target_id, details)
    VALUES (NEW.company_id, auth.uid(), 'role_created', 'user_roles', NEW.id::text,
      jsonb_build_object('target_user_id', NEW.user_id, 'role', NEW.role, 'status', NEW.status));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (company_id, user_id, action, target_table, target_id, details)
    VALUES (NEW.company_id, auth.uid(), 'role_updated', 'user_roles', NEW.id::text,
      jsonb_build_object('target_user_id', NEW.user_id, 'old_role', OLD.role, 'new_role', NEW.role, 'old_status', OLD.status, 'new_status', NEW.status));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (company_id, user_id, action, target_table, target_id, details)
    VALUES (OLD.company_id, auth.uid(), 'role_deleted', 'user_roles', OLD.id::text,
      jsonb_build_object('target_user_id', OLD.user_id, 'role', OLD.role));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_changes();

-- 10. Audit trigger for route status changes
CREATE OR REPLACE FUNCTION public.audit_route_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (company_id, user_id, action, target_table, target_id, details)
    VALUES (NEW.company_id, auth.uid(), 'route_status_changed', 'routes', NEW.id::text,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'route_name', NEW.name));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS audit_route_status ON public.routes;
CREATE TRIGGER audit_route_status
  AFTER UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.audit_route_status_changes();

-- =============================================
-- RLS POLICY UPDATES
-- =============================================

-- COMPANIES
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
DROP POLICY IF EXISTS "users_view_assigned_companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can update their company" ON public.companies;
DROP POLICY IF EXISTS "owners_update_company" ON public.companies;
DROP POLICY IF EXISTS "users_can_create_first_company" ON public.companies;
DROP POLICY IF EXISTS "authenticated_insert_company" ON public.companies;

CREATE POLICY "users_view_assigned_companies" ON public.companies FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND status = 'active')
  OR id = public.get_user_company_id()
  OR (created_at >= (now() - interval '5 minutes') AND NOT EXISTS (SELECT 1 FROM user_roles WHERE company_id = companies.id))
);

CREATE POLICY "authenticated_insert_company" ON public.companies FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "owners_update_company" ON public.companies FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND status = 'active' AND role IN ('admin', 'owner'))
);

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins_view_company_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own company_id" ON public.profiles;
DROP POLICY IF EXISTS "system_insert_profiles" ON public.profiles;

CREATE POLICY "users_view_own_profile" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "admins_view_company_profiles" ON public.profiles FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (company_id = public.get_user_company_id() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'owner')))
);

CREATE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "system_insert_profiles" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (true);

-- USER_ROLES
DROP POLICY IF EXISTS "Users can view company roles" ON public.user_roles;
DROP POLICY IF EXISTS "users_view_company_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins_manage_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins_delete_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins_update_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can create own admin role" ON public.user_roles;

CREATE POLICY "users_view_company_roles" ON public.user_roles FOR SELECT TO authenticated
USING (public.is_super_admin() OR company_id = public.get_user_company_id());

CREATE POLICY "admins_manage_roles" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (company_id = public.get_user_company_id() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')))
  OR user_id = auth.uid()
);

CREATE POLICY "admins_update_roles" ON public.user_roles FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR (company_id = public.get_user_company_id() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')))
);

CREATE POLICY "admins_delete_roles" ON public.user_roles FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (company_id = public.get_user_company_id() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')))
);

-- ROUTES
DROP POLICY IF EXISTS "Users can view company routes" ON public.routes;
DROP POLICY IF EXISTS "users_view_company_routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and dispatchers can insert routes" ON public.routes;
DROP POLICY IF EXISTS "users_insert_company_routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and dispatchers can update routes" ON public.routes;
DROP POLICY IF EXISTS "users_update_company_routes" ON public.routes;
DROP POLICY IF EXISTS "Admins can delete routes" ON public.routes;
DROP POLICY IF EXISTS "users_delete_company_routes" ON public.routes;
DROP POLICY IF EXISTS "Drivers can view assigned routes" ON public.routes;

CREATE POLICY "users_view_company_routes" ON public.routes FOR SELECT TO authenticated
USING (public.is_super_admin() OR company_id = public.get_user_company_id() OR (driver_id = auth.uid() AND public.has_role(auth.uid(), 'driver')));

CREATE POLICY "users_insert_company_routes" ON public.routes FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin() OR (company_id = public.get_user_company_id() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'owner'))));

CREATE POLICY "users_update_company_routes" ON public.routes FOR UPDATE TO authenticated
USING (public.is_super_admin() OR company_id = public.get_user_company_id())
WITH CHECK (public.is_super_admin() OR company_id = public.get_user_company_id());

CREATE POLICY "users_delete_company_routes" ON public.routes FOR DELETE TO authenticated
USING (public.is_super_admin() OR (company_id = public.get_user_company_id() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))));

-- ROUTE_STOPS
DROP POLICY IF EXISTS "Users can view route stops" ON public.route_stops;
DROP POLICY IF EXISTS "users_view_company_stops" ON public.route_stops;
DROP POLICY IF EXISTS "Admins and dispatchers can insert stops" ON public.route_stops;
DROP POLICY IF EXISTS "users_insert_company_stops" ON public.route_stops;
DROP POLICY IF EXISTS "Admins and dispatchers can update stops" ON public.route_stops;
DROP POLICY IF EXISTS "users_update_company_stops" ON public.route_stops;
DROP POLICY IF EXISTS "Admins can delete stops" ON public.route_stops;
DROP POLICY IF EXISTS "users_delete_company_stops" ON public.route_stops;
DROP POLICY IF EXISTS "Drivers can update stop status" ON public.route_stops;
DROP POLICY IF EXISTS "users_manage_company_stops" ON public.route_stops;

CREATE POLICY "users_view_company_stops" ON public.route_stops FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.user_can_access_route(route_id));

CREATE POLICY "users_insert_company_stops" ON public.route_stops FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin() OR public.user_can_access_route(route_id));

CREATE POLICY "users_update_company_stops" ON public.route_stops FOR UPDATE TO authenticated
USING (public.is_super_admin() OR public.user_can_access_route(route_id))
WITH CHECK (public.is_super_admin() OR public.user_can_access_route(route_id));

CREATE POLICY "users_delete_company_stops" ON public.route_stops FOR DELETE TO authenticated
USING (public.is_super_admin() OR public.user_can_access_route(route_id));

-- VEHICLES
DROP POLICY IF EXISTS "Users can view company vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "users_view_company_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Admins and dispatchers can insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "users_insert_company_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Admins and dispatchers can update vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "users_update_company_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Admins can delete vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "users_delete_company_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "users_manage_company_vehicles" ON public.vehicles;

CREATE POLICY "users_view_company_vehicles" ON public.vehicles FOR SELECT TO authenticated
USING (public.is_super_admin() OR company_id = public.get_user_company_id());

CREATE POLICY "users_insert_company_vehicles" ON public.vehicles FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin() OR (company_id = public.get_user_company_id() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'owner'))));

CREATE POLICY "users_update_company_vehicles" ON public.vehicles FOR UPDATE TO authenticated
USING (public.is_super_admin() OR company_id = public.get_user_company_id())
WITH CHECK (public.is_super_admin() OR company_id = public.get_user_company_id());

CREATE POLICY "users_delete_company_vehicles" ON public.vehicles FOR DELETE TO authenticated
USING (public.is_super_admin() OR (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin')));

-- LOCATION_POINTS
DROP POLICY IF EXISTS "company_view_locations" ON public.location_points;
DROP POLICY IF EXISTS "company_view_own_locations" ON public.location_points;
DROP POLICY IF EXISTS "drivers_insert_own_locations" ON public.location_points;

CREATE POLICY "company_view_own_locations" ON public.location_points FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (company_id = public.get_user_company_id() AND (driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'owner')))
);

CREATE POLICY "drivers_insert_own_locations" ON public.location_points FOR INSERT TO authenticated
WITH CHECK (driver_id = auth.uid() AND company_id = public.get_user_company_id());

-- AUDIT_LOGS RLS
CREATE POLICY "super_admin_view_all_logs" ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "admins_view_company_logs" ON public.audit_logs FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')));

CREATE POLICY "system_insert_logs" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- 11. Prevent company_id mutation
CREATE OR REPLACE FUNCTION public.prevent_company_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    IF public.is_super_admin() THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'No está permitido cambiar el company_id de un registro.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_routes_company_change ON public.routes;
CREATE TRIGGER prevent_routes_company_change BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_id_change();

DROP TRIGGER IF EXISTS prevent_vehicles_company_change ON public.vehicles;
CREATE TRIGGER prevent_vehicles_company_change BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_id_change();

DROP TRIGGER IF EXISTS prevent_user_roles_company_change ON public.user_roles;
CREATE TRIGGER prevent_user_roles_company_change BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_company_id_change();
