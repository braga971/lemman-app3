-- app_state table for syncing full UI state as JSON
create table if not exists public.app_state (
  key text primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);

alter table public.app_state enable row level security;

-- Open policies for quick start (anyone can read/write).
-- For production, tighten these with auth.uid() checks.
do $$ begin
  if not exists (select 1 from pg_policies where polname = 'read_all' and tablename = 'app_state') then
    create policy "read_all" on public.app_state for select using (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'insert_all' and tablename = 'app_state') then
    create policy "insert_all" on public.app_state for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'update_all' and tablename = 'app_state') then
    create policy "update_all" on public.app_state for update using (true);
  end if;
end $$;
