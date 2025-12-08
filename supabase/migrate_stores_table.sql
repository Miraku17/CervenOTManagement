-- Migration script to update stores table schema
-- Run this script if you have an existing stores table

-- Add new columns
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS store_type text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS "group" text;

-- Drop old column (uncomment when you're ready to remove the old data)
-- ALTER TABLE public.stores DROP COLUMN IF EXISTS address;

-- If you want to migrate data from address to city, you can do something like:
-- UPDATE public.stores SET city = address WHERE city IS NULL AND address IS NOT NULL;
