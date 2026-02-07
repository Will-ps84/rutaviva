-- Add completed_at column to routes table
ALTER TABLE public.routes 
ADD COLUMN completed_at timestamp with time zone DEFAULT NULL;

-- Create index for faster queries on completed routes
CREATE INDEX idx_routes_completed_at ON public.routes(completed_at) WHERE completed_at IS NOT NULL;

-- Update existing 'done' routes to have a completed_at timestamp
UPDATE public.routes 
SET completed_at = updated_at 
WHERE status = 'done' AND completed_at IS NULL;