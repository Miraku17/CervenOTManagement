-- Add serviced_by column to tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS serviced_by text;

-- Add index for serviced_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_tickets_serviced_by ON public.tickets(serviced_by);
