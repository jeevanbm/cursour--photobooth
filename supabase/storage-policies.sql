-- Run after creating bucket "strips" (public) in Supabase Storage UI

create policy "strips public read"
on storage.objects for select
using (bucket_id = 'strips');

create policy "strips anon upload"
on storage.objects for insert
with check (bucket_id = 'strips');

-- Realtime for print station
alter publication supabase_realtime add table public.captures;
