
-- Add year and capacity columns to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS year integer,
ADD COLUMN IF NOT EXISTS capacity integer;
