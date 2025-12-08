-- Create tickets table
create table if not exists public.tickets (
  id uuid default gen_random_uuid() primary key,
  store_id uuid references public.stores(id) on delete cascade,
  station text not null,
  manager_on_duty text not null,
  rcc_reference_number text,
  request_type text not null,
  device text not null,
  request_detail text not null,
  problem_category text not null,
  severity text not null,
  date_reported timestamp with time zone default timezone('utc'::text, now()) not null,
  status text default 'Open' not null,
  reported_by_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.tickets enable row level security;

-- Create policies
create policy "Enable read access for all authenticated users"
on public.tickets for select
to authenticated
using (true);

create policy "Enable insert for authenticated users"
on public.tickets for insert
to authenticated
with check (true);

create policy "Enable update for authenticated users"
on public.tickets for update
to authenticated
using (true);

create policy "Enable delete for authenticated users"
on public.tickets for delete
to authenticated
using (true);

-- Create index for faster lookups
create index if not exists idx_tickets_store_id on public.tickets(store_id);
create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_severity on public.tickets(severity);
create index if not exists idx_tickets_date_reported on public.tickets(date_reported);

-- Create updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.tickets
  for each row
  execute function public.handle_updated_at();
