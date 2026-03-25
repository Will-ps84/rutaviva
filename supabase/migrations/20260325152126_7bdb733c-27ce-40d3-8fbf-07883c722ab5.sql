-- Fix get_route_progress to use correct stop_status enum values
-- stop_status enum: pending | arrived | done | skipped | failed
-- route_status enum: draft | published | in_progress | done

DROP FUNCTION IF EXISTS get_route_progress(uuid);

CREATE OR REPLACE FUNCTION public.get_route_progress(p_route_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total',   COUNT(*),
    'done',    COUNT(*) FILTER (WHERE status = 'done'),
    'arrived', COUNT(*) FILTER (WHERE status = 'arrived'),
    'failed',  COUNT(*) FILTER (WHERE status IN ('failed', 'skipped')),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'percent', ROUND(
      COUNT(*) FILTER (WHERE status IN ('done', 'failed', 'skipped'))::numeric
      / NULLIF(COUNT(*), 0) * 100,
      1
    )
  )
  FROM route_stops
  WHERE route_id = p_route_id;
$$;