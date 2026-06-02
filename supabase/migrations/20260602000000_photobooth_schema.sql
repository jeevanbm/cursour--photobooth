-- Event photobooth schema (run in Supabase SQL editor or via CLI)
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

create extension if not exists "pgcrypto";

-- Per-event frame packs (swap frames per wedding, party, etc.)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  frame_paths text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Print jobs from capture devices
create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_slug text,
  storage_path text not null,
  public_url text,
  status text not null default 'pending' check (status in ('pending', 'printing', 'printed', 'failed')),
  printed_at timestamptz,
  error_message text
);

-- Add columns if captures already existed with a different shape
alter table public.captures add column if not exists event_slug text;
alter table public.captures add column if not exists storage_path text;
alter table public.captures add column if not exists public_url text;
alter table public.captures add column if not exists status text default 'pending';
alter table public.captures add column if not exists printed_at timestamptz;
alter table public.captures add column if not exists error_message text;

create index if not exists captures_status_created_idx on public.captures (status, created_at desc);

alter table public.events enable row level security;
alter table public.captures enable row level security;

-- Booth: anyone with anon key can insert captures and read events
drop policy if exists "events read active" on public.events;
create policy "events read active" on public.events
  for select using (is_active = true);

drop policy if exists "captures insert" on public.captures;
create policy "captures insert" on public.captures
  for insert with check (true);

drop policy if exists "captures read" on public.captures;
create policy "captures read" on public.captures
  for select using (true);

drop policy if exists "captures update status" on public.captures;
create policy "captures update status" on public.captures
  for update using (true) with check (true);

-- Storage bucket: strips (create in dashboard if migration cannot create buckets)
-- Policy: public read, authenticated/anon upload for booth

insert into public.events (slug, name, frame_paths)
values (
  'default',
  'Default hearts',
  array[
    '/assets/frames/heart-frame.png',
    '/assets/frames/heart-frame-2.png',
    '/assets/frames/heart-frame-3.png',
    '/assets/frames/heart-frame-4.png'
  ]
)
on conflict (slug) do nothing;
