create table if not exists public.stores (
  id uuid default gen_random_uuid() primary key,
  store_name text not null,
  store_code text not null unique,
  contact_no text,
  address text,
  managers text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.stores enable row level security;

-- Create policies (adjust as needed, assuming authenticated users can read, admins can write)
create policy "Enable read access for all authenticated users"
on public.stores for select
to authenticated
using (true);

create policy "Enable insert for authenticated users"
on public.stores for insert
to authenticated
with check (true);

create policy "Enable update for authenticated users"
on public.stores for update
to authenticated
using (true);

create policy "Enable delete for authenticated users"
on public.stores for delete
to authenticated
using (true);
