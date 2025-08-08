-- Run this in Supabase SQL editor

-- 1) Tables
create table if not exists public.intakes (
  id bigserial primary key,
  submission_id text unique not null,
  personal jsonb not null,
  immigration jsonb not null,
  documents jsonb not null default '{}'::jsonb,
  consent jsonb not null,
  status text not null default 'received',
  created_at timestamptz not null default now()
);

create table if not exists public.intake_files (
  id bigserial primary key,
  submission_id text not null references public.intakes(submission_id) on delete cascade,
  path text not null,
  filename text not null,
  mimetype text not null,
  size bigint not null,
  created_at timestamptz not null default now()
);

-- 2) Storage bucket
-- Create the bucket in Storage UI named 'intake-uploads' (public = false)

-- 3) RLS
alter table public.intakes enable row level security;
alter table public.intake_files enable row level security;

-- Only service role (API) can write; no anon reads
create policy "service_insert_intakes" on public.intakes
  for insert to authenticated
  with check (auth.role() = 'service_role');

create policy "service_select_intakes" on public.intakes
  for select to authenticated
  using (auth.role() = 'service_role');

create policy "service_insert_files" on public.intake_files
  for insert to authenticated
  with check (auth.role() = 'service_role');

create policy "service_select_files" on public.intake_files
  for select to authenticated
  using (auth.role() = 'service_role');

-- Note: The service role bypasses RLS; policies above are defensive if you ever switch to auth.
