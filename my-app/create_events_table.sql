-- SQL script to create the events table in Supabase
create table if not exists public.events (
  id text primary key,
  title text not null,
  code text not null unique,
  category text default 'Technical',
  description text,
  venue text,
  date text,
  time text,
  status text default 'active',
  max_capacity integer default 200,
  color_theme text default '#f59e0b',
  banner_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table public.events enable row level security;

-- Policies for public / anon access
drop policy if exists "Allow select events" on public.events;
create policy "Allow select events" on public.events for select using (true);

drop policy if exists "Allow insert events" on public.events;
create policy "Allow insert events" on public.events for insert with check (true);

drop policy if exists "Allow update events" on public.events;
create policy "Allow update events" on public.events for update using (true) with check (true);

drop policy if exists "Allow delete events" on public.events;
create policy "Allow delete events" on public.events for delete using (true);
