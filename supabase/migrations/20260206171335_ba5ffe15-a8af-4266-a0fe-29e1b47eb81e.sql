-- Table for GPS location tracking
CREATE TABLE IF NOT EXISTS public.location_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) NOT NULL,
  driver_id uuid REFERENCES profiles(id) NOT NULL,
  route_id uuid REFERENCES routes(id),
  lat decimal(10, 7) NOT NULL,
  lng decimal(10, 7) NOT NULL,
  accuracy_m decimal(6, 2),
  speed_mps decimal(5, 2),
  heading decimal(5, 2),
  recorded_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_location_points_company ON location_points(company_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_points_driver ON location_points(driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_points_route ON location_points(route_id, recorded_at DESC) WHERE route_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE location_points ENABLE ROW LEVEL SECURITY;

-- RLS: Drivers can only insert their own location points
CREATE POLICY "drivers_insert_own_locations"
ON location_points FOR INSERT
TO authenticated
WITH CHECK (driver_id = auth.uid());

-- RLS: Company users can view all location points from their company
CREATE POLICY "company_view_locations"
ON location_points FOR SELECT
TO authenticated
USING (company_id = get_user_company_id());

-- Enable realtime for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_points;