-- Drop the existing tickets table if it exists
DROP TABLE IF EXISTS public.tickets CASCADE;

-- Create tickets table with proper foreign key relationships
CREATE TABLE public.tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  station text NOT NULL,
  manager_on_duty uuid REFERENCES public.store_managers(id) ON DELETE SET NULL,
  rcc_reference_number text NOT NULL,
  request_type text NOT NULL,
  device text NOT NULL,
  request_detail text NOT NULL,
  problem_category text NOT NULL,
  severity text NOT NULL,
  date_reported timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  status text DEFAULT 'Open' NOT NULL,
  reported_by_name text,
  serviced_by text,
  created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all authenticated users"
ON public.tickets FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.tickets FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON public.tickets FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete for authenticated users"
ON public.tickets FOR DELETE
TO authenticated
USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tickets_store_id ON public.tickets(store_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_severity ON public.tickets(severity);
CREATE INDEX IF NOT EXISTS idx_tickets_date_reported ON public.tickets(date_reported);
CREATE INDEX IF NOT EXISTS idx_tickets_manager_on_duty ON public.tickets(manager_on_duty);
CREATE INDEX IF NOT EXISTS idx_tickets_serviced_by ON public.tickets(serviced_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
