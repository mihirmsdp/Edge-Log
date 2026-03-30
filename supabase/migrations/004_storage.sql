insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', false)
on conflict (id) do nothing;

create policy "users can read their own screenshots"
on storage.objects for select
using (
  bucket_id = 'trade-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can upload their own screenshots"
on storage.objects for insert
with check (
  bucket_id = 'trade-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can delete their own screenshots"
on storage.objects for delete
using (
  bucket_id = 'trade-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);
