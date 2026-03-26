
-- Drop the broad existing anon policy and replace with a tighter one
DROP POLICY IF EXISTS "anon_track_route_locations" ON location_points;

CREATE POLICY "anon_track_driver_location" ON location_points
  FOR SELECT TO anon
  USING (
    route_id IN (
      SELECT r.id FROM routes r
      JOIN route_stops rs ON rs.route_id = r.id
      WHERE rs.tracking_token IS NOT NULL
    )
  );
