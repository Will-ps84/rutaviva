-- Create route_status enum
CREATE TYPE public.route_status AS ENUM ('draft', 'published', 'in_progress', 'done');

-- Create stop_status enum  
CREATE TYPE public.stop_status AS ENUM ('pending', 'arrived', 'done', 'skipped');

-- Create vehicles table
CREATE TABLE public.vehicles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    plate TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- RLS policies for vehicles
CREATE POLICY "Users can view company vehicles"
ON public.vehicles FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Admins and dispatchers can insert vehicles"
ON public.vehicles FOR INSERT
WITH CHECK (
    company_id = get_user_company_id() 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Admins and dispatchers can update vehicles"
ON public.vehicles FOR UPDATE
USING (
    company_id = get_user_company_id() 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Admins can delete vehicles"
ON public.vehicles FOR DELETE
USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- Create routes table
CREATE TABLE public.routes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status route_status NOT NULL DEFAULT 'draft',
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    polyline TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on routes
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- RLS policies for routes
CREATE POLICY "Users can view company routes"
ON public.routes FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Admins and dispatchers can insert routes"
ON public.routes FOR INSERT
WITH CHECK (
    company_id = get_user_company_id() 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Admins and dispatchers can update routes"
ON public.routes FOR UPDATE
USING (
    company_id = get_user_company_id() 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dispatcher'))
);

CREATE POLICY "Admins can delete routes"
ON public.routes FOR DELETE
USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- Drivers can view routes assigned to them
CREATE POLICY "Drivers can view assigned routes"
ON public.routes FOR SELECT
USING (driver_id = auth.uid() AND has_role(auth.uid(), 'driver'));

-- Create route_stops table
CREATE TABLE public.route_stops (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    address_text TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    planned_window_start TIME,
    planned_window_end TIME,
    status stop_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on route_stops
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user can access route
CREATE OR REPLACE FUNCTION public.user_can_access_route(_route_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.routes r
        WHERE r.id = _route_id
          AND (
              r.company_id = get_user_company_id()
              OR r.driver_id = auth.uid()
          )
    )
$$;

-- RLS policies for route_stops
CREATE POLICY "Users can view route stops"
ON public.route_stops FOR SELECT
USING (user_can_access_route(route_id));

CREATE POLICY "Admins and dispatchers can insert stops"
ON public.route_stops FOR INSERT
WITH CHECK (user_can_access_route(route_id));

CREATE POLICY "Admins and dispatchers can update stops"
ON public.route_stops FOR UPDATE
USING (user_can_access_route(route_id));

CREATE POLICY "Admins can delete stops"
ON public.route_stops FOR DELETE
USING (user_can_access_route(route_id));

-- Drivers can update stop status
CREATE POLICY "Drivers can update stop status"
ON public.route_stops FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.routes r
        WHERE r.id = route_id
        AND r.driver_id = auth.uid()
    )
);

-- Add updated_at trigger to routes
CREATE TRIGGER update_routes_updated_at
BEFORE UPDATE ON public.routes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_routes_company_date ON public.routes(company_id, date);
CREATE INDEX idx_routes_driver ON public.routes(driver_id);
CREATE INDEX idx_route_stops_route ON public.route_stops(route_id);
CREATE INDEX idx_vehicles_company ON public.vehicles(company_id);