
ALTER TABLE public.route_stops ADD COLUMN weight_kg numeric NULL;
ALTER TABLE public.route_stops ADD COLUMN zone text NULL;
ALTER TABLE public.routes ADD COLUMN cost_per_km numeric NULL;
ALTER TABLE public.routes ADD COLUMN distance_km numeric NULL;
