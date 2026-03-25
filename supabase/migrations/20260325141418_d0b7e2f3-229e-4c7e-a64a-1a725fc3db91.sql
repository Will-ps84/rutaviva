
-- ====================================================
-- MODULE 1: Ensure location_points has route_id index
-- ====================================================
CREATE INDEX IF NOT EXISTS idx_location_points_route_id ON public.location_points(route_id);
CREATE INDEX IF NOT EXISTS idx_location_points_recorded_at ON public.location_points(recorded_at DESC);

-- ====================================================
-- MODULE 2: route_stops - add missing columns
-- ====================================================
ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

-- MODULE 2: routes - add started_at column
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- MODULE 2: RPC get_route_progress
CREATE OR REPLACE FUNCTION public.get_route_progress(p_route_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'completed', COUNT(*) FILTER (WHERE status IN ('done','failed','skipped')),
    'successful', COUNT(*) FILTER (WHERE status = 'done'),
    'failed', COUNT(*) FILTER (WHERE status IN ('failed','skipped')),
    'percent', ROUND(
      COUNT(*) FILTER (WHERE status IN ('done','failed','skipped'))::numeric
      / NULLIF(COUNT(*), 0) * 100, 1
    )
  )
  FROM public.route_stops
  WHERE route_id = p_route_id;
$$;

-- ====================================================
-- MODULE 3: tracking_token for public /track/:token
-- ====================================================
ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT gen_random_uuid();

UPDATE public.route_stops
  SET tracking_token = gen_random_uuid()
  WHERE tracking_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_route_stops_tracking_token
  ON public.route_stops(tracking_token)
  WHERE tracking_token IS NOT NULL;

DROP POLICY IF EXISTS "anon_track_by_token" ON public.route_stops;
CREATE POLICY "anon_track_by_token" ON public.route_stops
  FOR SELECT TO anon
  USING (tracking_token IS NOT NULL);

DROP POLICY IF EXISTS "anon_track_route_locations" ON public.location_points;
CREATE POLICY "anon_track_route_locations" ON public.location_points
  FOR SELECT TO anon
  USING (route_id IS NOT NULL);

DROP POLICY IF EXISTS "anon_view_route_for_tracking" ON public.routes;
CREATE POLICY "anon_view_route_for_tracking" ON public.routes
  FOR SELECT TO anon
  USING (status IN ('published', 'in_progress', 'done'));

DROP POLICY IF EXISTS "anon_view_company_name" ON public.companies;
CREATE POLICY "anon_view_company_name" ON public.companies
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "anon_view_driver_name_for_tracking" ON public.profiles;
CREATE POLICY "anon_view_driver_name_for_tracking" ON public.profiles
  FOR SELECT TO anon
  USING (true);

-- ====================================================
-- MODULE 5: route_alerts table
-- ====================================================
CREATE TABLE IF NOT EXISTS public.route_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stop_id UUID REFERENCES public.route_stops(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('long_stop','no_signal','route_completed','delivery_failed')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.route_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_alerts_select" ON public.route_alerts;
CREATE POLICY "company_alerts_select" ON public.route_alerts
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id() OR is_super_admin());

DROP POLICY IF EXISTS "company_alerts_insert" ON public.route_alerts;
CREATE POLICY "company_alerts_insert" ON public.route_alerts
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id() OR is_super_admin());

DROP POLICY IF EXISTS "company_alerts_update" ON public.route_alerts;
CREATE POLICY "company_alerts_update" ON public.route_alerts
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() OR is_super_admin());

-- Storage: delivery-evidence bucket
INSERT INTO storage.buckets (id, name, public)
  VALUES ('delivery-evidence', 'delivery-evidence', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "drivers_upload_evidence" ON storage.objects;
CREATE POLICY "drivers_upload_evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-evidence'
    AND has_role(auth.uid(), 'driver'::app_role)
  );

DROP POLICY IF EXISTS "company_read_evidence" ON storage.objects;
CREATE POLICY "company_read_evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-evidence'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'dispatcher'::app_role)
    )
  );
