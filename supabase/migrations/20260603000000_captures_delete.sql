-- Allow booth to delete strips from archive
drop policy if exists "captures delete" on public.captures;
create policy "captures delete" on public.captures
  for delete using (true);

drop policy if exists "strips anon delete" on storage.objects;
create policy "strips anon delete" on storage.objects
  for delete using (bucket_id = 'strips');
